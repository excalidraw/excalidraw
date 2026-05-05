import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Backend-only tests; avoid repo setupTests.ts (pulls @excalidraw/* workspace packages).
    environment: "node",
  },
});
