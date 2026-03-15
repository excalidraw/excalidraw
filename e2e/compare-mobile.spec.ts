/* eslint-disable no-console */
import { test } from "@playwright/test";

test.describe("Mobile layout comparison", () => {
  test.setTimeout(120_000);

  test("SdamEx whiteboard mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(
      "/math/ege-prof/problems/types/d0be243d-d49c-4406-b66d-9f29486e1f0a",
      { timeout: 30_000 },
    );

    // Wait for content to load
    await page.waitForSelector(
      '[placeholder*="Введите ответ"], [placeholder*="Ответ"]',
      {
        timeout: 60_000,
      },
    );
    await page.waitForTimeout(2000);

    // Dismiss cookie banner
    const cookieBtn = page.locator('button:has-text("Принять все")');
    if ((await cookieBtn.count()) > 0) {
      await cookieBtn.click();
      await page.waitForTimeout(500);
    }

    // Open whiteboard via attachment menu
    const allButtons = page.locator("button");
    const btnCount = await allButtons.count();
    let found = false;

    for (let i = btnCount - 1; i >= Math.max(0, btnCount - 30); i--) {
      const btn = allButtons.nth(i);
      if (!(await btn.isVisible())) {
        continue;
      }
      try {
        await btn.click({ timeout: 500 });
      } catch {
        continue;
      }
      await page.waitForTimeout(300);

      const doskaItem = page.locator('[role="menuitem"]:has-text("Доска")');
      if ((await doskaItem.count()) > 0) {
        await doskaItem.first().click();
        found = true;
        break;
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    if (found) {
      await page.waitForTimeout(4000);
      await page.screenshot({
        path: "e2e/screenshots/mobile-sdamex-whiteboard.png",
      });
    } else {
      console.log("Could not find Доска button");
      await page.screenshot({
        path: "e2e/screenshots/mobile-sdamex-no-doska.png",
      });
    }
  });

  test("Official excalidraw.com mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("https://excalidraw.com/", {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.waitForTimeout(3000);

    // Close any welcome/intro if present
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "e2e/screenshots/mobile-excalidraw-official.png",
    });
  });
});
