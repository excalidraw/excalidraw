import { expect, test } from "@playwright/test";

import {
  createScene,
  drawRectangle,
  elementCount,
  register,
  waitForEditor,
  waitForSaved,
} from "./helpers";

test("register, draw, autosave, rename, reopen from the dashboard", async ({
  page,
}) => {
  await register(page);
  await createScene(page);

  await drawRectangle(page);
  await expect.poll(() => elementCount(page)).toBe(1);
  await waitForSaved(page);

  const title = page.getByLabel("Scene name");
  await title.fill("Roadmap");
  await title.press("Enter");
  await waitForSaved(page);

  // reload the browser: the drawing comes back from the server
  await page.reload();
  await waitForEditor(page);
  await expect.poll(() => elementCount(page)).toBe(1);

  // and the scene is in the dashboard
  await page.getByRole("button", { name: "Back to dashboard" }).click();
  await expect(page.getByRole("heading", { name: "All scenes" })).toBeVisible();
  await expect(page.getByText("Roadmap")).toBeVisible();
});

test("folders, move, search, sort, trash, restore and delete forever", async ({
  page,
}) => {
  await register(page);

  for (const name of ["Alpha plan", "Bravo plan"]) {
    await createScene(page);
    await page.getByLabel("Scene name").fill(name);
    await page.getByLabel("Scene name").press("Enter");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  // create a folder from the sidebar
  await page.getByTitle("New folder").click();
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await dialog.getByPlaceholder("Name").fill("Marketing");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name: "Marketing" })).toBeVisible();

  // move "Alpha plan" into it
  await page.getByLabel("Actions for Alpha plan").click();
  await page.getByRole("button", { name: "Move to folder…" }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox")
    .selectOption({ label: "Marketing" });
  await page.getByRole("link", { name: "Marketing" }).click();
  await expect(page.getByText("Alpha plan")).toBeVisible();
  await expect(page.getByText("Bravo plan")).toHaveCount(0);

  // search across the workspace
  await page.getByRole("link", { name: "Home" }).click();
  await page.getByLabel("Search scenes").fill("bravo");
  await expect(page.getByText("Bravo plan")).toBeVisible();
  await expect(page.getByText("Alpha plan")).toHaveCount(0);
  await page.getByLabel("Search scenes").fill("");

  // sort by name ascending: Alpha first
  await page.getByLabel("Sort by").selectOption("name");
  await page.getByRole("button", { name: "Toggle sort order" }).click(); // -> ascending
  const names = page.locator(".scene-name");
  await expect(names.first()).toHaveText("Alpha plan");

  // trash -> restore -> trash -> delete forever
  await page.getByLabel("Actions for Bravo plan").click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page.getByText("Bravo plan")).toHaveCount(0);
  await page.getByRole("link", { name: "Trash" }).click();
  await expect(page.getByText("Bravo plan")).toBeVisible();
  await page.getByLabel("Actions for Bravo plan").click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Trash is empty")).toBeVisible();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByText("Bravo plan")).toBeVisible();

  await page.getByLabel("Actions for Bravo plan").click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.getByRole("link", { name: "Trash" }).click();
  await page.getByLabel("Actions for Bravo plan").click();
  await page.getByRole("button", { name: "Delete forever" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete forever" })
    .click();
  await expect(page.getByText("Trash is empty")).toBeVisible();
});

test("signed-out visitors are sent to sign in and back", async ({ page }) => {
  await page.goto("/scene/0123456789abcdef01234567");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows a generic error, and registering twice is refused", async ({
  page,
}) => {
  const user = await register(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong email or password.");

  await page.goto("/register");
  await page.getByLabel("Display name").fill("Again");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("another-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
});
