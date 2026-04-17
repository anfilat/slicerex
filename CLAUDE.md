# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run test         # Run all tests (vitest run)
npm run lint         # Lint with oxlint
npm run lint:fix     # Lint with auto-fix
npm run format       # Format with oxfmt
npm run format:check # Check formatting without writing
```

Pre-commit hook runs: `oxlint src/ && oxfmt --check src/ && vitest run`

Run a single test: `npx vitest run src/audio/silenceDetection.test.ts`

## Architecture

Browser-based audio phrase splitter. No backend — everything runs client-side.

**Data flow:** Upload audio → decode to AudioBuffer → detect phrases (silence/Whisper) → edit in UI (merge/exclude/adjust boundaries) → export as MP3 files.

**State management** is centralized in `src/App.tsx` via React hooks. The `AudioEngine` instance lives in a ref and persists across renders. All phrase state (`Phrase[]`) flows down to components via props; user actions flow up via callbacks.

**Three layers:**

- `src/audio/` — Pure audio logic (no React). `AudioEngine` wraps Web Audio API (decode, play, WAV conversion). `silenceDetection` is a pure function `detectPhrases(audioData, sampleRate, config) → Phrase[]`. MP3 encoding runs in a Web Worker (`mp3Encoder.worker.ts`) via `lamejs` to avoid blocking the UI. `whisperTranscription` is currently a stub.
- `src/components/` — React UI. `WaveformPanel` integrates WaveSurfer.js v7 with Regions plugin for interactive waveform with draggable phrase boundaries. Bidirectional sync: dragging a region boundary updates the phrase list, and merging/excluding phrases updates the waveform regions.
- `src/types.ts` — Core data model. `Phrase` has `id`, `startTime`, `endTime`, `excluded`, and optional `transcript`.

**Phrase merge/exclude model:** Users can manually merge adjacent phrases in the UI (combining them into a single phrase with a new ID). Excluded phrases are skipped during export. The exporter in `src/audio/exporter.ts` exports each non-excluded phrase individually as MP3 files, downloading sequentially as `<original_name>_01.mp3`, `<original_name>_02.mp3`, etc.

**Export pipeline:** `exportPhrases()` filters non-excluded phrases → for each phrase, `encodePhraseToMp3()` spawns a worker → worker converts Float32→Int16, encodes with lamejs → returns MP3 Blob → triggers download.

## Key Design Decisions

- Whisper transcription is stubbed (`src/audio/whisperTranscription.ts` throws). When Whisper is selected in the UI, it falls back to silence detection. Real implementation would use `@xenova/transformers` or similar.
- `audioBufferToWav()` on AudioEngine converts AudioBuffer to WAV Blob for WaveSurfer.js, which needs a URL/Blob to render the waveform.
- Workers are ES module workers (`{ type: 'module' }`), configured in `vite.config.ts` with `worker: { format: 'es' }`.
- Tailwind CSS v4 uses `@tailwindcss/vite` plugin only — no PostCSS config or tailwind.config.js needed.

## Tech Stack

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, WaveSurfer.js 7, lamejs, Vitest 4, oxlint, oxfmt

## Tests

There is a test audio file at test/test_audio.mp3
