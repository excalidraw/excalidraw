import { defineConfig, devices } from "playwright/test";

const PORT = Number(process.env.VITE_APP_PORT ?? 3001);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Browser-based integration runner.
 *
 * Specs use the `*.e2e.ts` suffix so Vitest (which matches `*.test.*` and
 * `*.spec.*`) never picks them up, while this config matches only `*.e2e.ts`
 * so Playwright never collects the Vitest suites.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  testIgnore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  outputDir: "/tmp/opencode/playwright-results",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "yarn --cwd ./excalidraw-app vite",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
