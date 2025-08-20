import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Get canvas server URL from environment with fallback
const EXPRESS_SERVER_URL = process.env.VITE_EXPRESS_SERVER_URL || 'http://localhost:3000';
const WS_SERVER_URL = EXPRESS_SERVER_URL.replace(/^https?/, 'ws');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5002,
    open: true,
    proxy: {
      '/api': {
        target: EXPRESS_SERVER_URL,
        changeOrigin: true,
      },
      '/health': {
        target: EXPRESS_SERVER_URL,
        changeOrigin: true,
      },
      // WebSocket proxy for development
      '/ws': {
        target: WS_SERVER_URL,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@excalidraw\/common$/,
        replacement: path.resolve(__dirname, "../packages/common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: path.resolve(__dirname, "../packages/element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(__dirname, "../packages/math/src/index.ts"),
      },
      {
        find: /^@excalidraw\/math\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/math/src/$1"),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(__dirname, "../packages/utils/src/index.ts"),
      },
      {
        find: /^@excalidraw\/utils\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
      },
    ],
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
  publicDir: "../public",
})