import { test as base, expect } from "playwright/test";

/** Must match `STORAGE_KEYS.LOCAL_STORAGE_THEME` in `excalidraw-app/app_constants.ts`. */
export const THEME_STORAGE_KEY = "excalidraw-theme";

export type StoredTheme = "light" | "dark" | "system";

type ThemeFixtures = {
  /**
   * Navigates to the app with a guaranteed-clean, per-test browser state.
   * Pass `storedTheme` to seed `localStorage` before the app boots.
   */
  openApp: (storedTheme?: StoredTheme) => Promise<void>;
};

export const test = base.extend<ThemeFixtures>({
  // Explicit isolation: every test gets its own context, so localStorage,
  // cookies, and session state never leak between tests.
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
    await use(async (storedTheme?: StoredTheme) => {
      if (storedTheme) {
        // `addInitScript` runs on every navigation; the sessionStorage guard
        // ensures the seed is applied only once, so a later reload preserves
        // whatever theme the app persisted rather than re-seeding it.
        await page.addInitScript(
          ({ key, theme }) => {
            if (window.sessionStorage.getItem("__theme-seeded") === "1") {
              return;
            }
            window.sessionStorage.setItem("__theme-seeded", "1");
            window.localStorage.setItem(key, theme);
          },
          { key: THEME_STORAGE_KEY, theme: storedTheme },
        );
      }

      await page.goto(baseURL ?? "/");
      await expect(page.getByTestId("main-menu-trigger")).toBeVisible();
    });
  },
});

export { expect };
