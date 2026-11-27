import { expect, test } from "./fixtures/canvasInteractions";

import type { Page } from "playwright/test";

const editorRoot = (page: Page) => page.locator(".excalidraw");

const interactiveCanvas = (page: Page) =>
  page.locator('canvas.interactive[style*="width"]');

async function canvasScreenshot(page: Page) {
  const box = await interactiveCanvas(page).boundingBox();
  if (!box) {
    throw new Error("The interactive drawing canvas is not laid out");
  }

  return page.screenshot({ animations: "disabled", clip: box });
}

async function editorScreenshot(page: Page) {
  const box = await editorRoot(page).boundingBox();
  if (!box) {
    throw new Error("The Excalidraw editor is not laid out");
  }

  return page.screenshot({ animations: "disabled", clip: box });
}

async function openThemeMenu(page: Page) {
  const menu = page.getByTestId("dropdown-menu");
  if (!(await menu.isVisible())) {
    await page.getByTestId("main-menu-trigger").click();
  }
  await expect(menu).toBeVisible();
}

const themeOption = (page: Page, mode: "Light" | "Dark") =>
  page.getByRole("radio", { name: new RegExp(`^${mode} mode`, "i") });

test.describe("canvas interactions", () => {
  test("updates canvas theme colors without changing the common shape", async ({
    openApp,
    setupCommonShape,
    page,
    clearCanvas,
  }) => {
    await openApp();

    try {
      await setupCommonShape();
      const lightScreenshot = await canvasScreenshot(page);
      const lightBackground = await editorRoot(page).evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--default-bg-color").trim(),
      );

      await openThemeMenu(page);
      await themeOption(page, "Dark").check();
      await expect(editorRoot(page)).toHaveClass(/theme--dark/);

      const darkScreenshot = await canvasScreenshot(page);
      const darkBackground = await editorRoot(page).evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--default-bg-color").trim(),
      );

      expect(darkBackground).not.toBe(lightBackground);
      expect(darkScreenshot.toString("base64")).not.toBe(
        lightScreenshot.toString("base64"),
      );
    } finally {
      await clearCanvas();
    }
  });

  test("selects and moves the common shape", async ({
    openApp,
    setupCommonShape,
    page,
    clearCanvas,
  }) => {
    await openApp();

    try {
      const shape = await setupCommonShape();
      const beforeSelection = await editorScreenshot(page);

      await page.keyboard.press("1");
      await expect(page.getByTestId("toolbar-selection")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await page.mouse.move(shape.center.x, shape.center.y);
      await page.mouse.down();
      await page.mouse.move(shape.center.x + 180, shape.center.y + 80);
      await page.mouse.up();

      const afterMove = await editorScreenshot(page);
      expect(afterMove.toString("base64")).not.toBe(
        beforeSelection.toString("base64"),
      );
    } finally {
      await clearCanvas();
    }
  });

  test("deletes the common shape", async ({
    openApp,
    setupCommonShape,
    page,
    clearCanvas,
  }) => {
    await openApp();

    try {
      await setupCommonShape();
      await page.keyboard.press("1");
      await expect(page.getByTestId("toolbar-selection")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const withShape = await editorScreenshot(page);

      await page.keyboard.press("Delete");
      await expect
        .poll(async () => (await editorScreenshot(page)).toString("base64"))
        .not.toBe(withShape.toString("base64"));
    } finally {
      await clearCanvas();
    }
  });

  test("undoes and redoes deletion of the common shape", async ({
    openApp,
    setupCommonShape,
    page,
    clearCanvas,
  }) => {
    await openApp();

    try {
      await setupCommonShape();
      await page.keyboard.press("1");
      await expect(page.getByTestId("toolbar-selection")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const withShape = await editorScreenshot(page);

      await page.keyboard.press("Delete");
      const withoutShape = await editorScreenshot(page);
      expect(withoutShape.toString("base64")).not.toBe(
        withShape.toString("base64"),
      );

      await page.keyboard.press("Control+Z");
      await expect
        .poll(async () => (await editorScreenshot(page)).toString("base64"))
        .not.toBe(withoutShape.toString("base64"));

      await page.keyboard.press("Control+Y");
      await expect
        .poll(async () => (await editorScreenshot(page)).toString("base64"))
        .not.toBe(withShape.toString("base64"));
    } finally {
      await clearCanvas();
    }
  });
});
