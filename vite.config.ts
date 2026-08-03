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
    // The entry chunk was 3.8 MB raw / 1,252 KB gzipped: every one of ~30 tools
    // plus every heavy library, downloaded and parsed before first paint even if
    // the user only opened one tool (TD-004).
    //
    // Two changes work together. The tabs are React.lazy in App.tsx, so each
    // tool becomes its own chunk. These manualChunks then pull the heavy shared
    // libraries out of the entry so they are fetched only by the tools that use
    // them — and, being separate files, stay cached across deploys that only
    // touch app code.
    //
    // Grouped by which tools need them, not one-chunk-per-package: a tool that
    // reads a spreadsheet needs both xlsx and xlsx-js-style, so splitting those
    // apart would just cost an extra request.
    rollupOptions: {
      output: {
        // Only the libraries that are genuinely needed on first paint are named
        // here. Everything else is left to Rollup, deliberately.
        //
        // The object form of manualChunks hoists a named chunk into the entry's
        // preload graph even when the only things importing it are dynamic. An
        // earlier version of this config named vendor-pdf, vendor-spreadsheet,
        // vendor-media and vendor-ai — all imported exclusively by lazy tabs —
        // and every one of them ended up as a <link rel="modulepreload"> on the
        // landing page, adding ~880 KB gzipped that nobody had asked for.
        //
        // Rollup's automatic splitting handles those correctly: a library shared
        // by several lazy tabs becomes its own chunk, fetched on first use.
        manualChunks: {
          // React is on every path.
          'vendor-react': ['react', 'react-dom'],
          // Firebase is imported at module scope by firebase.ts, so it lands on
          // the first-paint path regardless of who uses it.
          //
          // Since the sign-in gate was removed, the only remaining consumer is
          // ProjectSummaryTab's optional cloud sync, which no-ops because
          // `auth.currentUser` is always null. That makes this ~480 KB chunk
          // almost entirely dead weight — see TD-037 for removing it. Kept as a
          // named chunk until then so it stays out of the app bundle.
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    // The warning fires per chunk. With splitting in place the remaining large
    // chunks are deliberate vendor bundles, and the real ceiling is enforced by
    // scripts/check-bundle-budget.mjs against gzipped size, which is what users
    // actually download.
    chunkSizeWarningLimit: 900,
  },
})
