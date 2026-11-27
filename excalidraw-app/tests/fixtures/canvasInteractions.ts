import { test as base, expect } from "playwright/test";

import type { Page } from "playwright/test";

export type CommonShapeBounds = {
  center: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type CanvasInteractionFixtures = {
  openApp: () => Promise<void>;
  setupCommonShape: () => Promise<CommonShapeBounds>;
  clearCanvas: () => Promise<void>;
};

const interactiveCanvas = (page: Page) =>
  page.locator('canvas.interactive[style*="width"]');

export const test = base.extend<CanvasInteractionFixtures>({
  context: async ({ browser }, use) => {
    const context = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      viewport: { width: 1280, height: 800 },
    });

    await use(context);
    await context.close();
  },

  openApp: async ({ page, baseURL }, use) => {
    await use(async () => {
      await page.goto(baseURL ?? "/");
      await expect(page.getByTestId("toolbar-rectangle")).toBeVisible();
      await expect(page.getByTestId("main-menu-trigger")).toBeVisible();
    });
  },

  setupCommonShape: async ({ page }, use) => {
    await use(async () => {
      await page.getByTestId("toolbar-rectangle").click();
      await expect(page.getByTestId("toolbar-rectangle")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      const canvas = interactiveCanvas(page);
      const box = await canvas.boundingBox();
      if (!box) {
        throw new Error("The interactive drawing canvas is not laid out");
      }

      const start = { x: box.x + 220, y: box.y + 180 };
      const end = { x: box.x + 420, y: box.y + 300 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y);
      await page.mouse.up();

      return {
        start,
        end,
        center: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
      };
    });
  },

  clearCanvas: async ({ page }, use) => {
    await use(async () => {
      const menu = page.getByTestId("dropdown-menu");
      if (!(await menu.isVisible())) {
        await page.getByTestId("main-menu-trigger").click();
      }

      await expect(menu).toBeVisible();
      await page.getByTestId("clear-canvas-button").click();

      const dialog = page
        .getByRole("dialog")
        .filter({ hasText: "Clear canvas" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Confirm" }).click();
      await expect(dialog).not.toBeVisible();
    });
  },
});

export { expect };
