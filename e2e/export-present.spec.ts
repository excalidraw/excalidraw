import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  createScene,
  drawRectangle,
  elementCount,
  register,
  waitForEditor,
  waitForSaved,
} from "./helpers";

test("slides from frames: add, reorder, present with keyboard, export PDF and PowerPoint", async ({
  page,
}) => {
  await register(page);
  await createScene(page);
  await drawRectangle(page);
  await waitForSaved(page);

  // ---- Slides panel: add two slides, move the second up
  await page.getByRole("button", { name: "Slides", exact: true }).click();
  const panel = page.getByLabel("Slides", { exact: true }).last();
  await page.getByRole("button", { name: "＋ Add slide" }).click();
  await page.getByRole("button", { name: "＋ Add slide" }).click();
  await expect(page.locator(".slides li")).toHaveCount(2);
  await page
    .locator(".slides li")
    .nth(1)
    .getByRole("button", { name: "Move up" })
    .click();
  await expect(page.locator(".slides li").first().locator("input")).toHaveValue(
    "Slide 2",
  );
  await waitForSaved(page);
  void panel;

  // ---- present: keyboard navigation, counter, exit
  await page.getByRole("button", { name: "▶ Present", exact: true }).click();
  await expect(page.locator(".present-count")).toContainText("1 / 2");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".present-count")).toContainText("2 / 2");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".present-count")).toContainText("1 / 2");
  await page.keyboard.press("Escape");
  await expect(page.locator(".present-bar")).toHaveCount(0);

  // ---- PDF: one page per frame
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("combobox").first(),
  ).toBeVisible();
  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe("Untitled.pdf");
  const pdf = await readFile((await pdfDownload.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length).toBe(2); // 2 frames -> 2 pages
  expect(pdf.length).toBeGreaterThan(1500);

  // ---- PowerPoint: a real .pptx (zip) with one slide per frame
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "PowerPoint" }).click();
  const [pptDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PowerPoint" }).click(),
  ]);
  expect(pptDownload.suggestedFilename()).toBe("Untitled.pptx");
  const pptx = await readFile((await pptDownload.path())!);
  expect(pptx.subarray(0, 2).toString()).toBe("PK");
  const names = pptx.toString("latin1");
  expect(names).toContain("ppt/slides/slide1.xml");
  expect(names).toContain("ppt/slides/slide2.xml");
  expect(names).not.toContain("ppt/slides/slide3.xml");
});

test("export refuses an empty canvas with a clear message", async ({
  page,
}) => {
  await register(page);
  await createScene(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox")
    .first()
    .selectOption("scene");
  await page.getByRole("button", { name: "Export PDF" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "There is nothing to export.",
  );
  expect(await elementCount(page)).toBe(0);
  await waitForEditor(page);
});
