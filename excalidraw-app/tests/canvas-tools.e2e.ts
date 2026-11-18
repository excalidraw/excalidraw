import { expect, test } from "./fixtures/canvasTools";

import type { Page } from "playwright/test";

type Tool = "rectangle" | "ellipse" | "arrow" | "line" | "text" | "selection";

const toolButton = (page: Page, tool: Tool) =>
  page.getByTestId(`toolbar-${tool}`);

const drawingCanvas = (page: Page) =>
  page.locator('canvas.interactive[style*="width"]');

async function selectTool(page: Page, tool: Tool) {
  const button = toolButton(page, tool);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function draw(page: Page, tool: Exclude<Tool, "selection">) {
  await selectTool(page, tool);

  const canvas = drawingCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("The interactive drawing canvas is not laid out");
  }

  const start = { x: box.x + 180, y: box.y + 160 };
  const end = { x: box.x + 380, y: box.y + 280 };

  if (tool === "text") {
    await page.mouse.click(start.x, start.y);
    await page.keyboard.type("Browser drawing test");
    await page.keyboard.press("Escape");
    return;
  }

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
}

async function canvasScreenshot(page: Page) {
  const box = await drawingCanvas(page).boundingBox();
  if (!box) {
    throw new Error("The interactive drawing canvas is not laid out");
  }

  return page.screenshot({
    animations: "disabled",
    clip: box,
  });
}

test.describe("canvas drawing tools", () => {
  test("selects the rectangle tool independently", async ({
    openApp,
    page,
  }) => {
    await openApp();
    await selectTool(page, "rectangle");
    await expect(drawingCanvas(page)).toHaveCSS("cursor", "crosshair");
  });

  test("selects the ellipse tool independently", async ({ openApp, page }) => {
    await openApp();
    await selectTool(page, "ellipse");
    await expect(drawingCanvas(page)).toHaveCSS("cursor", "crosshair");
  });

  test("selects the arrow tool independently", async ({ openApp, page }) => {
    await openApp();
    await selectTool(page, "arrow");
    await expect(drawingCanvas(page)).toHaveCSS("cursor", "crosshair");
  });

  test("selects the line tool independently", async ({ openApp, page }) => {
    await openApp();
    await selectTool(page, "line");
    await expect(drawingCanvas(page)).toHaveCSS("cursor", "crosshair");
  });

  test("selects the text tool independently", async ({ openApp, page }) => {
    await openApp();
    await selectTool(page, "text");
    await expect(drawingCanvas(page)).toHaveCSS("cursor", "crosshair");
  });

  test("selects the selection tool independently", async ({
    openApp,
    page,
  }) => {
    await openApp();
    await selectTool(page, "rectangle");
    await selectTool(page, "selection");
    await expect(drawingCanvas(page)).not.toHaveCSS("cursor", "crosshair");
  });

  for (const tool of [
    "rectangle",
    "ellipse",
    "arrow",
    "line",
    "text",
  ] as const) {
    test(`draws a ${tool} and changes the canvas`, async ({
      openApp,
      page,
      clearCanvas,
    }) => {
      await openApp();

      try {
        const emptyCanvas = await canvasScreenshot(page);
        await draw(page, tool);
        await expect
          .poll(async () => (await canvasScreenshot(page)).toString("base64"))
          .not.toBe(emptyCanvas.toString("base64"));
      } finally {
        await clearCanvas();
      }
    });
  }
});
