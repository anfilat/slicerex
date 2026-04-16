# Slicerex — Audio Phrase Splitter

## Context

English language textbook audio recordings come as single long files. The user needs to split them into individual phrase-level files for study. Some phrases should be merged into one file, others excluded entirely. The goal is a browser-based tool that automates detection and gives manual control over the result.

## Approach

React + WaveSurfer.js web application. Pure frontend — no backend required.

Two-phase phrase detection:
1. **Primary: Local Whisper (whisper.cpp WASM)** — transcribes audio and provides sentence-level timestamps. Phrases are split by recognized sentences, and each phrase gets its text displayed.
2. **Fallback: Silence detection (RMS-based)** — used when Whisper is unavailable or as a quick initial pass. User can re-detect with Whisper later.

WaveSurfer.js provides waveform visualization with interactive regions (drag-to-resize phrase boundaries).

## Architecture

```
User uploads file
      |
      v
AudioContext.decodeAudioData() -> Float32Array (PCM)
      |
      +--------------------+
      |                    |
      v                    v
Silence Detection      Whisper WASM (Web Worker)
(RMS, fast)            (slow, ~10-20 min for 60min audio)
      |                    |
      +----> Phrase[] <----+
                |
                v
          Phrase[] (with optional transcript) -> React state
                |
            +---+---+
            v       v
      WaveSurfer   PhraseList
      (regions)    (cards with text + controls)
        |       |
        +---+---+  <- bidirectional sync
                |
                v
      Export: slice AudioBuffer -> lamejs (Web Worker) -> MP3 -> download
```

## Data Model

```typescript
interface Phrase {
  id: number;
  startTime: number;   // seconds
  endTime: number;     // seconds
  groupId: number;     // same groupId = merged into one file
  excluded: boolean;   // true = skip on export
  transcript?: string; // from Whisper, optional
}

interface DetectionSettings {
  method: 'silence' | 'whisper' | 'both';
  // Silence detection settings
  silenceThresholdDb: number;  // default: -40
  minSilenceDuration: number;  // ms, default: 300
  minPhraseDuration: number;   // ms, default: 200
  padding: number;             // ms, default: 50
  // Whisper settings
  whisperModel: 'tiny' | 'base' | 'small';  // default: 'base'
}
```

## UI Layout

```
+-------------------------------------------------------------+
|  Slicerex                                                    |
|                                                              |
|  [Upload audio file]                                         |
|                                                              |
|  --- Detection Settings ---------------------------------    |
|  Silence threshold: [-40 dB]  Min pause: [300ms]            |
|  Min phrase: [200ms]          Padding: [50ms]               |
|                                     [Detect phrases]         |
|                                                              |
|  ======== Waveform ======================================   |
|  ████......██████████......████......████████......████████   |
|  (colored regions, draggable boundaries)                     |
|                                                              |
|  --- Phrases ---------------------------------------------   |
|  | > 01  0:00.0 - 0:03.2                                |  |
|  |   "Where is the bank?"       [Merge v] [x Exclude]    |  |
|  | > 02  0:03.5 - 0:08.1                                |  |
|  |   "It's next to the post office" [Merge v] [x Exclude]|  |
|  | > 03  0:08.4 - 0:10.0                                |  |
|  |   (no transcript)           [Merge v] [x Exclude]     |  |
|  | ...                                                   |  |
|  ----------------------------------------------------------  |
|                                                              |
|  [Export all]  ████████...... 60%                            |
+-------------------------------------------------------------+
```

## Components

| Component | Purpose |
|---|---|
| `AudioUploader` | File input, loads and decodes audio |
| `DetectionSettings` | Method selector (silence/whisper/both), threshold, model size controls |
| `WaveformPanel` | WaveSurfer.js with Regions plugin, interactive boundaries |
| `PhraseList` | Scrollable list of phrase cards |
| `PhraseCard` | Play button, transcript text, merge toggle, exclude checkbox, time display |
| `ExportPanel` | Export button + progress bar |
| `WhisperStatus` | Whisper loading/processing progress (model download + transcription) |

## Key Behaviors

### Detection Methods

#### Silence Detection (fast, always available)
1. Decode audio to Float32Array via `AudioContext.decodeAudioData()`
2. Compute RMS energy envelope (50ms windows, 10ms hop)
3. Apply configurable silence threshold (default -40 dB)
4. Find contiguous silent regions > min silence duration (default 300ms)
5. Non-silent regions between gaps = initial phrase boundaries
6. Add padding (default 50ms) before/after each phrase

#### Whisper Detection (slow, richer output)
1. Load whisper.cpp WASM model (tiny: 39MB, base: 74MB, small: 244MB) — cached after first download
2. Process audio in Web Worker (non-blocking UI)
3. Get transcription segments with timestamps
4. Each segment becomes a phrase with transcript text
5. Duration: ~10-20 min for 60-min audio (base model, M1/M2)

#### "Both" mode
1. Run silence detection first (instant) — user sees initial phrase boundaries
2. Run Whisper in background — enriches phrases with transcripts
3. If Whisper finds better boundaries, offer to update

### Silence Detection
1. Decode audio to Float32Array via `AudioContext.decodeAudioData()`
2. Compute RMS energy envelope (50ms windows, 10ms hop)
3. Apply configurable silence threshold (default -40 dB)
4. Find contiguous silent regions > min silence duration (default 300ms)
5. Non-silent regions between gaps = initial phrase boundaries
6. Add padding (default 50ms) before/after each phrase

### Merge
- Button "Merge with next" on each phrase card
- Both phrases get same `groupId`, displayed as one region on waveform
- Becomes one file on export
- Unmerge available to split back

### Exclude
- Checkbox on phrase card
- Region turns grey/transparent on waveform
- Skipped during export

### Export
- Sequential blob downloads (one click, browser downloads all files)
- File naming: `<original_name>_01.mp3`, `<original_name>_02.mp3`, ... (e.g. `Unit5_Listening_01.mp3`, sequential, excluded phrases skipped, merged groups count as one)
- lamejs encoding in Web Worker (non-blocking)
- Progress bar during encoding

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Waveform | WaveSurfer.js v7 + Regions plugin |
| Audio processing | Web Audio API (built-in browser API) |
| Speech recognition | whisper.cpp WASM (local, in Web Worker) |
| MP3 encoding | lamejs (in Web Worker) |
| Styling | Tailwind CSS |

## Project Structure

```
slicerex/
  src/
    components/
      AudioUploader.tsx
      WaveformPanel.tsx
      PhraseList.tsx
      PhraseCard.tsx
      DetectionSettings.tsx
      ExportPanel.tsx
      WhisperStatus.tsx
    audio/
      silenceDetection.ts
      whisperTranscription.ts   -- whisper.cpp WASM wrapper
      audioEngine.ts
      mp3Encoder.ts
      exporter.ts
    hooks/
      useWaveSurfer.ts
      useWhisper.ts             -- model loading + transcription state
    types.ts
    App.tsx
    main.tsx
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.config.js
```

## Verification

1. Upload a 30-60 minute MP3 audio file from an English textbook
2. Verify silence detection splits into phrases with reasonable boundaries (fast, instant)
3. Run Whisper detection — verify transcription appears on phrase cards and boundaries improve
4. Adjust a boundary by dragging on waveform — verify it syncs with phrase list
5. Merge two adjacent phrases — verify they become one region and one list entry
6. Exclude a phrase — verify it greys out on waveform
7. Click play on a phrase — verify correct segment plays
8. Export — verify all non-excluded phrases download as numbered MP3 files
9. Test in Chrome (primary) and Firefox
