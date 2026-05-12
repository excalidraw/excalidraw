import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

function normalizeShapes(shapes: Array<Record<string, unknown>>) {
  return shapes.map((shape) => {
    const copy: Record<string, unknown> = { ...shape };
    delete copy.id;
    return copy;
  });
}

describe("allplanmodules → backend tldraw connector parity", () => {
  it("matches the legacy excalidraw->tldraw conversion output", async () => {
    const {
      runAllplanModulesPipeline,
    } = require("../../packages/backend/terraform/allplan-modules-pipeline.js");
    const {
      nodesToExcalidraw,
    } = require("../../packages/backend/excalidraw.js");
    const {
      excalidrawSceneToTldrawShapes,
    } = require("../../packages/backend/connectors/excalidraw-to-tldraw.js");
    const renderer = require("../../packages/backend/connectors/tldraw.js");

    const nodes = runAllplanModulesPipeline();
    const scene = await nodesToExcalidraw(nodes);
    const legacy = excalidrawSceneToTldrawShapes(scene);
    const result = await renderer.render({ nodes, options: {} });
    const doc = result.body;

    expect(result.contentType).toBe("application/json");
    expect(result.fileExtension).toBe("tldr.json");
    expect(doc.type).toBe("tldraw");
    expect(Array.isArray(doc.shapes)).toBe(true);
    expect(doc.shapes.length).toBeGreaterThan(0);
    expect(doc.shapes.length).toBe(legacy.shapes.length);
    expect(normalizeShapes(doc.shapes)).toEqual(normalizeShapes(legacy.shapes));

    const terraformResource = doc.shapes.find(
      (shape: Record<string, unknown>) =>
        shape.meta &&
        typeof shape.meta === "object" &&
        (shape.meta as Record<string, unknown>).terraformVisibilityRole ===
          "resource",
    ) as { meta: Record<string, unknown> } | undefined;
    expect(terraformResource).toBeTruthy();
    expect(terraformResource?.meta.terraformVisibilityKey).toBeTruthy();

    const terraformEdge = doc.shapes.find(
      (shape: Record<string, unknown>) =>
        shape.type === "arrow" &&
        shape.meta &&
        typeof shape.meta === "object" &&
        (shape.meta as Record<string, unknown>).terraformEdgeLayer,
    ) as { meta: Record<string, unknown> } | undefined;
    expect(terraformEdge).toBeTruthy();
    expect(terraformEdge?.meta.relationship).toBeTruthy();
  });
});
