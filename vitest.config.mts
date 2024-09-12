import { defineConfig } from "vitest/config";
import { woff2BrowserPlugin } from "./scripts/woff2/woff2-vite-plugins";

export default defineConfig({
  //@ts-ignore
  plugins: [woff2BrowserPlugin()],
  test: {
    // Since hooks are running in stack in v2, which means all hooks run serially whereas
    // we need to run them in parallel
    sequence: {
      hooks: "parallel",
    },
    setupFiles: ["./setupTests.ts"],
    globals: true,
    environment: "jsdom",
    coverage: {
      reporter: ["text", "json-summary", "json", "html", "lcovonly"],
      // Since v2, it ignores empty lines by default and we need to disable it as it affects the coverage
      // Additionally the thresholds also needs to be updated slightly as a result of this change
      ignoreEmptyLines: false,
      thresholds: {
        lines: 66,
        branches: 70,
        functions: 63,
        statements: 66,
      },
    },
  },
});
