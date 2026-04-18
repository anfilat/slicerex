# PWA Support for Slicerex

## Goal

Make Slicerex installable and fully functional offline after first visit.

## Approach

Use `vite-plugin-pwa` (Workbox-based) to auto-generate service worker and web app manifest at build time. No manual SW maintenance.

## Components

### Web App Manifest (`public/manifest.webmanifest`)

- App name: "Slicerex"
- Display: standalone
- Theme/background color matching app UI (bg-gray-50 = #F9FAFB)
- Icons: placeholder SVG-based PNGs at 192x192 and 512x512 in `public/`

### Service Worker (`vite-plugin-pwa` config in `vite.config.ts`)

- `registerType: 'autoUpdate'` — updates apply on next visit automatically
- `generateSW` strategy with `globPatterns` to precache all built assets (JS, CSS, HTML, images, fonts, wasm)
- MP3 encoder worker is part of build output and gets precached automatically

### HTML Updates (`index.html`)

- `<link rel="manifest" href="/slicerex/manifest.webmanifest">`
- `<meta name="theme-color" content="#F9FAFB">`
- Apple touch icon link

### SW Registration (`src/main.tsx`)

- Import `virtual:pwa-register` and call `registerSW()`

## What Gets Cached

All static assets from the Vite build (hashed JS/CSS bundles, HTML, images). User-uploaded audio files are processed in-memory and don't need caching.

## What Doesn't Need Special Handling

- No custom offline page — the entire app is precached
- No runtime caching strategies — no API calls to cache
- No background sync or push notifications
