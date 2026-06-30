import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // P3-EV-UNIFILAR-ENGINE-01: motor de diagramas compartilhado (neutro EV/FV/BESS)
      // Subpaths primeiro (mais específicos): símbolos e geometria como módulos próprios.
      '@diagram-engine/symbols': path.resolve(__dirname, '../packages/diagram-engine/src/symbols.js'),
      '@diagram-engine/geometry': path.resolve(__dirname, '../packages/diagram-engine/src/geometry.js'),
      '@diagram-engine': path.resolve(__dirname, '../packages/diagram-engine/index.js'),
    },
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
