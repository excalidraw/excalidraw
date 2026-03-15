import { test } from "@playwright/test";

const PROBLEM_URL =
  "/math/ege-prof/problems/types/d0be243d-d49c-4406-b66d-9f29486e1f0a";

/** Helper: wait for page content to load, dismiss cookie banner */
async function setupPage(page: any) {
  await page.goto(PROBLEM_URL, {
    timeout: 90_000,
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(
    '[placeholder*="Ответ"], [placeholder*="ответ"], [placeholder*="решение"]',
    { timeout: 60_000 },
  );
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button:has-text("Принять все")');
  if ((await cookieBtn.count()) > 0) {
    await cookieBtn.click();
    await page.waitForTimeout(500);
  }
}

/** Helper: open the whiteboard via the attachment menu "Доска" item */
async function openWhiteboard(page: any): Promise<boolean> {
  const allButtons = page.locator("button");
  const btnCount = await allButtons.count();

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
    await page.waitForTimeout(400);

    const doskaItem = page.locator('[role="menuitem"]:has-text("Доска")');
    if ((await doskaItem.count()) > 0) {
      await doskaItem.first().click();
      await page.waitForTimeout(5000);
      return true;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  return false;
}

// ── Desktop 1280x800 ──────────────────────────────────────────────
test.describe("Desktop 1280x800", () => {
  test.setTimeout(120_000);

  test("whiteboard full flow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupPage(page);

    await page.screenshot({ path: "e2e/screenshots/desktop-01-page.png" });

    if (await openWhiteboard(page)) {
      await page.screenshot({
        path: "e2e/screenshots/desktop-02-whiteboard.png",
      });

      // Draw a rectangle
      const rectBtn = page.locator('[data-testid="toolbar-rectangle"]');
      if ((await rectBtn.count()) > 0) {
        await rectBtn.click();
        const canvas = page.locator("canvas").first();
        const box = await canvas.boundingBox();
        if (box) {
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.move(cx - 80, cy - 50);
          await page.mouse.down();
          await page.mouse.move(cx + 80, cy + 50, { steps: 5 });
          await page.mouse.up();
          await page.waitForTimeout(1000);
        }
      }
      await page.screenshot({
        path: "e2e/screenshots/desktop-03-rectangle.png",
      });

      // Open hamburger menu
      const hamburger = page.locator(".main-menu-trigger");
      if ((await hamburger.count()) > 0) {
        await hamburger.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/desktop-04-menu.png" });
        await page.keyboard.press("Escape");
      }

      // Open extra tools
      const extraTools = page.locator(".App-toolbar__extra-tools-trigger");
      if ((await extraTools.count()) > 0) {
        await extraTools.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: "e2e/screenshots/desktop-05-extra-tools.png",
        });
      }
    }
  });
});

// ── Tablet 768x1024 ──────────────────────────────────────────────
test.describe("Tablet 768x1024", () => {
  test.setTimeout(120_000);

  test("whiteboard layout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupPage(page);

    if (await openWhiteboard(page)) {
      await page.screenshot({
        path: "e2e/screenshots/tablet-01-whiteboard.png",
      });

      // Draw something
      const drawBtn = page.locator('[data-testid="toolbar-freedraw"]');
      if ((await drawBtn.count()) > 0) {
        await drawBtn.click();
        const canvas = page.locator("canvas").first();
        const box = await canvas.boundingBox();
        if (box) {
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.move(cx - 50, cy);
          await page.mouse.down();
          for (let i = 0; i < 15; i++) {
            await page.mouse.move(cx - 50 + i * 8, cy + Math.sin(i) * 15, {
              steps: 2,
            });
          }
          await page.mouse.up();
          await page.waitForTimeout(500);
        }
      }
      await page.screenshot({ path: "e2e/screenshots/tablet-02-drawing.png" });
    }
  });
});

// ── Mobile 390x844 (iPhone 14) ──────────────────────────────────
test.describe("Mobile 390x844", () => {
  test.setTimeout(120_000);

  test("whiteboard layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupPage(page);

    await page.screenshot({ path: "e2e/screenshots/mobile-01-page.png" });

    if (await openWhiteboard(page)) {
      await page.screenshot({
        path: "e2e/screenshots/mobile-02-whiteboard.png",
      });

      // Draw freedraw
      const drawBtn = page.locator('[data-testid="toolbar-freedraw"]');
      if ((await drawBtn.count()) > 0) {
        await drawBtn.click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({
        path: "e2e/screenshots/mobile-03-freedraw-selected.png",
      });

      // Open hamburger
      const hamburger = page.locator(".main-menu-trigger");
      if ((await hamburger.count()) > 0) {
        await hamburger.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/mobile-04-menu.png" });
      }
    }
  });
});

// ── Small mobile 375x667 (iPhone SE) ──────────────────────────────
test.describe("Small mobile 375x667", () => {
  test.setTimeout(120_000);

  test("whiteboard layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupPage(page);

    if (await openWhiteboard(page)) {
      await page.screenshot({
        path: "e2e/screenshots/small-mobile-01-whiteboard.png",
      });
    }
  });
});

// ── Fullscreen overlay mode ──────────────────────────────────────
test.describe("Desktop fullscreen overlay", () => {
  test.setTimeout(120_000);

  test("expand whiteboard to overlay", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupPage(page);

    if (await openWhiteboard(page)) {
      // Click expand button (Maximize2 icon in external toolbar)
      const expandBtn = page.locator(
        'button:has(svg.lucide-maximize-2), button[aria-label*="Развернуть"], button[aria-label*="expand"]',
      );
      if ((await expandBtn.count()) > 0) {
        await expandBtn.first().click();
        await page.waitForTimeout(3000);
        await page.screenshot({
          path: "e2e/screenshots/fullscreen-01-overlay.png",
        });
      }
    }
  });
});
