import { expect, test } from "@playwright/test";

import {
  closeAll,
  createScene,
  drawRectangle,
  elementCount,
  newUserPage,
  register,
  uniqueUser,
  waitForEditor,
  waitForSaved,
} from "./helpers";

test("view-only link, per-user permissions and revocation", async ({
  page,
  browser,
}) => {
  await register(page);
  await createScene(page);
  await drawRectangle(page);
  await waitForSaved(page);

  // ---- create a read-only link
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create link" }).click();
  const linkInput = dialog.getByLabel("Link URL").first();
  await expect(linkInput).toBeVisible();
  const url = await linkInput.inputValue();
  expect(url).toMatch(/\/share\/[A-Za-z0-9_-]{43}$/);

  // ---- an anonymous guest can look but not touch
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await guest.goto(url);
  await waitForEditor(guest);
  await expect(guest.getByText("View only")).toBeVisible();
  await expect.poll(() => elementCount(guest)).toBe(1);
  // view mode has no drawing toolbar at all
  await expect(guest.getByRole("button", { name: "Rectangle" })).toHaveCount(0);
  // the server refuses writes even if the client tried (view token)
  const status = await guest.evaluate(async (u) => {
    const token = u.split("/share/")[1];
    const r = await fetch(`/api/v1/share/${token}/data`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-requested-with": "excalidraw-workspace",
      },
      body: JSON.stringify({ baseVersion: 1, elements: [], appState: {} }),
    });
    return r.status;
  }, url);
  expect(status).toBe(403);

  // ---- share with a named user as viewer, then upgrade to editor
  const {
    context: bobCtx,
    page: bob,
    user: bobUser,
  } = await newUserPage(browser, "bob");
  await dialog.getByPlaceholder("Invite by email").fill(bobUser.email);
  await dialog.getByRole("button", { name: "Invite" }).click();
  await expect(dialog.getByText(bobUser.email)).toBeVisible();

  await bob.getByRole("link", { name: /Shared with me/ }).click();
  await bob.locator(".thumb").first().click();
  await waitForEditor(bob);
  await expect(bob.getByText("View only")).toBeVisible();

  await dialog
    .getByLabel(`Permission for ${bobUser.displayName}`)
    .selectOption("EDIT");
  await bob.reload();
  await waitForEditor(bob);
  await expect(bob.getByText("View only")).toHaveCount(0);

  // ---- revoking the link locks the guest out
  await dialog.getByRole("button", { name: "Revoke" }).click();
  await expect(dialog.getByText("No active links.")).toBeVisible();
  await guest.reload();
  await expect(
    guest.getByRole("heading", { name: "Link unavailable" }),
  ).toBeVisible();

  await closeAll(guestCtx, bobCtx);
});

test("private scenes stay private: a workspace member cannot open them", async ({
  page,
  browser,
}) => {
  const owner = await register(page);
  const sceneId = await createScene(page);

  // add Carol to the owner's workspace through the real members form
  const carolUser = uniqueUser("carol");
  const carolCtx = await browser.newContext();
  const carol = await carolCtx.newPage();
  await register(carol, carolUser);

  await page.goto("/");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Members" }).click();
  await page.getByPlaceholder("Add member by email").fill(carolUser.email);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(carolUser.email)).toBeVisible();

  // shared with the workspace by default: Carol can open it
  await carol.goto(`/scene/${sceneId}`);
  await waitForEditor(carol);

  // make it private
  await page.goto(`/scene/${sceneId}`);
  await page.getByRole("button", { name: "Share" }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox")
    .first()
    .selectOption("private");
  await expect(
    page.getByRole("dialog").getByRole("combobox").first(),
  ).toHaveValue("private");
  await carol.goto(`/scene/${sceneId}`);
  await expect(
    carol.getByRole("heading", { name: "Scene not found" }),
  ).toBeVisible();

  await carolCtx.close();
  void owner;
});
