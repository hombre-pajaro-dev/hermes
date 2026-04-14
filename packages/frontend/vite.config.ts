import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    // Output to repo root dist/ regardless of where vite is invoked from
    outDir: resolve(__dirname, '../../dist'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.VITE_API_PORT ?? 3001}`,
    },
  },
})
