import { test as base } from "@playwright/test";

import { ExcalidrawDriver } from "./driver";

import type { Page } from "@playwright/test";
import type { ExcalidrawDriverOptions } from "./driver";
import type { SceneAdapter } from "./types";

export type ExcalidrawFixtures = {
  editor: ExcalidrawDriver;
};

/**
 * Create a Playwright `test` object with an `editor` fixture wired to your
 * app. This is the main "plug" point: pass a factory that returns a
 * {@link SceneAdapter} for each page.
 *
 * @example
 * export const test = createExcalidrawTest(() =>
 *   createLocalStorageSceneAdapter({ elementsKey: "excalidraw" }),
 * );
 */
export const createExcalidrawTest = (
  createAdapter: (page: Page) => SceneAdapter,
  options?: ExcalidrawDriverOptions,
) =>
  base.extend<ExcalidrawFixtures>({
    editor: async ({ page }, use) => {
      await use(new ExcalidrawDriver(page, createAdapter(page), options));
    },
  });
