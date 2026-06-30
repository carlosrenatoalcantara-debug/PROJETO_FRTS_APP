import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        './vitest.config.js',
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // P3: motor de diagramas compartilhado (mesmos aliases do vite.config)
      '@diagram-engine/symbols': path.resolve(__dirname, '../packages/diagram-engine/src/symbols.js'),
      '@diagram-engine/geometry': path.resolve(__dirname, '../packages/diagram-engine/src/geometry.js'),
      '@diagram-engine': path.resolve(__dirname, '../packages/diagram-engine/index.js'),
    }
  }
});
