import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/-Excel-helper/',
  plugins: [
    react(),
    nodePolyfills({
      include: ['stream', 'events', 'buffer', 'process', 'util', 'path', 'crypto', 'fs'],
    }),
  ],
  resolve: {
    alias: {
      // TD-001 — CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS).
      //
      // SheetJS left the public npm registry. `xlsx@0.18.5` is the last version
      // ever published there and is permanently vulnerable; the fixes exist only
      // in 0.19.3+ on cdn.sheetjs.com. This app parses untrusted user uploads at
      // 26 call sites, so the advisory's "export-only workflows are unaffected"
      // carve-out does not apply to it.
      //
      // `@e965/xlsx` is a maintained npm republish of upstream SheetJS 0.20.3,
      // which is past both fixes. Aliasing rather than rewriting the 26 imports
      // keeps this a one-line change and a one-line revert, and keeps the
      // dependency visible to `npm audit` and Dependabot — which a CDN tarball
      // URL in package.json would not be, and that blindness is exactly what let
      // this CVE sit unnoticed in the first place.
      //
      // Full analysis: docs/quality/dependency-analysis-xlsx.md
      xlsx: '@e965/xlsx',
    },
  },
  build: {
    outDir: 'dist',
  },
})
