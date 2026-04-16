# Slicerex — Audio Phrase Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based tool to split English textbook audio into phrase-level MP3 files, with silence detection, optional Whisper transcription, waveform visualization, and phrase merge/exclude controls.

**Architecture:** React SPA with WaveSurfer.js for waveform visualization and interactive regions. Core audio logic (silence detection, MP3 encoding, Whisper) runs in Web Workers. Phrase state managed in React with bidirectional sync to WaveSurfer regions.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, WaveSurfer.js v7, lamejs, whisper.cpp WASM

**Spec:** `docs/superpowers/specs/2026-04-15-audio-phrase-splitter-design.md`

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Initialize Vite React TypeScript project**

```bash
cd /Users/andreifilatkin/projects/slicerex
npm create vite@latest . -- --template react-ts
```

If prompted about existing files, choose to overwrite.

- [ ] **Step 2: Install dependencies**

```bash
npm install wavesurfer.js lamejs tailwindcss @tailwindcss/vite
npm install -D @types/lamejs
```

- [ ] **Step 3: Configure Tailwind**

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 4: Replace App.tsx with minimal shell**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Slicerex</h1>
      <p className="text-gray-400">Audio phrase splitter</p>
    </div>
  )
}

export default App
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts, page shows "Slicerex" heading.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS + Tailwind project"
```

---

### Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types file**

```typescript
export interface Phrase {
  id: number
  startTime: number    // seconds
  endTime: number      // seconds
  groupId: number      // same groupId = merged into one file
  excluded: boolean    // true = skip on export
  transcript?: string  // from Whisper, optional
}

export interface DetectionSettings {
  method: 'silence' | 'whisper' | 'both'
  silenceThresholdDb: number   // default: -40
  minSilenceDuration: number   // ms, default: 300
  minPhraseDuration: number    // ms, default: 200
  padding: number              // ms, default: 50
  whisperModel: 'tiny' | 'base' | 'small'  // default: 'base'
}

export const DEFAULT_SETTINGS: DetectionSettings = {
  method: 'silence',
  silenceThresholdDb: -40,
  minSilenceDuration: 300,
  minPhraseDuration: 200,
  padding: 50,
  whisperModel: 'base',
}

export interface ExportProgress {
  current: number
  total: number
  status: 'idle' | 'encoding' | 'downloading' | 'done'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core type definitions"
```

---

### Task 3: Silence Detection Algorithm

**Files:**
- Create: `src/audio/silenceDetection.ts`
- Create: `src/audio/silenceDetection.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/audio/silenceDetection.test.ts
import { describe, it, expect } from 'vitest'
import { detectPhrases } from './silenceDetection'
import { Phrase } from '../types'

// Helper: create a Float32Array representing audio with silence gaps
function createTestAudio(
  sampleRate: number,
  segments: { durationMs: number; amplitude: number }[]
): Float32Array {
  const totalSamples = segments.reduce(
    (sum, s) => sum + Math.floor((s.durationMs / 1000) * sampleRate), 0
  )
  const data = new Float32Array(totalSamples)
  let offset = 0
  for (const seg of segments) {
    const samples = Math.floor((seg.durationMs / 1000) * sampleRate)
    for (let i = 0; i < samples; i++) {
      data[offset + i] = seg.amplitude * Math.sin((2 * Math.PI * 440 * i) / sampleRate)
    }
    offset += samples
  }
  return data
}

describe('detectPhrases', () => {
  const sampleRate = 44100

  it('detects a single phrase with silence on both sides', () => {
    // 500ms silence, 1000ms speech, 500ms silence
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0 },
      { durationMs: 1000, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 0,
    })

    expect(phrases).toHaveLength(1)
    expect(phrases[0].startTime).toBeCloseTo(0.5, 1)
    expect(phrases[0].endTime).toBeCloseTo(1.5, 1)
  })

  it('detects two phrases separated by silence', () => {
    // speech, silence, speech, silence
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 0,
    })

    expect(phrases).toHaveLength(2)
  })

  it('ignores short silences within speech', () => {
    // speech with a brief 100ms dip, then longer silence
    const audio = createTestAudio(sampleRate, [
      { durationMs: 300, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },  // too short to split
      { durationMs: 300, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },   // long enough to split
      { durationMs: 300, amplitude: 0.5 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 0,
    })

    expect(phrases).toHaveLength(2)
  })

  it('assigns unique sequential IDs and groupIds', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 300, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
      { durationMs: 300, amplitude: 0.5 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 0,
    })

    expect(phrases.map(p => p.id)).toEqual([0, 1])
    expect(phrases.map(p => p.groupId)).toEqual([0, 1])
    expect(phrases.every(p => p.excluded === false)).toBe(true)
  })

  it('applies padding to phrase boundaries', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0 },
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 50,  // 50ms padding
    })

    expect(phrases).toHaveLength(1)
    // Start should be 50ms earlier, end 50ms later
    expect(phrases[0].startTime).toBeCloseTo(0.45, 1)
    expect(phrases[0].endTime).toBeCloseTo(1.05, 1)
  })

  it('clamps padding to audio boundaries', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0.5 },  // starts at 0
      { durationMs: 500, amplitude: 0 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 50,
    })

    expect(phrases[0].startTime).toBe(0)  // can't go below 0
  })

  it('filters out phrases shorter than minPhraseDuration', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 100, amplitude: 0.5 },  // too short
      { durationMs: 400, amplitude: 0 },
      { durationMs: 500, amplitude: 0.5 },  // long enough
      { durationMs: 400, amplitude: 0 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 0,
    })

    expect(phrases).toHaveLength(1)
  })

  it('returns empty array for silent audio', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 3000, amplitude: 0 },
    ])

    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40,
      minSilenceDuration: 300,
      minPhraseDuration: 200,
      padding: 0,
    })

    expect(phrases).toHaveLength(0)
  })
})
```

Install vitest:

```bash
npm install -D vitest
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `detectPhrases` module doesn't exist.

- [ ] **Step 3: Implement silence detection**

```typescript
// src/audio/silenceDetection.ts
import { Phrase } from '../types'

interface DetectionConfig {
  silenceThresholdDb: number
  minSilenceDuration: number   // ms
  minPhraseDuration: number    // ms
  padding: number              // ms
}

export function detectPhrases(
  audioData: Float32Array,
  sampleRate: number,
  config: DetectionConfig
): Phrase[] {
  const windowSize = Math.floor((50 / 1000) * sampleRate)   // 50ms window
  const hopSize = Math.floor((10 / 1000) * sampleRate)      // 10ms hop

  // Compute RMS energy envelope
  const thresholdLinear = Math.pow(10, config.silenceThresholdDb / 20)
  const isSilent: boolean[] = []

  for (let i = 0; i + windowSize <= audioData.length; i += hopSize) {
    let sumSq = 0
    for (let j = i; j < i + windowSize; j++) {
      sumSq += audioData[j] * audioData[j]
    }
    const rms = Math.sqrt(sumSq / windowSize)
    isSilent.push(rms < thresholdLinear)
  }

  // Find contiguous silent regions longer than minSilenceDuration
  const minSilentFrames = Math.ceil(config.minSilenceDuration / 10) // 10ms per hop
  const silenceRegions: { start: number; end: number }[] = []
  let silentStart = -1

  for (let i = 0; i < isSilent.length; i++) {
    if (isSilent[i]) {
      if (silentStart === -1) silentStart = i
    } else {
      if (silentStart !== -1 && i - silentStart >= minSilentFrames) {
        silenceRegions.push({
          start: (silentStart * hopSize) / sampleRate,
          end: (i * hopSize) / sampleRate,
        })
      }
      silentStart = -1
    }
  }
  // Handle trailing silence
  if (silentStart !== -1 && isSilent.length - silentStart >= minSilentFrames) {
    silenceRegions.push({
      start: (silentStart * hopSize) / sampleRate,
      end: (isSilent.length * hopSize) / sampleRate,
    })
  }

  const totalDuration = audioData.length / sampleRate

  // Derive phrases from gaps between silence regions
  const paddingSec = config.padding / 1000
  const boundaries: { start: number; end: number }[] = []

  let prevEnd = 0
  for (const region of silenceRegions) {
    if (region.start > prevEnd) {
      boundaries.push({ start: prevEnd, end: region.start })
    }
    prevEnd = region.end
  }
  if (prevEnd < totalDuration) {
    boundaries.push({ start: prevEnd, end: totalDuration })
  }

  // Filter by minPhraseDuration and apply padding
  const minPhraseSec = config.minPhraseDuration / 1000
  let phraseId = 0

  const phrases: Phrase[] = boundaries
    .filter(b => (b.end - b.start) >= minPhraseSec)
    .map(b => {
      const paddedStart = Math.max(0, b.start - paddingSec)
      const paddedEnd = Math.min(totalDuration, b.end + paddingSec)
      const phrase: Phrase = {
        id: phraseId,
        startTime: Math.round(paddedStart * 1000) / 1000,
        endTime: Math.round(paddedEnd * 1000) / 1000,
        groupId: phraseId,
        excluded: false,
      }
      phraseId++
      return phrase
    })

  // Re-index IDs and groupIds sequentially
  return phrases.map((p, i) => ({
    ...p,
    id: i,
    groupId: i,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/silenceDetection.ts src/audio/silenceDetection.test.ts package.json
git commit -m "feat: implement silence detection algorithm with tests"
```

---

### Task 4: Audio Engine

**Files:**
- Create: `src/audio/audioEngine.ts`

- [ ] **Step 1: Implement audio engine**

This module wraps Web Audio API for decoding and playback. Not easily unit-testable without mocking AudioContext, so we'll test it manually via the UI.

```typescript
// src/audio/audioEngine.ts
export class AudioEngine {
  private audioContext: AudioContext | null = null
  private audioBuffer: AudioBuffer | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private _fileName: string = ''

  get fileName(): string {
    return this._fileName
  }

  get buffer(): AudioBuffer | null {
    return this.audioBuffer
  }

  get duration(): number {
    return this.audioBuffer?.duration ?? 0
  }

  async loadFile(file: File): Promise<AudioBuffer> {
    this.stop()
    this._fileName = file.name.replace(/\.[^.]+$/, '')  // strip extension

    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    const arrayBuffer = await file.arrayBuffer()
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
    return this.audioBuffer
  }

  getChannelData(): Float32Array {
    if (!this.audioBuffer) throw new Error('No audio loaded')
    // Mix down to mono if stereo
    if (this.audioBuffer.numberOfChannels === 1) {
      return this.audioBuffer.getChannelData(0)
    }
    const ch0 = this.audioBuffer.getChannelData(0)
    const ch1 = this.audioBuffer.getChannelData(1)
    const mono = new Float32Array(ch0.length)
    for (let i = 0; i < ch0.length; i++) {
      mono[i] = (ch0[i] + ch1[i]) / 2
    }
    return mono
  }

  playSegment(start: number, end: number): Promise<void> {
    return new Promise((resolve) => {
      this.stop()
      if (!this.audioContext || !this.audioBuffer) return resolve()

      this.sourceNode = this.audioContext.createBufferSource()
      this.sourceNode.buffer = this.audioBuffer
      this.sourceNode.connect(this.audioContext.destination)

      const duration = end - start
      this.sourceNode.onended = () => resolve()

      this.sourceNode.start(0, start, duration)
    })
  }

  play(start: number): void {
    this.stop()
    if (!this.audioContext || !this.audioBuffer) return

    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = this.audioBuffer
    this.sourceNode.connect(this.audioContext.destination)
    this.sourceNode.start(0, start)
  }

  stop(): void {
    try {
      this.sourceNode?.stop()
    } catch {
      // ignore if not playing
    }
    this.sourceNode = null
  }

  destroy(): void {
    this.stop()
    this.audioContext?.close()
    this.audioContext = null
    this.audioBuffer = null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/audio/audioEngine.ts
git commit -m "feat: add audio engine for decode and playback"
```

---

## Phase 2: Core UI

### Task 5: App Shell + AudioUploader

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/AudioUploader.tsx`

- [ ] **Step 1: Create AudioUploader component**

```tsx
// src/components/AudioUploader.tsx
import { useRef } from 'react'
import { AudioEngine } from '../audio/audioEngine'

interface Props {
  engine: AudioEngine
  onLoaded: () => void
}

export function AudioUploader({ engine, onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      await engine.loadFile(file)
      onLoaded()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Upload audio file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleFile}
        className="hidden"
      />
      {engine.buffer && (
        <span className="ml-3 text-gray-400">
          {engine.fileName} ({Math.round(engine.duration)}s)
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx with state management**

```tsx
// src/App.tsx
import { useState, useRef } from 'react'
import { AudioEngine } from './audio/audioEngine'
import { Phrase, DEFAULT_SETTINGS, DetectionSettings } from './types'
import { AudioUploader } from './components/AudioUploader'

export default function App() {
  const engineRef = useRef(new AudioEngine())
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [settings, setSettings] = useState<DetectionSettings>(DEFAULT_SETTINGS)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Slicerex</h1>
      <AudioUploader
        engine={engineRef.current}
        onLoaded={() => setAudioLoaded(true)}
      />
      {audioLoaded && (
        <p className="text-gray-400">
          Audio loaded ({phrases.length} phrases detected)
        </p>
      )}
    </div>
  )
}
```

Fix the missing `useState` import in AudioUploader (add it):

```tsx
import { useRef, useState } from 'react'
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Upload an audio file. Verify the filename and duration appear.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AudioUploader.tsx
git commit -m "feat: add AudioUploader component and App shell"
```

---

### Task 6: DetectionSettings Component

**Files:**
- Create: `src/components/DetectionSettings.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create DetectionSettings**

```tsx
// src/components/DetectionSettings.tsx
import { DetectionSettings } from '../types'

interface Props {
  settings: DetectionSettings
  onChange: (settings: DetectionSettings) => void
  onDetect: () => void
  disabled: boolean
}

export function DetectionSettings({ settings, onChange, onDetect, disabled }: Props) {
  const update = (patch: Partial<DetectionSettings>) =>
    onChange({ ...settings, ...patch })

  return (
    <div className="mb-6 p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-3">Detection Settings</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="flex flex-col text-sm">
          Silence threshold (dB)
          <input
            type="number"
            value={settings.silenceThresholdDb}
            onChange={e => update({ silenceThresholdDb: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
        <label className="flex flex-col text-sm">
          Min pause (ms)
          <input
            type="number"
            value={settings.minSilenceDuration}
            onChange={e => update({ minSilenceDuration: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
        <label className="flex flex-col text-sm">
          Min phrase (ms)
          <input
            type="number"
            value={settings.minPhraseDuration}
            onChange={e => update({ minPhraseDuration: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
        <label className="flex flex-col text-sm">
          Padding (ms)
          <input
            type="number"
            value={settings.padding}
            onChange={e => update({ padding: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
      </div>
      <button
        onClick={onDetect}
        disabled={disabled}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
      >
        Detect phrases
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into App.tsx**

Add detection logic and `<DetectionSettings>` to App. The detect handler calls `detectPhrases` with the audio engine's channel data:

```tsx
// Add import at top of App.tsx
import { detectPhrases } from './audio/silenceDetection'
import { DetectionSettings } from './components/DetectionSettings'

// Add inside App component, after setAudioLoaded(true):
const handleDetect = () => {
  const engine = engineRef.current
  if (!engine.buffer) return
  const channelData = engine.getChannelData()
  const result = detectPhrases(channelData, engine.buffer.sampleRate, {
    silenceThresholdDb: settings.silenceThresholdDb,
    minSilenceDuration: settings.minSilenceDuration,
    minPhraseDuration: settings.minPhraseDuration,
    padding: settings.padding,
  })
  setPhrases(result)
}

// Add in JSX after AudioUploader, before the conditional:
{audioLoaded && (
  <DetectionSettings
    settings={settings}
    onChange={setSettings}
    onDetect={handleDetect}
    disabled={!audioLoaded}
  />
)}
```

- [ ] **Step 3: Verify in browser**

Upload an audio file, click "Detect phrases". Verify phrases are detected (shown as count in the UI).

- [ ] **Step 4: Commit**

```bash
git add src/components/DetectionSettings.tsx src/App.tsx
git commit -m "feat: add DetectionSettings with silence detection wired up"
```

---

### Task 7: PhraseCard + PhraseList

**Files:**
- Create: `src/components/PhraseCard.tsx`
- Create: `src/components/PhraseList.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create PhraseCard**

```tsx
// src/components/PhraseCard.tsx
import { Phrase } from '../types'

interface Props {
  phrase: Phrase
  index: number
  isLast: boolean
  onPlay: (phrase: Phrase) => void
  onMerge: (id: number) => void
  onUnmerge: (id: number) => void
  onToggleExclude: (id: number) => void
  isMergedWithNext: boolean
}

export function PhraseCard({
  phrase, index, isLast, onPlay, onMerge, onUnmerge, onToggleExclude, isMergedWithNext
}: Props) {
  const formatTime = (t: number) => {
    const min = Math.floor(t / 60)
    const sec = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 10)
    return `${min}:${String(sec).padStart(2, '0')}.${ms}`
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded ${
      phrase.excluded ? 'bg-gray-800/50 opacity-50' : 'bg-gray-800'
    }`}>
      <button
        onClick={() => onPlay(phrase)}
        className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
        title="Play"
      >
        ▶
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">#{index + 1}</span>
          <span className="font-mono text-xs text-gray-400">
            {formatTime(phrase.startTime)} – {formatTime(phrase.endTime)}
          </span>
          <span className="text-xs text-gray-500">
            ({((phrase.endTime - phrase.startTime)).toFixed(1)}s)
          </span>
        </div>
        {phrase.transcript && (
          <p className="text-sm text-gray-300 mt-1 truncate">
            "{phrase.transcript}"
          </p>
        )}
      </div>
      {!isLast && (
        <button
          onClick={() => isMergedWithNext ? onUnmerge(phrase.id) : onMerge(phrase.id)}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          title={isMergedWithNext ? 'Unmerge' : 'Merge with next'}
        >
          {isMergedWithNext ? 'Unmerge' : 'Merge ↓'}
        </button>
      )}
      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={phrase.excluded}
          onChange={() => onToggleExclude(phrase.id)}
        />
        Exclude
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Create PhraseList**

```tsx
// src/components/PhraseList.tsx
import { Phrase } from '../types'
import { PhraseCard } from './PhraseCard'

interface Props {
  phrases: Phrase[]
  onPlay: (phrase: Phrase) => void
  onMerge: (id: number) => void
  onUnmerge: (id: number) => void
  onToggleExclude: (id: number) => void
}

export function PhraseList({ phrases, onPlay, onMerge, onUnmerge, onToggleExclude }: Props) {
  if (phrases.length === 0) {
    return <p className="text-gray-500">No phrases detected yet.</p>
  }

  // Check if phrase at index i is merged with phrase at index i+1
  const isMergedWithNext = (i: number) =>
    i < phrases.length - 1 && phrases[i].groupId === phrases[i + 1].groupId

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">
        Phrases ({phrases.length})
      </h2>
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {phrases.map((phrase, i) => (
          <PhraseCard
            key={phrase.id}
            phrase={phrase}
            index={i}
            isLast={i === phrases.length - 1}
            onPlay={onPlay}
            onMerge={onMerge}
            onUnmerge={onUnmerge}
            onToggleExclude={onToggleExclude}
            isMergedWithNext={isMergedWithNext(i)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into App.tsx with merge/exclude/play handlers**

Add imports and handlers to App.tsx:

```tsx
import { PhraseList } from './components/PhraseList'

// Inside App component, add handlers:
const handlePlay = async (phrase: Phrase) => {
  await engineRef.current.playSegment(phrase.startTime, phrase.endTime)
}

const handleMerge = (id: number) => {
  const idx = phrases.findIndex(p => p.id === id)
  if (idx === -1 || idx === phrases.length - 1) return
  const targetGroupId = phrases[idx + 1].groupId
  setPhrases(phrases.map(p =>
    p.groupId === targetGroupId ? { ...p, groupId: phrases[idx].groupId } : p
  ))
}

const handleUnmerge = (id: number) => {
  const phrase = phrases.find(p => p.id === id)
  if (!phrase) return
  // Find all phrases in this group after the clicked one
  const groupPhrases = phrases.filter(p => p.groupId === phrase.groupId)
  if (groupPhrases.length <= 1) return
  setPhrases(phrases.map(p =>
    p.id === id + 1 ? { ...p, groupId: p.id } : p
  ))
}

const handleToggleExclude = (id: number) => {
  setPhrases(phrases.map(p =>
    p.id === id ? { ...p, excluded: !p.excluded } : p
  ))
}
```

Add `<PhraseList>` to JSX (after DetectionSettings):

```tsx
<PhraseList
  phrases={phrases}
  onPlay={handlePlay}
  onMerge={handleMerge}
  onUnmerge={handleUnmerge}
  onToggleExclude={handleToggleExclude}
/>
```

- [ ] **Step 4: Verify in browser**

Upload audio, detect phrases, see the list. Click play on a phrase, hear it. Click merge/exclude, verify UI updates.

- [ ] **Step 5: Commit**

```bash
git add src/components/PhraseCard.tsx src/components/PhraseList.tsx src/App.tsx
git commit -m "feat: add PhraseCard and PhraseList with merge/exclude/play"
```

---

## Phase 3: Waveform

### Task 8: WaveformPanel

**Files:**
- Create: `src/components/WaveformPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create WaveformPanel**

```tsx
// src/components/WaveformPanel.tsx
import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import { Phrase } from '../types'

interface Props {
  audioBuffer: AudioBuffer | null
  phrases: Phrase[]
  onPhraseBoundaryChange: (id: number, startTime: number, endTime: number) => void
}

export function WaveformPanel({ audioBuffer, phrases, onPhraseBoundaryChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<RegionsPlugin | null>(null)

  // Initialize WaveSurfer when audioBuffer changes
  useEffect(() => {
    if (!containerRef.current || !audioBuffer) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#6b7280',
      progressColor: '#3b82f6',
      height: 128,
      barWidth: 2,
      barGap: 1,
    })

    const regions = ws.registerPlugin(RegionsPlugin.create())
    wsRef.current = ws
    regionsRef.current = regions

    ws.loadBlob(new Blob([audioBuffer], { type: 'audio/wav' }))

    return () => {
      ws.destroy()
      wsRef.current = null
      regionsRef.current = null
    }
  }, [audioBuffer])

  // Sync regions with phrases
  useEffect(() => {
    const regions = regionsRef.current
    if (!regions) return

    // Clear existing regions
    const existingRegions = regions.getRegions()
    existingRegions.forEach(r => r.remove())

    // Add regions for each non-excluded phrase
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
    phrases.forEach((phrase, i) => {
      regions.addRegion({
        start: phrase.startTime,
        end: phrase.endTime,
        color: phrase.excluded ? 'rgba(107, 114, 128, 0.2)' : `${colors[i % colors.length]}33`,
        drag: false,
        resize: true,
        content: `#${i + 1}`,
      })
    })
  }, [phrases])

  // Handle region resize
  useEffect(() => {
    const regions = regionsRef.current
    if (!regions) return

    const handler = (region: any) => {
      const index = regions.getRegions().indexOf(region)
      if (index === -1) return
      const phrase = phrases[index]
      if (!phrase) return
      onPhraseBoundaryChange(phrase.id, region.start, region.end)
    }

    regions.on('region-updated', handler)
    return () => regions.un('region-updated', handler)
  }, [phrases, onPhraseBoundaryChange])

  return (
    <div className="mb-6">
      <div ref={containerRef} className="bg-gray-800 rounded-lg overflow-hidden" />
    </div>
  )
}
```

- [ ] **Step 2: Wire into App.tsx**

```tsx
import { WaveformPanel } from './components/WaveformPanel'

// Add handler in App:
const handlePhraseBoundaryChange = (id: number, startTime: number, endTime: number) => {
  setPhrases(phrases.map(p =>
    p.id === id ? { ...p, startTime, endTime } : p
  ))
}

// Add in JSX after DetectionSettings, before PhraseList:
{phrases.length > 0 && (
  <WaveformPanel
    audioBuffer={engineRef.current.buffer}
    phrases={phrases}
    onPhraseBoundaryChange={handlePhraseBoundaryChange}
  />
)}
```

Note: WaveSurfer needs a URL or Blob to load. Instead of creating a Blob from AudioBuffer, we should use the original file. Adjust the approach — store the original File in App state and pass it to WaveformPanel. Alternatively, convert AudioBuffer to WAV Blob for WaveSurfer:

```typescript
// Add to audioEngine.ts
audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const headerLength = 44
  const totalLength = headerLength + dataLength

  const arrayBuffer = new ArrayBuffer(totalLength)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Interleave channels and write samples
  let offset = 44
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
```

Then update WaveformPanel to use `engine.audioBufferToWav()`.

- [ ] **Step 3: Verify waveform renders**

Upload audio, detect phrases, see the waveform with colored regions. Drag a region boundary.

- [ ] **Step 4: Commit**

```bash
git add src/components/WaveformPanel.tsx src/audio/audioEngine.ts src/App.tsx
git commit -m "feat: add WaveformPanel with WaveSurfer regions"
```

---

## Phase 4: Export

### Task 9: MP3 Encoder Web Worker

**Files:**
- Create: `src/audio/mp3Encoder.worker.ts`
- Create: `src/audio/mp3Encoder.ts`

- [ ] **Step 1: Create Web Worker for MP3 encoding**

```typescript
// src/audio/mp3Encoder.worker.ts
import type { Mp3Encoder } from 'lamejs'

let encoder: Mp3Encoder | null = null

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data

  if (type === 'encode') {
    const { audioData, sampleRate, startSample, endSample } = e.data
    const { default: lamejs } = await import('lamejs')

    const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128)
    const segment = audioData.slice(startSample, endSample)

    // Convert Float32 to Int16
    const int16 = new Int16Array(segment.length)
    for (let i = 0; i < segment.length; i++) {
      const s = Math.max(-1, Math.min(1, segment[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // Encode in chunks of 1152 samples
    const mp3Chunks: Int8Array[] = []
    for (let i = 0; i < int16.length; i += 1152) {
      const chunk = int16.subarray(i, Math.min(i + 1152, int16.length))
      const mp3buf = encoder.encodeBuffer(chunk)
      if (mp3buf.length > 0) mp3Chunks.push(mp3buf)
    }
    const mp3buf = encoder.flush()
    if (mp3buf.length > 0) mp3Chunks.push(mp3buf)

    const blob = new Blob(mp3Chunks, { type: 'audio/mp3' })
    self.postMessage({ type: 'result', blob })
  }
}
```

Note: Web Workers can't use `await import()` at the top level in all browsers. The dynamic import inside the message handler should work. Adjust based on actual lamejs/WWorker compatibility.

- [ ] **Step 2: Create encoder wrapper**

```typescript
// src/audio/mp3Encoder.ts
import { Phrase } from '../types'

export function encodePhraseToMp3(
  audioData: Float32Array,
  sampleRate: number,
  phrase: Phrase
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./mp3Encoder.worker.ts', import.meta.url),
      { type: 'module' }
    )

    const startSample = Math.floor(phrase.startTime * sampleRate)
    const endSample = Math.floor(phrase.endTime * sampleRate)

    worker.onmessage = (e) => {
      if (e.data.type === 'result') {
        resolve(e.data.blob as Blob)
        worker.terminate()
      }
    }
    worker.onerror = (err) => {
      reject(err)
      worker.terminate()
    }

    worker.postMessage({
      type: 'encode',
      audioData,
      sampleRate,
      startSample,
      endSample,
    })
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/audio/mp3Encoder.worker.ts src/audio/mp3Encoder.ts
git commit -m "feat: add MP3 encoder Web Worker"
```

---

### Task 10: Exporter + ExportPanel

**Files:**
- Create: `src/audio/exporter.ts`
- Create: `src/components/ExportPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create exporter**

```typescript
// src/audio/exporter.ts
import { Phrase } from '../types'
import { encodePhraseToMp3 } from './mp3Encoder'

export async function exportPhrases(
  audioData: Float32Array,
  sampleRate: number,
  phrases: Phrase[],
  filePrefix: string,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  // Group by groupId, merge adjacent with same group
  const exportGroups: Phrase[][] = []
  let currentGroup: Phrase[] = []

  for (const phrase of phrases) {
    if (phrase.excluded) {
      if (currentGroup.length > 0) {
        exportGroups.push(currentGroup)
        currentGroup = []
      }
      continue
    }
    if (currentGroup.length > 0 && currentGroup[0].groupId === phrase.groupId) {
      currentGroup.push(phrase)
    } else {
      if (currentGroup.length > 0) exportGroups.push(currentGroup)
      currentGroup = [phrase]
    }
  }
  if (currentGroup.length > 0) exportGroups.push(currentGroup)

  const total = exportGroups.length
  onProgress(0, total)

  for (let i = 0; i < exportGroups.length; i++) {
    const group = exportGroups[i]
    // Merge group into one phrase spanning all
    const mergedPhrase: Phrase = {
      ...group[0],
      startTime: Math.min(...group.map(p => p.startTime)),
      endTime: Math.max(...group.map(p => p.endTime)),
    }

    const blob = await encodePhraseToMp3(audioData, sampleRate, mergedPhrase)

    // Download
    const num = String(i + 1).padStart(2, '0')
    const fileName = `${filePrefix}_${num}.mp3`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)

    onProgress(i + 1, total)
    // Small delay between downloads to avoid browser throttling
    await new Promise(r => setTimeout(r, 200))
  }
}
```

- [ ] **Step 2: Create ExportPanel**

```tsx
// src/components/ExportPanel.tsx
import { ExportProgress } from '../types'

interface Props {
  onExport: () => void
  progress: ExportProgress
}

export function ExportPanel({ onExport, progress }: Props) {
  const isExporting = progress.status === 'encoding'

  return (
    <div className="mb-6 p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center gap-4">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Export all'}
        </button>
        {isExporting && (
          <>
            <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">
              {progress.current}/{progress.total}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into App.tsx**

Add `ExportProgress` to imports, add state and handler:

```tsx
import { exportPhrases } from './audio/exporter'
import { ExportPanel } from './components/ExportPanel'
import { ExportProgress } from './types'

// Inside App:
const [exportProgress, setExportProgress] = useState<ExportProgress>({
  current: 0, total: 0, status: 'idle'
})

const handleExport = async () => {
  const engine = engineRef.current
  if (!engine.buffer || phrases.length === 0) return

  const audioData = engine.getChannelData()
  setExportProgress({ current: 0, total: phrases.length, status: 'encoding' })

  await exportPhrases(
    audioData,
    engine.buffer.sampleRate,
    phrases,
    engine.fileName,
    (current, total) => setExportProgress({ current, total, status: 'encoding' })
  )

  setExportProgress(prev => ({ ...prev, status: 'done' }))
  setTimeout(() => setExportProgress({ current: 0, total: 0, status: 'idle' }), 2000)
}
```

Add `<ExportPanel>` in JSX after PhraseList:

```tsx
{phrases.length > 0 && (
  <ExportPanel onExport={handleExport} progress={exportProgress} />
)}
```

- [ ] **Step 4: Verify export works end-to-end**

Upload audio, detect phrases, click Export. Verify MP3 files download with correct names.

- [ ] **Step 5: Commit**

```bash
git add src/audio/exporter.ts src/components/ExportPanel.tsx src/App.tsx
git commit -m "feat: add MP3 export with sequential downloads"
```

---

## Phase 5: Whisper Integration

### Task 11: Whisper WASM Wrapper

**Files:**
- Create: `src/audio/whisperTranscription.ts`

This task requires research into the current state of whisper.cpp WASM npm packages. The implementation below uses a conceptual API — the exact package and API should be verified during implementation.

- [ ] **Step 1: Research and install whisper WASM package**

Check for the best available package:
- `whisper.cpp` — official bindings
- `@nickkraakman/whisper-wasm` — community wrapper
- `whisper-wasm` — alternative

```bash
npm install <chosen-package>
```

- [ ] **Step 2: Create Whisper transcription module**

```typescript
// src/audio/whisperTranscription.ts
import { Phrase } from '../types'

export interface WhisperResult {
  phrases: Phrase[]
}

export interface WhisperProgress {
  status: 'loading' | 'transcribing' | 'done'
  progress: number  // 0-100
}

// This is a conceptual implementation. The exact API depends on the
// chosen WASM package. Adjust accordingly.
export async function transcribeWithWhisper(
  audioData: Float32Array,
  sampleRate: number,
  model: 'tiny' | 'base' | 'small',
  onProgress: (p: WhisperProgress) => void
): Promise<WhisperResult> {
  onProgress({ status: 'loading', progress: 0 })

  // Load the WASM module and model
  // const whisper = await loadWhisperModel(model)
  // onProgress({ status: 'loading', progress: 50 })

  // Transcribe in 30-second chunks
  // const chunkDuration = 30  // seconds
  // const totalChunks = Math.ceil(audioData.length / sampleRate / chunkDuration)
  // const segments: { start: number; end: number; text: string }[] = []

  // for (let i = 0; i < totalChunks; i++) {
  //   const startSample = i * chunkDuration * sampleRate
  //   const endSample = Math.min((i + 1) * chunkDuration * sampleRate, audioData.length)
  //   const chunk = audioData.slice(startSample, endSample)
  //
  //   const result = await whisper.transcribe(chunk, sampleRate)
  //   for (const seg of result.segments) {
  //     segments.push({
  //       start: seg.start + i * chunkDuration,
  //       end: seg.end + i * chunkDuration,
  //       text: seg.text.trim(),
  //     })
  //   }
  //   onProgress({
  //     status: 'transcribing',
  //     progress: Math.round(((i + 1) / totalChunks) * 100),
  //   })
  // }

  // Convert segments to phrases
  // const phrases: Phrase[] = segments
  //   .filter(s => s.text.length > 0)
  //   .map((s, i) => ({
  //     id: i,
  //     startTime: s.start,
  //     endTime: s.end,
  //     groupId: i,
  //     excluded: false,
  //     transcript: s.text,
  //   }))

  // onProgress({ status: 'done', progress: 100 })
  // return { phrases }

  // Placeholder — actual implementation depends on WASM package
  throw new Error('Whisper WASM integration not yet implemented — requires package research')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/audio/whisperTranscription.ts
git commit -m "feat: add Whisper transcription module skeleton"
```

---

### Task 12: WhisperStatus Component + Integration

**Files:**
- Create: `src/components/WhisperStatus.tsx`
- Modify: `src/components/DetectionSettings.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create WhisperStatus component**

```tsx
// src/components/WhisperStatus.tsx
interface Props {
  status: 'idle' | 'loading' | 'transcribing' | 'done' | 'error'
  progress: number  // 0-100
  errorMessage?: string
}

export function WhisperStatus({ status, progress, errorMessage }: Props) {
  if (status === 'idle') return null

  const label = {
    loading: 'Loading Whisper model...',
    transcribing: 'Transcribing audio...',
    done: 'Transcription complete',
    error: errorMessage ?? 'Error',
  }[status]

  return (
    <div className="mb-4 p-3 bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm mb-1">{label}</p>
          {(status === 'loading' || status === 'transcribing') && (
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <span className="text-sm text-gray-400">{progress}%</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Whisper option to DetectionSettings**

Add method selector to DetectionSettings:

```tsx
// Add to the grid in DetectionSettings, as first row spanning full width:
<label className="flex items-center gap-2 text-sm col-span-2">
  Detection method:
  <select
    value={settings.method}
    onChange={e => update({ method: e.target.value as any })}
    className="px-2 py-1 bg-gray-700 rounded"
  >
    <option value="silence">Silence detection</option>
    <option value="whisper">Whisper transcription</option>
    <option value="both">Both</option>
  </select>
  {settings.method !== 'silence' && (
    <select
      value={settings.whisperModel}
      onChange={e => update({ whisperModel: e.target.value as any })}
      className="px-2 py-1 bg-gray-700 rounded ml-2"
    >
      <option value="tiny">Tiny (39MB, fast)</option>
      <option value="base">Base (74MB, balanced)</option>
      <option value="small">Small (244MB, accurate)</option>
    </select>
  )}
</label>
```

- [ ] **Step 3: Wire Whisper flow into App.tsx**

When `settings.method === 'whisper'` or `'both'`:
- If `'both'`: run silence detection first, then enrich with Whisper
- If `'whisper'`: run Whisper only, get phrases with transcripts

```tsx
import { transcribeWithWhisper, WhisperProgress } from './audio/whisperTranscription'
import { WhisperStatus } from './components/WhisperStatus'

// Inside App:
const [whisperProgress, setWhisperProgress] = useState<{
  status: 'idle' | 'loading' | 'transcribing' | 'done' | 'error'
  progress: number
}>({ status: 'idle', progress: 0 })

// Update handleDetect:
const handleDetect = async () => {
  const engine = engineRef.current
  if (!engine.buffer) return
  const channelData = engine.getChannelData()

  if (settings.method === 'silence') {
    const result = detectPhrases(channelData, engine.buffer.sampleRate, { ...settings })
    setPhrases(result)
  } else if (settings.method === 'whisper') {
    try {
      const result = await transcribeWithWhisper(
        channelData, engine.buffer.sampleRate, settings.whisperModel,
        (p: WhisperProgress) => setWhisperProgress({ status: p.status, progress: p.progress })
      )
      setPhrases(result.phrases)
    } catch (err) {
      setWhisperProgress({ status: 'error', progress: 0 })
    }
  } else { // 'both'
    // Run silence detection first (instant)
    const silenceResult = detectPhrases(channelData, engine.buffer.sampleRate, { ...settings })
    setPhrases(silenceResult)

    // Then enrich with Whisper in background
    try {
      const whisperResult = await transcribeWithWhisper(
        channelData, engine.buffer.sampleRate, settings.whisperModel,
        (p: WhisperProgress) => setWhisperProgress({ status: p.status, progress: p.progress })
      )
      // Merge transcripts into silence-detected phrases
      setPhrases(prev => prev.map((p, i) => ({
        ...p,
        transcript: whisperResult.phrases[i]?.transcript,
      })))
    } catch (err) {
      setWhisperProgress({ status: 'error', progress: 0 })
    }
  }
}
```

Add WhisperStatus in JSX:

```tsx
<WhisperStatus
  status={whisperProgress.status}
  progress={whisperProgress.progress}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/WhisperStatus.tsx src/components/DetectionSettings.tsx src/App.tsx
git commit -m "feat: add Whisper integration with status UI"
```

---

## Phase 6: Polish

### Task 13: Cleanup and Polish

**Files:**
- Modify: various files for cleanup

- [ ] **Step 1: Add cleanup on unmount**

Ensure AudioEngine is destroyed when App unmounts:

```tsx
// In App.tsx, add useEffect for cleanup:
useEffect(() => {
  return () => { engineRef.current.destroy() }
}, [])
```

- [ ] **Step 2: Handle edge cases in App**

- Reset phrases when new file is uploaded
- Disable export when no phrases exist
- Handle empty audio file gracefully

- [ ] **Step 3: Add basic loading/error states**

Show a spinner or message during audio decode, detection, and export.

- [ ] **Step 4: Final manual verification**

Run through the full verification checklist from the spec:

1. Upload a 30-60 minute MP3 audio file from an English textbook
2. Verify silence detection splits into phrases with reasonable boundaries
3. Adjust a boundary by dragging on waveform — verify sync
4. Merge two adjacent phrases — verify one region, one list entry
5. Exclude a phrase — verify it greys out
6. Click play — verify correct segment plays
7. Export — verify MP3 files download with `<original_name>_01.mp3` naming
8. Test in Chrome (primary) and Firefox

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: cleanup, edge cases, and polish"
```

---

## File Map Summary

| File | Responsibility |
|---|---|
| `src/types.ts` | Phrase, DetectionSettings, ExportProgress types |
| `src/audio/silenceDetection.ts` | RMS-based silence detection algorithm |
| `src/audio/audioEngine.ts` | Web Audio API: decode, play, buffer management |
| `src/audio/mp3Encoder.worker.ts` | lamejs in Web Worker |
| `src/audio/mp3Encoder.ts` | Worker wrapper for MP3 encoding |
| `src/audio/exporter.ts` | Orchestrate encode + download |
| `src/audio/whisperTranscription.ts` | Whisper WASM wrapper |
| `src/components/AudioUploader.tsx` | File upload UI |
| `src/components/DetectionSettings.tsx` | Settings form + detect button |
| `src/components/WaveformPanel.tsx` | WaveSurfer.js + regions |
| `src/components/PhraseList.tsx` | Scrollable phrase list |
| `src/components/PhraseCard.tsx` | Individual phrase with controls |
| `src/components/ExportPanel.tsx` | Export button + progress |
| `src/components/WhisperStatus.tsx` | Whisper loading/transcription progress |
| `src/App.tsx` | State management, wiring |

## Verification

After all tasks complete:

1. `npm run dev` — app loads without errors
2. `npm test` — silence detection tests pass
3. Manual: upload a real textbook audio file (30+ min)
4. Manual: detect phrases with silence method — verify reasonable split
5. Manual: merge two phrases, exclude one, adjust a boundary on waveform
6. Manual: export — verify MP3 files download with correct names and content
7. Manual: test in Chrome and Firefox
