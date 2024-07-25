import { defineConfig } from "vitest/config";
import { woff2BrowserPlugin } from "./scripts/woff2/woff2-vite-plugins";

export default defineConfig({
  plugins: [
    woff2BrowserPlugin(),
  ],
  test: {
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
    },
  },
});
