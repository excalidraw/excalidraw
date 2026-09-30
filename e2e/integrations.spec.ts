import http from "node:http";

import { expect, test } from "@playwright/test";

import { createScene, elementCount, register, waitForEditor } from "./helpers";

import type { AddressInfo } from "node:net";

test("API keys: secret shown once, works against the public API and MCP, revocable", async ({
  page,
  request,
}) => {
  await register(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "API keys" }).click();

  const personal = page.locator("section.form").first();
  await personal.getByLabel("Key name").fill("e2e agent");
  await personal.getByRole("button", { name: "Read & write" }).click();
  await personal.getByRole("button", { name: "Create key" }).click();
  const secret = await personal.getByLabel("New API key").inputValue();
  expect(secret).toMatch(/^ewk_[A-Za-z0-9_-]{10}_[A-Za-z0-9_-]{43}$/);

  // the key authenticates the public API (no cookies: a fresh request context)
  const me = await request.get("/public/v1/me", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(me.status()).toBe(200);
  expect((await me.json()).key.name).toBe("e2e agent");

  // ...and creates a scene that shows up in the dashboard
  const ws = (await (await page.request.get("/api/v1/workspaces")).json())
    .workspaces[0].id;
  const created = await request.post("/public/v1/scenes", {
    headers: { authorization: `Bearer ${secret}` },
    data: { workspaceId: ws, name: "Made by an agent" },
  });
  expect(created.status()).toBe(201);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByText("Made by an agent")).toBeVisible();

  // once dismissed the secret is gone for good; only the prefix remains
  await personal.getByRole("button", { name: "Done" }).click();
  await expect(personal.getByLabel("New API key")).toHaveCount(0);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "API keys" }).click();
  await expect(page.getByText(secret.slice(0, 14))).toBeVisible();
  await expect(page.getByText(secret.slice(15))).toHaveCount(0);

  // revoke -> immediately unusable
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await expect
    .poll(async () =>
      (
        await request.get("/public/v1/me", {
          headers: { authorization: `Bearer ${secret}` },
        })
      ).status(),
    )
    .toBe(401);
});

test("AI text-to-diagram: admin configures a local model, a member generates an editable diagram", async ({
  page,
}) => {
  // a tiny OpenAI-compatible model server living in this test process
  const model = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const text =
        "```mermaid\nflowchart TD\n  A[Sign in] --> B{Valid?}\n  B -->|Yes| C[Dashboard]\n  B -->|No| A\n```";
      for (const part of text.match(/.{1,12}/gs)!) {
        res.write(
          `data: ${JSON.stringify({
            choices: [{ delta: { content: part } }],
          })}\n\n`,
        );
      }
      res.write(
        `data: ${JSON.stringify({
          choices: [{ delta: {}, finish_reason: "stop" }],
        })}\n\ndata: [DONE]\n\n`,
      );
      res.end();
    });
  });
  await new Promise<void>((r) => model.listen(0, "127.0.0.1", r));
  const modelUrl = `http://127.0.0.1:${
    (model.address() as AddressInfo).port
  }/v1`;

  try {
    await register(page);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "AI" }).click();

    // before configuring: text-to-diagram is not offered in the editor
    await page.getByLabel("Enable AI in this workspace").check();
    await page
      .getByLabel("Provider")
      .selectOption({ label: "Local / OpenAI-compatible" });
    await page.getByLabel("Endpoint URL").fill(modelUrl);
    await page.getByLabel("Requests per day — each member").fill("7");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("AI settings saved.")).toBeVisible();
    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByText(/Connection works/)).toBeVisible();

    // in the editor: More tools -> Mermaid to Excalidraw -> "Text to diagram" tab
    await page.getByRole("link", { name: "Home" }).click();
    await createScene(page);
    await page.getByRole("button", { name: "More tools" }).click();
    await page.getByRole("menuitem", { name: "Mermaid to Excalidraw" }).click();
    await page.getByRole("tab", { name: /Text to diagram/ }).click();
    await page
      .getByPlaceholder(/Start typing your diagram idea/)
      .fill("A sign in flow");
    await page.keyboard.press("Enter");
    await expect(page.getByText("6 requests left today")).toBeVisible({
      timeout: 30_000,
    }); // limit 7 - this one
    await page
      .getByRole("button", { name: "Insert", exact: true })
      .last()
      .click();
    await waitForEditor(page);
    await expect
      .poll(() => elementCount(page), { timeout: 15_000 })
      .toBeGreaterThan(3);
    const texts = await page.evaluate(() =>
      (window as any).__ewApi
        .getSceneElements()
        .filter((e: any) => e.type === "text")
        .map((e: any) => e.text),
    );
    expect(texts).toEqual(
      expect.arrayContaining(["Sign in", "Valid?", "Dashboard"]),
    );
  } finally {
    model.closeAllConnections();
    await new Promise((r) => model.close(r));
  }
});

test("Mermaid to diagram works with no AI configured at all", async ({
  page,
}) => {
  await register(page);
  await createScene(page);
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: "Mermaid to Excalidraw" }).click();
  // only the Mermaid pane: no AI tab because nothing is configured
  await expect(page.getByRole("tab", { name: /Text to diagram/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Insert" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Insert" })
    .click();
  await expect
    .poll(() => elementCount(page), { timeout: 15_000 })
    .toBeGreaterThan(3);
});

test("personal library: import a .excalidrawlib file, then use it in the editor", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("link", { name: "Libraries" }).click();
  const lib = {
    type: "excalidrawlib",
    version: 2,
    source: "e2e",
    libraryItems: [
      {
        id: "item-1",
        status: "unpublished",
        created: 1700000000000,
        name: "Blue box",
        elements: [
          {
            id: "e1",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            angle: 0,
            strokeColor: "#1971c2",
            backgroundColor: "#a5d8ff",
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            seed: 1,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            boundElements: null,
            updated: 1,
            link: null,
            locked: false,
          },
        ],
      },
    ],
  };
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "boxes.excalidrawlib",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(lib)),
    });
  await expect(page.getByText("Imported 1 item(s).")).toBeVisible();
  await expect(page.locator(".lib-item")).toHaveCount(1);

  await page.getByRole("link", { name: "Home" }).click();
  await createScene(page);
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.locator(".library-unit")).toHaveCount(1, {
    timeout: 15_000,
  });
});
