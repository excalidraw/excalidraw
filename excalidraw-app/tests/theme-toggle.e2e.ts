import { expect, test } from "./fixtures/themeApp";

import type { Page } from "playwright/test";

const editorRoot = (page: Page) => page.locator(".excalidraw");

const themeMenu = (page: Page) => page.getByTestId("dropdown-menu");

const themeOption = (page: Page, mode: "Light" | "Dark" | "System") =>
  page.getByRole("radio", { name: new RegExp(`^${mode} mode`, "i") });

/** Opens the main menu if it is not already open (selecting a theme may close it). */
async function openThemeMenu(page: Page) {
  const trigger = page.getByTestId("main-menu-trigger");
  await expect(trigger).toBeVisible();

  if (!(await themeMenu(page).isVisible())) {
    await trigger.click();
  }

  await expect(themeMenu(page)).toBeVisible();
  await expect(themeOption(page, "Light")).toBeVisible();
}

test.describe("theme toggle", () => {
  test("shows the theme options by default with the light theme selected", async ({
    openApp,
    page,
  }) => {
    await openApp();
    await openThemeMenu(page);

    await expect(themeOption(page, "Light")).toBeChecked();
    await expect(themeOption(page, "Dark")).not.toBeChecked();
    await expect(themeOption(page, "System")).not.toBeChecked();
    await expect(editorRoot(page)).not.toHaveClass(/theme--dark/);
  });

  test("switches the app from light to dark", async ({ openApp, page }) => {
    await openApp();
    await expect(editorRoot(page)).not.toHaveClass(/theme--dark/);

    await openThemeMenu(page);
    await themeOption(page, "Dark").check();

    await expect(themeOption(page, "Dark")).toBeChecked();
    await expect(editorRoot(page)).toHaveClass(/theme--dark/);
  });

  test("switches the app from dark to light", async ({ openApp, page }) => {
    await openApp("dark");
    await expect(editorRoot(page)).toHaveClass(/theme--dark/);

    await openThemeMenu(page);
    await expect(themeOption(page, "Dark")).toBeChecked();
    await themeOption(page, "Light").check();

    await expect(themeOption(page, "Light")).toBeChecked();
    await expect(editorRoot(page)).not.toHaveClass(/theme--dark/);
  });

  test("renders a distinct icon for the light and dark options", async ({
    openApp,
    page,
  }) => {
    await openApp();
    await openThemeMenu(page);

    const lightIcon = themeOption(page, "Light")
      .locator("xpath=..")
      .locator("svg");
    const darkIcon = themeOption(page, "Dark")
      .locator("xpath=..")
      .locator("svg");

    await expect(lightIcon).toHaveCount(1);
    await expect(darkIcon).toHaveCount(1);

    expect(await lightIcon.innerHTML()).not.toBe(await darkIcon.innerHTML());
  });

  test("reflects the active theme in the option labels", async ({
    openApp,
    page,
  }) => {
    await openApp();
    await openThemeMenu(page);

    await expect(themeOption(page, "Light")).toHaveAccessibleName(
      /^light mode/i,
    );
    await expect(themeOption(page, "Dark")).toHaveAccessibleName(/^dark mode/i);
    await expect(themeOption(page, "System")).toHaveAccessibleName(
      /^system mode/i,
    );

    await themeOption(page, "Dark").check();
    await openThemeMenu(page);

    await expect(themeOption(page, "Dark")).toBeChecked();
    await expect(themeOption(page, "Light")).not.toBeChecked();
    await expect(themeOption(page, "Dark")).toHaveAccessibleName(/^dark mode/i);
  });

  test("persists the selected theme across a reload", async ({
    openApp,
    page,
  }) => {
    await openApp();
    await openThemeMenu(page);
    await themeOption(page, "Dark").check();
    await expect(editorRoot(page)).toHaveClass(/theme--dark/);

    await page.reload();
    await expect(page.getByTestId("main-menu-trigger")).toBeVisible();
    await expect(editorRoot(page)).toHaveClass(/theme--dark/);

    await openThemeMenu(page);
    await expect(themeOption(page, "Dark")).toBeChecked();
  });

  test("applies the theme to the surrounding UI", async ({ openApp, page }) => {
    await openApp();
    const root = editorRoot(page);

    const readIslandBackground = () =>
      root.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--island-bg-color").trim(),
      );

    const lightBackground = await readIslandBackground();
    expect(lightBackground).not.toBe("");

    await openThemeMenu(page);
    await themeOption(page, "Dark").check();
    await expect(root).toHaveClass(/theme--dark/);

    const darkBackground = await readIslandBackground();
    expect(darkBackground).not.toBe(lightBackground);
  });
});
