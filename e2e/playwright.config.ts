import path from "node:path";

import { defineConfig } from "@playwright/test";

/**
 * End-to-end journeys against a throw-away stack: its own MongoDB database, storage folder and ports,
 * so it never touches (or is disturbed by) a dev instance. Uses the machine's installed Chrome.
 *
 *   yarn test:e2e            # needs MongoDB on 127.0.0.1:27017
 */
const API_PORT = 3110;
const WEB_PORT = 3012;
export const E2E_DB = "excalidraw_workspace_e2e";
const root = path.resolve(__dirname, "..");

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts/,
  globalTeardown: path.join(__dirname, "teardown.ts"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "yarn --cwd server start",
      cwd: root,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        MONGODB_DB: E2E_DB,
        SESSION_SECRET: "e2e-session-secret-e2e-session-secret-1234",
        ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
        STORAGE_PATH: path.join(root, "server", "storage-e2e"),
        AUTH_RATE_LIMIT_MAX: "1000",
        ENABLE_MCP: "true",
        AI_ALLOW_PRIVATE_BASE_URLS: "true",
      },
    },
    {
      command: "yarn --cwd workspace-app dev --host 127.0.0.1",
      cwd: root,
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        WORKSPACE_PORT: String(WEB_PORT),
        WORKSPACE_API_URL: `http://127.0.0.1:${API_PORT}`,
      },
    },
  ],
});
