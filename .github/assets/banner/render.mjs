// Renders the README banner, hero.html, to ../banner-light.png and ../banner-dark.png.
// Fonts: Geist and Geist Mono (Vercel) and Excalifont (Excalidraw), all under the SIL Open Font License 1.1.
// The editor in it is a screenshot of the app with scene.excalidraw open and two collaborators in the room.
// To retake it, when the UI or the scene changes, start the app (yarn start) and pass --editor:
//   node .github/assets/banner/render.mjs --editor
// The app is expected at http://localhost:3001; set EXCALIDRAW_APP_URL if yours runs elsewhere.
// Needs Playwright's Chromium (npx playwright install chromium).
// Run with: node .github/assets/banner/render.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = new URL(".", import.meta.url);
const themes = ["light", "dark"];
const browser = await chromium.launch();

if (process.argv.includes("--editor")) {
  const appUrl = process.env.EXCALIDRAW_APP_URL ?? "http://localhost:3001";
  const { elements } = JSON.parse(
    await readFile(new URL("scene.excalidraw", here), "utf8"),
  );
  for (const theme of themes) {
    // a window this size gets the tablet layout: the compact styles panel
    const context = await browser.newContext({
      deviceScaleFactor: 2,
      viewport: { width: 960, height: 600 },
    });
    await context.addInitScript(
      ({ elements, theme }) => {
        localStorage.setItem("excalidraw", JSON.stringify(elements));
        localStorage.setItem("excalidraw-theme", theme);
      },
      { elements, theme },
    );
    const page = await context.newPage();
    await page.goto(appUrl);
    // window.h is the editor's debug handle, there in development only
    await page.waitForFunction(() => window.h?.app && window.h.elements.length);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const collaborator = (id, username, x, y, selected) => [
        id,
        {
          id,
          socketId: id,
          username,
          pointer: { x, y, tool: "pointer" },
          selectedElementIds: selected ? { [selected]: true } : {},
        },
      ];
      window.h.app.updateScene({
        collaborators: new Map([
          collaborator("maya", "Maya", 690, 352),
          collaborator("tom-3", "Tom", 640, 472, "queue"),
        ]),
      });
      window.h.app.setState({ selectedElementIds: { api: true } });
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: fileURLToPath(new URL(`editor-${theme}.png`, here)),
    });
    await context.close();
  }
}

const page = await browser.newPage({
  deviceScaleFactor: 1.5,
  viewport: { width: 1280, height: 600 },
});
for (const theme of themes) {
  await page.goto(new URL(`hero.html?theme=${theme}`, here).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getElementById("editor").complete);
  for (const font of ["Geist", "Geist Mono", "Excalifont"]) {
    if (
      !(await page.evaluate((f) => document.fonts.check(`16px "${f}"`), font))
    ) {
      throw new Error(`${font} didn't load: check its path in hero.html`);
    }
  }
  await page.locator("#hero").screenshot({
    path: fileURLToPath(new URL(`../banner-${theme}.png`, here)),
    omitBackground: true,
  });
}
await browser.close();
