# Slicerex

**[Try it live](https://anfilat.github.io/slicerex/)**

Browser-based audio phrase splitter. Upload an audio file, automatically detect phrases using silence detection, edit the results, and export individual phrases as MP3 files. Everything runs client-side — no server required.

Built to prepare audio tracks for [Repeit](https://github.com/anfilat/repeit) — a tool for language learning through spaced repetition of audio phrases.

## Features

- **Silence-based phrase detection** — configurable threshold, minimum silence/phrase duration, and padding
- **Interactive waveform** — visualize audio with draggable phrase boundaries (WaveSurfer.js)
- **Phrase editing** — merge adjacent phrases, split phrases at midpoint, exclude phrases from export
- **Playback** — play individual phrases, play next in sequence
- **MP3 export** — export non-excluded phrases as numbered MP3 files via a Web Worker (lamejs)
- **Works offline** — PWA with service worker caching

## Usage

1. Upload an audio file (any format supported by Web Audio API)
2. Adjust detection settings if needed (silence threshold, durations, padding)
3. Click **Detect phrases**
4. Review and edit results — drag boundaries on the waveform, merge/split/exclude phrases
5. Click **Export** to download each phrase as a numbered MP3 file

## Development

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + production build
npm run test         # Run tests
npm run lint         # Lint
npm run format       # Format code
```

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS 4, WaveSurfer.js 7, lamejs, Vitest
