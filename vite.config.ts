
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: This must match your GitHub repository name exactly.
  // If your repo is https://username.github.io/my-cool-tool/, this must be '/my-cool-tool/'
  base: '/-Excel-helper/', 
  build: {
    outDir: 'dist',
  }
})
