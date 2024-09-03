import { defineConfig } from "vitest/config";
import { woff2BrowserPlugin } from "./scripts/woff2/woff2-vite-plugins";

export default defineConfig({
  //@ts-ignore
  plugins: [woff2BrowserPlugin()],
  test: {
    // Since hooks are running in stack in v2, which means all hooks run serially whereas
    // we need to run them in parallel
    sequence: {
      hooks: 'parallel',
    },
    setupFiles: ["./setupTests.ts"],
    globals: true,
    environment: "jsdom",
    coverage: {
      reporter: ["text", "json-summary", "json", "html", "lcovonly"],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 68,
        statements: 70,
      },
      // Since v2, it ignores empty lines by default and we need to disable it as it affects the coverage
      ignoreEmptyLines: false
    },
  },
});
