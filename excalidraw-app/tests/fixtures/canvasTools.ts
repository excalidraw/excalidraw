import { test as base, expect } from "playwright/test";

type CanvasToolFixtures = {
  /** Opens a fresh app context and waits for the editor toolbar. */
  openApp: () => Promise<void>;
  /** Clears the scene through the application UI and confirms the action. */
  clearCanvas: () => Promise<void>;
};

export const test = base.extend<CanvasToolFixtures>({
  // Each test receives a new context, including clean localStorage and
  // cookies, so scene state cannot leak between tests.
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
      await expect(page.getByTestId("toolbar-selection")).toBeVisible();
    });
  },

  clearCanvas: async ({ page }, use) => {
    await use(async () => {
      const menuTrigger = page.getByTestId("main-menu-trigger");
      const menu = page.getByTestId("dropdown-menu");

      if (!(await menu.isVisible())) {
        await menuTrigger.click();
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
