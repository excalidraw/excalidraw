import { expect } from "@playwright/test";

import type { Browser, BrowserContext, Page } from "@playwright/test";

let n = 0;
export const uniqueUser = (label = "user") => ({
  email: `${label}-${Date.now()}-${n++}@e2e.test`,
  password: "e2e-password-1234",
  displayName: `${label[0]!.toUpperCase()}${label.slice(1)} ${n}`,
});

export type TestUser = ReturnType<typeof uniqueUser>;

/** Registers through the real form and lands on the dashboard. */
export const register = async (page: Page, user: TestUser = uniqueUser()) => {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "All scenes" })).toBeVisible();
  return user;
};

export const login = async (page: Page, user: TestUser) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "All scenes" })).toBeVisible();
};

export const newUserPage = async (browser: Browser, label: string) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = await register(page, uniqueUser(label));
  return { context, page, user };
};

/** Creates a scene from the dashboard and waits until the editor is ready. */
export const createScene = async (page: Page) => {
  await page.getByRole("button", { name: "＋ New scene" }).click();
  await page.waitForURL(/\/scene\//);
  await expect(page.locator(".excalidraw")).toBeVisible();
  await waitForEditor(page);
  return page.url().split("/scene/")[1]!;
};

/** dev-only `window.__ewApi` is the editor's imperative API (also used by the app's own tooling). */
export const waitForEditor = async (page: Page) => {
  await page.waitForFunction(() =>
    Boolean((window as any).__ewApi?.getSceneElements),
  );
};

export const elementCount = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).__ewApi
        .getSceneElements()
        .filter((e: any) => !e.isDeleted).length as number,
  );

/** Draws a rectangle with the REAL toolbar and mouse. */
export const drawRectangle = async (
  page: Page,
  from = { x: 300, y: 300 },
  size = { w: 160, h: 90 },
) => {
  await page
    .getByRole("button", { name: "Rectangle", exact: false })
    .first()
    .click();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + size.w / 2, from.y + size.h / 2, { steps: 5 });
  await page.mouse.move(from.x + size.w, from.y + size.h, { steps: 5 });
  await page.mouse.up();
};

export const waitForSaved = async (page: Page) => {
  await expect(page.locator(".save-ind")).toContainText(
    /All changes saved|Live — saved automatically/,
    { timeout: 20_000 },
  );
};

export const closeAll = async (...contexts: BrowserContext[]) => {
  await Promise.all(contexts.map((c) => c.close()));
};
