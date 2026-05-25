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

**Data flow:** Upload audio → decode to AudioBuffer → detect phrases (silence-based) → edit in UI (merge/split/exclude/adjust boundaries) → export as MP3 files.

**State management** is centralized in `src/App.tsx` via React hooks. The `AudioEngine` instance lives in a ref and persists across renders (with `destroy()` cleanup on unmount). All phrase state (`Phrase[]`) flows down to components via props; user actions flow up via callbacks.

**Three layers:**

- `src/audio/` — Pure audio logic (no React). `AudioEngine` wraps Web Audio API (decode, play, getChannelData for mono Float32Array with caching). `silenceDetection` is a pure function `detectPhrases(audioData, sampleRate, config) → Phrase[]`. `phraseMutations` provides pure functions `mergePhrase`, `splitPhrase`, `toggleExclude` for phrase editing. MP3 encoding runs in a Web Worker (`mp3Encoder.worker.ts`) via `lamejs` to avoid blocking the UI.
- `src/components/` — React UI. `WaveformPanel` integrates WaveSurfer.js v7 with Regions, Zoom, and Timeline plugins for interactive waveform with draggable phrase boundaries. Bidirectional sync: dragging a region boundary updates the phrase list, and merging/excluding phrases updates the waveform regions.
- `src/types.ts` — Core data model. `Phrase` has `id`, `startTime`, `endTime`, and `excluded`.

**Phrase editing model:** Users can merge adjacent phrases (combining into one with a new ID), split a phrase at its midpoint (creating two new phrases), and toggle exclusion. Excluded phrases are skipped during export. The exporter in `src/audio/exporter.ts` exports each non-excluded phrase individually as MP3 files, downloading sequentially as `<original_name>_01.mp3`, `<original_name>_02.mp3`, etc.

**Export pipeline:** `exportPhrases()` filters non-excluded phrases → `getExportItems()` computes sample boundaries and filenames → for each item, `encodeSegmentToMp3()` slices the audio data, spawns a worker (with transferable objects for zero-copy), worker converts Float32→Int16, encodes with lamejs → returns MP3 Blob → triggers download. Worker errors are checked and surfaced as `'error'` status.

## Key Design Decisions

- Workers are ES module workers (`{ type: 'module' }`), configured in `vite.config.ts` with `worker: { format: 'es' }`.
- `AudioEngine.getChannelData()` caches the mono downmix to avoid reallocating large buffers on repeated calls.
- `AudioEngine.playSegment()` uses a `playbackId` counter to prevent race conditions from rapid play/stop clicks, plus a safety timeout for browsers where `onended` may not fire.
- `phraseMutations.ts` is a pure module (no React) so merge/split/toggle logic can be tested independently.
- `usePersistedState` hook persists detection settings to `localStorage` with graceful fallback if storage is unavailable.
- Tailwind CSS v4 uses `@tailwindcss/vite` plugin only — no PostCSS config or tailwind.config.js needed.
- PWA via `vite-plugin-pwa` with auto-update registration in `src/main.tsx`. No manifest file — Workbox handles caching with `globPatterns` for static assets.
- App is deployed under `base: '/slicerex'` in Vite config.
- Pre-commit hook via `simple-git-hooks`: runs lint, format check, and tests.

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS 4, WaveSurfer.js 7, lamejs, Vitest, oxlint, oxfmt

## Tests

Test files: `src/audio/silenceDetection.test.ts`, `src/audio/mp3Encoder.test.ts`, `src/audio/phraseMutations.test.ts`

There is a test audio file at test/test_audio.mp3
