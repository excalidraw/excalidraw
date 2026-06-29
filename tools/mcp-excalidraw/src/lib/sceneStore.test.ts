import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { ToolError } from "./errors";
import { SceneStore } from "./sceneStore";

describe("SceneStore", () => {
  let rootDir: string;
  let store: SceneStore;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "excalidraw-mcp-"));
    store = new SceneStore(rootDir);
  });

  it("creates, lists and reads a scene", async () => {
    const created = await store.create({
      path: "scenes/first.excalidraw",
    });
    expect(created.created).toBe(true);

    const listed = await store.list({ recursive: true });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.path).toBe("scenes/first.excalidraw");

    const loaded = await store.get({ path: "scenes/first.excalidraw" });
    expect(loaded.stats.elements).toBe(0);
    expect(loaded.scene.type).toBe("excalidraw");
  });

  it("updates scene with shallow merge patch", async () => {
    await store.create({
      path: "update.excalidraw",
      scene: {
        type: "excalidraw",
        version: 2,
        source: "test",
        elements: [],
        appState: { theme: "light", gridSize: 20 },
        files: {},
      },
    });

    const updated = await store.update({
      path: "update.excalidraw",
      patch: {
        appState: { theme: "dark" },
      },
    });

    expect(updated.updated).toBe(true);

    const loaded = await store.get({ path: "update.excalidraw" });
    expect(loaded.scene.appState.theme).toBe("dark");
    expect(loaded.scene.appState.gridSize).toBe(20);
  });

  it("requires confirmation before delete", async () => {
    await store.create({
      path: "delete-me.excalidraw",
    });

    await expect(
      store.delete({ path: "delete-me.excalidraw", confirm: false }),
    ).rejects.toThrow(ToolError);

    const deleted = await store.delete({
      path: "delete-me.excalidraw",
      confirm: true,
    });
    expect(deleted.deleted).toBe(true);
  });

  it("blocks path traversal outside root", async () => {
    await expect(store.get({ path: "../escape.excalidraw" })).rejects.toThrow(
      ToolError,
    );
  });

  it("exports json and svg content", async () => {
    await store.create({ path: "export.excalidraw" });

    const jsonExport = await store.export({
      path: "export.excalidraw",
      format: "json",
    });
    expect(jsonExport.format).toBe("json");
    expect(jsonExport.content).toContain('"type": "excalidraw"');

    const svgExport = await store.export({
      path: "export.excalidraw",
      format: "svg",
    });
    expect(svgExport.format).toBe("svg");
    expect(svgExport.content).toContain("<svg");
  });
});
