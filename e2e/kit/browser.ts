import fs from "node:fs/promises";

import type { Download, Locator, Page } from "@playwright/test";

/**
 * Force the app down its "legacy" download path by removing the File System
 * Access API. Without this, browsers that support `showSaveFilePicker` never
 * emit a Playwright `download` event.
 *
 * Must be called before `page.goto()`.
 */
export const forceLegacyDownloads = async (page: Page) => {
  await page.addInitScript(() => {
    const scope = window as unknown as Record<string, unknown>;
    delete scope.showOpenFilePicker;
    delete scope.showSaveFilePicker;
  });
};

/** Set an `<input type="range">` value and dispatch the events React expects. */
export const setRangeValue = async (locator: Locator, value: number) => {
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
};

/** Read the raw bytes of a Playwright download. */
export const getDownloadBytes = async (download: Download) => {
  const path = await download.path();
  if (!path) {
    throw new Error("Download has no local path");
  }

  return fs.readFile(path);
};
