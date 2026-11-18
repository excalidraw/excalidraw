# Pluggable Playwright E2E kit

This directory is a proof-of-concept browser suite for Excalidraw. It is built around a small, reusable kit (`e2e/kit`) rather than around any specific app feature. Shape coverage is the primary suite.

## Why a kit instead of raw specs

The kit separates three concerns:

1. **Input** — how to activate tools and draw (keyboard + mouse).
2. **Reading the scene** — a `SceneAdapter` you plug in for your host app.
3. **Assertions** — polling helpers that wait for persisted scene state.

Because of that split, the same specs can run against the stock `excalidraw-app`, a custom app that embeds `@excalidraw/excalidraw`, or a future host with a completely different persistence layer.

## Quick start

```sh
yarn test:e2e:install # one-time Chromium download
yarn test:e2e
yarn test:e2e:ui      # interactive mode
yarn test:e2e:report  # open the last HTML report
```

The config starts the Vite dev server automatically on port `3000` (override with `PLAYWRIGHT_PORT`).

## Using the kit

Create a Playwright `test` object and pass an adapter factory:

```ts
import { createExcalidrawTest, createLocalStorageSceneAdapter } from "./kit";

export const test = createExcalidrawTest(() =>
  createLocalStorageSceneAdapter({ elementsKey: "excalidraw" }),
);

test("draws a rectangle", async ({ editor }) => {
  await editor.open();
  await editor.drawRectangle();
  await editor.waitForElementType("rectangle", 1);
});
```

The `editor` fixture exposes drawing helpers (`drawRectangle`, `drawEllipse`, `drawDiamond`, `drawArrow`, `drawLine`, `drawFreedraw`, `drawText`, `drawFrame`, and the generic `drawShape`), scene reads (`getElements`, `getElementsByType`), polling (`waitForElementCount`, `waitForElementType`), and `clear()`.

## Plugging in your own app

Implement `SceneAdapter` (see `e2e/kit/types.ts`):

```ts
import type { SceneAdapter } from "./kit";

export const myAdapter: SceneAdapter = {
  async waitUntilReady(page) {
    await page.locator("[data-my-editor]").waitFor();
  },
  async getElements(page) {
    return page.evaluate(() => window.myApp.getScene());
  },
};
```

Then:

```ts
export const test = createExcalidrawTest(() => myAdapter);
```

Two adapters ship with the kit:

- `createLocalStorageSceneAdapter` — reads the persisted elements array from `localStorage` (used by `excalidraw-app`).
- `createWindowSceneAdapter` — reads from an `ExcalidrawImperativeAPI` exposed on `window` (e.g. `window.__EXCALIDRAW_API__`).

If your app remaps tool shortcuts, pass `toolKeys` through the driver options:

```ts
export const test = createExcalidrawTest(
  () => createLocalStorageSceneAdapter({ elementsKey: "scene" }),
  { toolKeys: { rectangle: "2", ellipse: "4" } },
);
```

## CI

`.github/workflows/playwright.yml` runs on pull requests (`opened`, `synchronize`, `reopened`) and can also be triggered manually with `workflow_dispatch`. Manual runs accept an optional `pr_number` input to post (or update) a detailed report comment on that PR; leave it empty to skip the comment. On pull requests the report comment is posted automatically. Artifacts (`playwright-report`, `test-results`) are uploaded on every run.

The PR comment is generated from `playwright-report/results.json`, so it includes the same summary and failure details as `yarn playwright show-report`, plus direct links to the uploaded HTML report and raw artifacts. Note that GitHub gives fork PRs a read-only `GITHUB_TOKEN`; commenting works for same-repo PRs, while fork PRs may need a write-token setting or a follow-up `workflow_run` workflow.

The config currently records trace, screenshots, and video for **all** tests so the POC is easy to inspect. This is intentionally heavy; tighten it later.

## Current specs

- `smoke.spec.ts` — editor mounts and the adapter reads an empty scene.
- `shapes.spec.ts` — one test per shape, plus multi-shape and clear checks.
