import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@marketplace/contracts': path.resolve(root, '../shared/schemas/index.ts'),
    },
  },
  server: {
    port: 5102,
    proxy: {
      '/api': { target: 'http://localhost:3102', changeOrigin: true },
      '/ws': {
        target: 'ws://localhost:3102',
        ws: true,
      },
    },
  },
})
