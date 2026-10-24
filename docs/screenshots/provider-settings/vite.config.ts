import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  publicDir: path.resolve(root, '../../../public'),
  resolve: {
    alias: { '@': path.resolve(root, '../../../src') },
  },
  server: { port: 5199, strictPort: true },
})
