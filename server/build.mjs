// Bundles the API into ONE self-contained file (no node_modules needed at runtime):
//   yarn --cwd server build   ->   server/dist/server.mjs
//   NODE_ENV=production node server/dist/server.mjs
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  // some CommonJS dependencies call require() on Node built-ins
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
