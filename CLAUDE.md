# 3D Keychain Maker v2

Next.js 16 + React 19 + Tailwind v4 + TypeScript.

## Stack
- Three.js for 3D preview (client-side only, `"use client"` + `ssr: false`)
- OpenType.js for font glyph extraction
- ClipperLib for polygon offsetting
- STL + Bambu-compatible 3MF export

## Key Rules
- All 3D/canvas components must be `"use client"` with dynamic import `ssr: false`
- No SSR for Three.js, OpenType, or ClipperLib
- Tailwind v4: CSS-first config, no tailwind.config.js

