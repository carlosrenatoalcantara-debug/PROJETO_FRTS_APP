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
        // FV-QA-REAL: alvo configuravel para apontar o dev server ao backend
        // de QA publicado. O proxy e server-side, entao a chamada nao passa
        // por CORS — o navegador so fala com o proprio dev server.
        // Sem a variavel, o comportamento e exatamente o de antes.
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5001',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
