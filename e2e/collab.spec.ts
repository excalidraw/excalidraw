import { expect, test } from "@playwright/test";

import {
  closeAll,
  createScene,
  drawRectangle,
  elementCount,
  newUserPage,
  waitForEditor,
  waitForSaved,
} from "./helpers";

test("two people edit live: cursors/presence, incremental updates, comments", async ({
  page,
  browser,
}) => {
  const {
    context: ctxA,
    page: a,
    user: alice,
  } = await newUserPage(browser, "alice");
  const {
    context: ctxB,
    page: b,
    user: bob,
  } = await newUserPage(browser, "bob");

  // Alice adds Bob to her workspace (UI), then both open the same scene
  await a.getByRole("link", { name: "Settings" }).click();
  await a.getByRole("tab", { name: "Members" }).click();
  await a.getByPlaceholder("Add member by email").fill(bob.email);
  await a.getByRole("button", { name: "Add", exact: true }).click();
  await expect(a.getByText(bob.email)).toBeVisible();
  await a.getByRole("link", { name: "Home" }).click();
  const sceneId = await createScene(a);

  await b.goto(`/scene/${sceneId}`);
  await waitForEditor(b);

  // presence: each sees the other in the header, socket is live
  await expect(a.locator(".presence-avatar")).toHaveCount(2);
  await expect(b.locator(".presence-avatar")).toHaveCount(2);
  await expect(a.locator(".live-dot")).toHaveClass(/connected/);
  await expect(a.locator(".save-ind")).toContainText("Live");

  // Alice draws with the real mouse; Bob sees it without reloading
  await drawRectangle(a);
  await expect.poll(() => elementCount(b), { timeout: 15_000 }).toBe(1);

  // Bob draws elsewhere; Alice sees both
  await drawRectangle(b, { x: 700, y: 400 });
  await expect.poll(() => elementCount(a), { timeout: 15_000 }).toBe(2);

  // comments arrive live
  await a.getByRole("button", { name: "💬 Comment" }).click();
  await a
    .getByLabel(
      "Click on the canvas to place a comment. Press Escape to cancel.",
    )
    .click({ position: { x: 300, y: 300 } });
  await a.getByPlaceholder("Write a comment…").fill("Looks great, ship it");
  await a
    .locator(".comments-panel")
    .getByRole("button", { name: "Send" })
    .click();
  await expect(b.getByRole("button", { name: "Comments (1)" })).toBeVisible({
    timeout: 15_000,
  });
  await b.getByRole("button", { name: /Comments/ }).click();
  await expect(b.getByText("Looks great, ship it")).toBeVisible();
  // Bob replies and resolves the thread; Alice sees the count drop
  await b.getByText("Looks great, ship it").click();
  await b.getByPlaceholder("Reply…").fill("Thanks!");
  await b
    .locator(".comments-panel")
    .getByRole("button", { name: "Send" })
    .click();
  await b.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(a.getByRole("button", { name: /^Comments$/ })).toBeVisible({
    timeout: 15_000,
  });

  // the room persists to MongoDB: reload shows both rectangles for a brand-new visitor
  await expect(a.locator(".save-ind")).toContainText("Live");
  await closeAll(ctxB);
  await a.waitForTimeout(500);
  await a.reload();
  await waitForEditor(a);
  await expect.poll(() => elementCount(a), { timeout: 15_000 }).toBe(2);
  void alice;
  await closeAll(ctxA);
});

test("offline edits are kept locally and synced when the connection returns", async ({
  page,
  context,
}) => {
  const { register: reg } = await import("./helpers");
  await reg(page);
  await createScene(page);
  await drawRectangle(page);
  await waitForSaved(page);

  await context.setOffline(true);
  await drawRectangle(page, { x: 600, y: 420 });
  await expect(page.locator(".save-ind")).toContainText(/offline/i, {
    timeout: 30_000,
  });
  await expect.poll(() => elementCount(page)).toBe(2); // nothing lost locally

  await context.setOffline(false);
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  await expect.poll(() => elementCount(page), { timeout: 15_000 }).toBe(2);
});
