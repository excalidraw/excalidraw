import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration (proof of concept).
 *
 * Unlike the Vitest suite, these tests run against a real browser and the real
 * Vite dev server, so they can cover things jsdom can't: canvas rendering,
 * real clipboard/download APIs, and cross-browser behavior.
 *
 * Run locally:
 *   yarn test:e2e:install   # one-time, downloads Chromium
 *   yarn test:e2e
 *   yarn test:e2e:ui        # interactive mode
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // The app is stateful and most specs touch the canvas, so keep the default
  // run deterministic. Individual specs can opt into parallelism later.
  fullyParallel: false,
  workers: isCI ? 1 : undefined,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: isCI
    ? [
        ["github"],
        ["html", { open: "never" }],
        // Machine-readable output consumed by the PR-comment script.
        ["json", { outputFile: "playwright-report/results.json" }],
      ]
    : [
        ["list"],
        ["html", { open: "never" }],
        ["json", { outputFile: "playwright-report/results.json" }],
      ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // POC: record everything so successful runs are inspectable too. This is
    // intentionally heavy and should be tightened later, e.g.
    // trace: "on-first-retry", screenshot: "only-on-failure",
    // video: "retain-on-failure".
    trace: "on",
    screenshot: "on",
    video: "on",
    // Linux CI containers need this for Chromium sandboxing.
    launchOptions: { args: ["--no-sandbox"] },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A larger viewport keeps the canvas and export dialog fully visible.
        viewport: { width: 1400, height: 950 },
      },
    },
  ],
  webServer: {
    command: `yarn --cwd excalidraw-app vite --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
