import type { Page } from "@playwright/test";

import type { SceneAdapter, SceneElement } from "./types";

type SceneApi = {
  getSceneElements?: () => SceneElement[] | undefined;
};

type WindowWithSceneApi = Window & Record<string, SceneApi | undefined>;

const parseElements = (raw: string | null): SceneElement[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (element): element is SceneElement =>
        !!element &&
        typeof element === "object" &&
        !(element as { isDeleted?: boolean }).isDeleted,
    );
  } catch {
    return [];
  }
};

const waitForCanvas = (
  page: Page,
  selector: string,
  timeout: number,
): Promise<unknown> =>
  page.locator(selector).waitFor({ state: "visible", timeout });

/**
 * Adapter for hosts that persist the scene to `localStorage` (the stock
 * `excalidraw-app` does, under the `excalidraw` key).
 *
 * @example
 * createLocalStorageSceneAdapter({ elementsKey: "excalidraw" });
 */
export const createLocalStorageSceneAdapter = ({
  elementsKey,
  appStateKey,
  readySelector = "canvas.interactive",
  timeout = 10_000,
}: {
  /** localStorage key holding the serialized elements array. */
  elementsKey: string;
  /** Optional localStorage key holding app state to clear on reset. */
  appStateKey?: string;
  /** Selector that indicates the editor canvas is mounted. */
  readySelector?: string;
  /** Timeout for readiness checks. */
  timeout?: number;
}): SceneAdapter => ({
  async waitUntilReady(page) {
    await waitForCanvas(page, readySelector, timeout);
  },

  async getElements(page) {
    const raw = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      elementsKey,
    );

    return parseElements(raw);
  },

  async reset(page) {
    const keys = [elementsKey, appStateKey].filter(
      (key): key is string => typeof key === "string",
    );

    await page.evaluate((keysToRemove) => {
      for (const key of keysToRemove) {
        window.localStorage.removeItem(key);
      }
    }, keys);
  },
});

/**
 * Adapter for hosts that expose their `ExcalidrawImperativeAPI` on `window`.
 * This is the most direct integration for an app that mounts
 * `@excalidraw/excalidraw` itself.
 *
 * ```tsx
 * <Excalidraw excalidrawAPI={(api) => { window.__EXCALIDRAW_API__ = api; }} />
 * ```
 */
export const createWindowSceneAdapter = ({
  windowKey = "__EXCALIDRAW_API__",
  readySelector = "canvas.interactive",
  timeout = 10_000,
}: {
  /** Global property holding the imperative API. */
  windowKey?: string;
  /** Selector that indicates the editor canvas is mounted. */
  readySelector?: string;
  /** Timeout for readiness checks. */
  timeout?: number;
} = {}): SceneAdapter => ({
  async waitUntilReady(page) {
    await waitForCanvas(page, readySelector, timeout);
    await page.waitForFunction(
      (key) =>
        typeof (window as unknown as WindowWithSceneApi)[key]
          ?.getSceneElements === "function",
      windowKey,
      { timeout },
    );
  },

  async getElements(page) {
    const elements = await page.evaluate((key) => {
      const api = (window as unknown as WindowWithSceneApi)[key];
      return api?.getSceneElements?.() ?? [];
    }, windowKey);

    return elements.filter(
      (element) =>
        !!element &&
        typeof element === "object" &&
        !(element as { isDeleted?: boolean }).isDeleted,
    );
  },
});
