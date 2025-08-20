import { expect, type Page } from "@playwright/test";

import type { PlaybackEvent } from "../../record";

export async function playbackEvents(page: Page, events: PlaybackEvent[]) {
  const mask = [
    page.getByRole("button", { name: "Share" }),
    page.getByTitle("Library").locator("div"),
  ];
  let width = 0;
  let height = 0;
  page.setDefaultTimeout(100000);
  for (const event of events) {
    // Handle header event specially: set viewport and localStorage before playback
    if (event.type === "header") {
      // set viewport to recorded size
      await page.setViewportSize({ width: event.width, height: event.height });
      width = event.width;
      height = event.height;

      // apply localStorage snapshot in page context
      if (event.localStorage) {
        await page.evaluate((ls: Record<string, string>) => {
          try {
            for (const k in ls) {
              if (Object.prototype.hasOwnProperty.call(ls, k)) {
                localStorage.setItem(k, ls[k]);
              }
            }
          } catch {}
        }, event.localStorage as Record<string, string>);
      }

      await page.reload();

      await page.waitForLoadState("load");

      // header has no further action
      continue;
    }
    // wait the recorded delay before dispatching the event
    const ms = Math.max(0, Math.round((event as any).delay ?? 0));
    if (ms > 0) {
      await page.waitForTimeout(ms);
    }
    switch (event.type) {
      case "mouse.move":
        // Simulate mouse movement
        if (event.x < 0 || event.x > width || event.y < 0 || event.y > height) {
          break;
        }
        await page.mouse.move(event.x, event.y);
        break;
      case "mouse.down":
        // Simulate mouse button down
        await page.mouse.down({ button: event.button });
        break;
      case "mouse.up":
        // Simulate mouse button up
        await page.mouse.up({ button: event.button });
        await expect(page).toHaveScreenshot({ maxDiffPixels: 100, mask });
        break;
      case "keyboard.down":
        // Simulate key down
        await page.keyboard.down(event.key);
        break;
      case "keyboard.up":
        // Simulate key up
        await page.keyboard.up(event.key);
        await expect(page).toHaveScreenshot({
          maxDiffPixels: 100,
          mask,
        });
        break;
    }
  }
}
