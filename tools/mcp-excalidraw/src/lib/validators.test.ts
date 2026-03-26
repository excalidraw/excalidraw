import { describe, expect, it } from "vitest";

import { ToolError } from "./errors";
import {
  assertValidScene,
  createEmptyScene,
  mergeScenePatch,
  validateScenePath,
} from "./validators";

describe("validateScenePath", () => {
  it("accepts .excalidraw files", () => {
    expect(validateScenePath("scenes/a.excalidraw")).toBe(
      "scenes/a.excalidraw",
    );
  });

  it("rejects non-excalidraw extensions", () => {
    expect(() => validateScenePath("scenes/a.json")).toThrow(ToolError);
  });
});

describe("assertValidScene", () => {
  it("accepts an empty scene template", () => {
    expect(() => assertValidScene(createEmptyScene())).not.toThrow();
  });

  it("rejects invalid scene type", () => {
    const scene = createEmptyScene();
    scene.type = "wrong";
    expect(() => assertValidScene(scene)).toThrow(ToolError);
  });
});

describe("mergeScenePatch", () => {
  it("shallow merges appState and files", () => {
    const scene = createEmptyScene();
    scene.appState = { gridSize: 10, theme: "light" };
    scene.files = { fileA: { id: "a" } };

    const merged = mergeScenePatch(scene, {
      appState: { theme: "dark" },
      files: { fileB: { id: "b" } },
      source: "local-test",
    });

    expect(merged.appState).toEqual({ gridSize: 10, theme: "dark" });
    expect(merged.files).toEqual({ fileA: { id: "a" }, fileB: { id: "b" } });
    expect(merged.source).toBe("local-test");
  });

  it("rejects reserved patch keys", () => {
    const scene = createEmptyScene();
    expect(() =>
      mergeScenePatch(scene, { __proto__: { pollute: true } }),
    ).toThrow(ToolError);
  });
});
