import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { criarAliases } from './aliases.js'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: criarAliases(path, __dirname),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined, // Let Vite optimize automatically
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },   // permite servir packages/diagram-engine (fora de frontend/)
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
