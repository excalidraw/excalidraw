import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'ExcalidrawMath',
      fileName: () => 'index.js', // Changed to match package.json
    },
    outDir: 'dist/prod', // Added to match package.json
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        format: 'es' // Still produces ESM; UMD needs separate config if required
      },
      onwarn: (warning, warn) => {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      }
    }
  }
});