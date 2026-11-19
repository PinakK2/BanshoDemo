import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    // One JS file, so the build can also be published as a single page.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
