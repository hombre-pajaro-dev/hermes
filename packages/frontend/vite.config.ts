import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Output to repo root dist/ so Vercel's outputDirectory: "dist" resolves correctly.
    // A nested outputDirectory like "packages/frontend/dist" confuses Vercel's builder
    // into searching for a Node.js entrypoint instead of serving static files.
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.VITE_API_PORT ?? 3001}`,
    },
  },
})
