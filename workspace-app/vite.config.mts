import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgrPlugin from "vite-plugin-svgr";

const pkg = (p: string) => path.resolve(__dirname, "../packages", p);
const apiTarget = process.env.WORKSPACE_API_URL || "http://127.0.0.1:3100";

// The editor packages are consumed from source, exactly like excalidraw-app.
export default defineConfig({
  envDir: __dirname,
  publicDir: "../public",
  server: {
    port: Number(process.env.WORKSPACE_PORT || 3002),
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false, ws: true },
      "/health": { target: apiTarget },
      // key-authenticated public API + MCP endpoint (same origin as the app in dev)
      "/public": { target: apiTarget },
      "/mcp": { target: apiTarget },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@excalidraw\/common$/,
        replacement: pkg("common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: pkg("common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: pkg("element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: pkg("element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: pkg("excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: pkg("excalidraw/$1"),
      },
      { find: /^@excalidraw\/math$/, replacement: pkg("math/src/index.ts") },
      { find: /^@excalidraw\/math\/(.*?)/, replacement: pkg("math/src/$1") },
      { find: /^@excalidraw\/utils$/, replacement: pkg("utils/src/index.ts") },
      { find: /^@excalidraw\/utils\/(.*?)/, replacement: pkg("utils/src/$1") },
      {
        find: /^@excalidraw\/fractional-indexing$/,
        replacement: pkg("fractional-indexing/src/index.ts"),
      },
      {
        find: /^@excalidraw\/laser-pointer$/,
        replacement: pkg("laser-pointer/src/index.ts"),
      },
    ],
  },
  build: {
    outDir: "build",
    sourcemap: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("packages/excalidraw/locales") &&
            !id.match(/en.json|percentages.json/)
          ) {
            return `locales/${id.substring(id.indexOf("locales/") + 8)}`;
          }
          if (id.includes("@excalidraw/mermaid-to-excalidraw")) {
            return "mermaid-to-excalidraw";
          }
        },
      },
    },
  },
  plugins: [react(), svgrPlugin()],
});
