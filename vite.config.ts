import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@excalidraw/excalidraw': fileURLToPath(
        new URL('node_modules/@excalidraw/excalidraw/dist/excalidraw.production.min.js', import.meta.url)
      ),
      '@excalidraw/excalidraw/types': fileURLToPath(
        new URL('node_modules/@excalidraw/excalidraw/dist/types', import.meta.url)
      )
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  server: {
    port: 3000,
    open: true,
    strictPort: true,
    hmr: {
      overlay: false
    },
    headers: {
      'Content-Type': 'text/javascript',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  css: {
    preprocessorOptions: {
      css: {
        additionalData: `@import './src/styles/excalidraw-overrides.css';`
      }
    }
  },
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
    exclude: ['@excalidraw/excalidraw/dist/excalidraw.production.min.js']
  }
});