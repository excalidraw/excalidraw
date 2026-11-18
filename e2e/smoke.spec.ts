import { expect } from "@playwright/test";

import { createExcalidrawTest, createLocalStorageSceneAdapter } from "./kit";

/**
 * Smoke test for the generic kit. It proves the adapter can mount the editor
 * and read an empty scene, without touching export or any other feature.
 */
const test = createExcalidrawTest(() =>
  createLocalStorageSceneAdapter({ elementsKey: "excalidraw" }),
);

test("loads the editor with an empty scene", async ({ editor, page }) => {
  await editor.open();

  await expect(page.locator("canvas.interactive")).toBeVisible();
  await editor.waitForElementCount(0);
});
