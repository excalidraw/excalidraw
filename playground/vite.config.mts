import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const entries = {
  common: "packages/common/src/index.ts",
  element: "packages/element/src/index.ts",
  excalidraw: "packages/excalidraw/index.tsx",
  "fractional-indexing": "packages/fractional-indexing/src/index.ts",
  "laser-pointer": "packages/laser-pointer/src/index.ts",
  math: "packages/math/src/index.ts",
  utils: "packages/utils/src/index.ts",
};

const fromRoot = (file: string) => path.resolve(__dirname, "..", file);

export default defineConfig({
  root: __dirname,
  base: "./",
  resolve: {
    alias: Object.entries(entries).flatMap(([name, entry]) => [
      {
        find: new RegExp(`^@excalidraw/${name}$`),
        replacement: fromRoot(entry),
      },
      {
        find: new RegExp(`^@excalidraw/${name}/`),
        replacement: `${fromRoot(path.dirname(entry))}/`,
      },
    ]),
  },
  plugins: [react()],
});
