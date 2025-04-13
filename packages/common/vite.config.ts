import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'path';

console.log('Alias set to:', path.resolve(__dirname, '../math/dist/math.es.js'));

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'ExcalidrawCommon',
      fileName: (format) => `common.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        format: 'es'
      },
      onwarn: (warning, warn) => {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      }
    }
  },
  resolve: {
    alias: {
      '@excalidraw/math': path.resolve(__dirname, '../math/dist/math.es.js')
    }
  }
});