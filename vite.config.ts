
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
  build: {
    outDir: 'dist',
  },
})
