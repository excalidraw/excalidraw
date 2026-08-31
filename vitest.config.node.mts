import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mts";

/**
 * Runs the headless-import tests in a real Node environment: no jsdom, and no
 * `setupTests.ts` (which itself requires a DOM). This is the only way to prove
 * that the export pipeline can be imported outside a browser realm — under
 * jsdom every browser global exists, so module-scope access to `document` /
 * `window` / `navigator` passes silently.
 *
 * NOTE: reuses only the package aliases from the base config. It deliberately
 * does not `mergeConfig`, which would concatenate `setupFiles` and pull the
 * DOM-dependent setup back in.
 */
export default defineConfig({
  resolve: baseConfig.resolve,
  test: {
    name: "node",
    environment: "node",
    globals: true,
    include: ["packages/excalidraw/tests/node/**/*.test.ts"],
  },
});
