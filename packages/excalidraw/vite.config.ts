import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./index.tsx', import.meta.url)),
      name: 'Excalidraw',
      fileName: (format) => `excalidraw.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
});
