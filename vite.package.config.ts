import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

export default defineConfig({
  plugins: [
    {
      name: 'build-packages-first',
      async config() {
        // First build all packages
        await Promise.all([
          execSync('cd packages/common && yarn build', { stdio: 'inherit' }),
          execSync('cd packages/math && yarn build', { stdio: 'inherit' }),
          execSync('cd packages/excalidraw && yarn build', { stdio: 'inherit' })
        ]);
      }
    },
    react()
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./packages/excalidraw/src/index.tsx', import.meta.url)),
      name: 'Excalidraw',
      fileName: (format) => `excalidraw.${format}.js`
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
  }
});
