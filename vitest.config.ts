import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
    environment: "jsdom",
    coverage: {
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 68,
        statements: 70,
      },
    },
  },
});
