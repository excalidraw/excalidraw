/* eslint-disable no-console */
const { chromium } = require("playwright");

const PROBLEM_URL =
  "http://localhost:3000/math/ege-prof/problems/types/d0be243d-d49c-4406-b66d-9f29486e1f0a";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-mobile", width: 375, height: 667 },
];

async function setupPage(page) {
  await page.goto(PROBLEM_URL, {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(
    '[placeholder*="Ответ"], [placeholder*="ответ"], [placeholder*="решение"]',
    { timeout: 60000 },
  );
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button:has-text("Принять все")');
  if ((await cookieBtn.count()) > 0) {
    await cookieBtn.click();
    await page.waitForTimeout(500);
  }
}

async function openWhiteboard(page) {
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

(async () => {
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) =>
      console.log(`  PAGE_ERR: ${e.message.slice(0, 100)}`),
    );

    try {
      await setupPage(page);
      await page.screenshot({ path: `e2e/screenshots/${vp.name}-01-page.png` });
      console.log(`  [ok] page loaded`);

      if (await openWhiteboard(page)) {
        await page.screenshot({
          path: `e2e/screenshots/${vp.name}-02-whiteboard.png`,
        });
        console.log(`  [ok] whiteboard opened`);

        // Draw a rectangle
        const rectBtn = page.locator('[data-testid="toolbar-rectangle"]');
        if ((await rectBtn.count()) > 0) {
          await rectBtn.click();
          const canvas = page.locator("canvas").first();
          const box = await canvas.boundingBox();
          if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await page.mouse.move(cx - 60, cy - 40);
            await page.mouse.down();
            await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
            await page.mouse.up();
            await page.waitForTimeout(1000);
          }
          await page.screenshot({
            path: `e2e/screenshots/${vp.name}-03-rectangle.png`,
          });
          console.log(`  [ok] rectangle drawn`);
        }

        // Open hamburger menu
        const hamburger = page.locator(".main-menu-trigger");
        if ((await hamburger.count()) > 0) {
          await hamburger.first().click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `e2e/screenshots/${vp.name}-04-menu.png`,
          });
          console.log(`  [ok] menu opened`);
          await page.keyboard.press("Escape");
        }
      } else {
        console.log(`  [!] could not open whiteboard`);
      }
    } catch (e) {
      console.log(`  [FAIL] ${e.message.slice(0, 200)}`);
      await page
        .screenshot({ path: `e2e/screenshots/${vp.name}-error.png` })
        .catch(() => {});
    }

    await context.close();
  }

  await browser.close();
  console.log("\n=== Done! Check e2e/screenshots/ ===");
})();
