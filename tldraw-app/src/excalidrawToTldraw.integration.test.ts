import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  excalidrawSceneToTldrawShapes,
  mapExcalidrawTextAlignToTldraw,
} from "./excalidrawToTldraw";

const require = createRequire(import.meta.url);

describe("mapExcalidrawTextAlignToTldraw", () => {
  it("maps Excalidraw CSS alignment to tldraw text alignment", () => {
    expect(mapExcalidrawTextAlignToTldraw("left")).toBe("start");
    expect(mapExcalidrawTextAlignToTldraw("center")).toBe("middle");
    expect(mapExcalidrawTextAlignToTldraw("right")).toBe("end");
    expect(mapExcalidrawTextAlignToTldraw(undefined)).toBe("start");
    expect(mapExcalidrawTextAlignToTldraw("start")).toBe("start");
    expect(mapExcalidrawTextAlignToTldraw("middle")).toBe("middle");
    expect(mapExcalidrawTextAlignToTldraw("end")).toBe("end");
  });
});

describe("allplanmodules → excalidraw → tldraw shapes", () => {
  it("converts the fixture scene without invalid textAlign values", async () => {
    const { runAllplanModulesPipeline } = require(
      "../../packages/backend/terraform/allplan-modules-pipeline.js",
    );
    const { nodesToExcalidraw } = require("../../packages/backend/excalidraw.js");

    const nodes = runAllplanModulesPipeline();
    const scene = await nodesToExcalidraw(nodes);
    const { shapes } = excalidrawSceneToTldrawShapes(scene);

    expect(shapes.length).toBeGreaterThan(0);

    const allowed = new Set(["start", "middle", "end"]);
    for (const s of shapes) {
      if (s.type === "text" && s.props && "textAlign" in s.props) {
        expect(
          allowed.has((s.props as { textAlign: string }).textAlign),
          `bad textAlign: ${JSON.stringify((s.props as { textAlign: string }).textAlign)}`,
        ).toBe(true);
      }
    }
  });
});
