import { ToolError } from "./errors";
import type { ExcalidrawScene } from "./types";

const BLOCKED_PATCH_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export function assertPlainObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new ToolError(
      "INVALID_PARAMS",
      `${label} must be a plain object`,
      `Provide ${label} as a JSON object`,
    );
  }
}

export const validateScenePath = (scenePath: unknown): string => {
  if (typeof scenePath !== "string" || !scenePath.trim()) {
    throw new ToolError(
      "INVALID_PARAMS",
      "path must be a non-empty string",
      "Use a relative path like scenes/example.excalidraw",
    );
  }

  if (!scenePath.endsWith(".excalidraw")) {
    throw new ToolError(
      "INVALID_PATH",
      "Only .excalidraw files are supported",
      "Change the path extension to .excalidraw",
    );
  }

  return scenePath;
};

export const createEmptyScene = (): ExcalidrawScene => ({
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [],
  appState: {},
  files: {},
});

export function assertValidScene(
  value: unknown,
  label = "scene",
): asserts value is ExcalidrawScene {
  assertPlainObject(value, label);

  if (value.type !== "excalidraw") {
    throw new ToolError(
      "INVALID_SCENE",
      `${label}.type must be "excalidraw"`,
      "Set the scene type to excalidraw",
    );
  }

  if (typeof value.version !== "number") {
    throw new ToolError(
      "INVALID_SCENE",
      `${label}.version must be a number`,
      "Set version to 2 for modern Excalidraw scenes",
    );
  }

  if (!Array.isArray(value.elements)) {
    throw new ToolError(
      "INVALID_SCENE",
      `${label}.elements must be an array`,
      "Provide elements as a JSON array",
    );
  }

  if (!isPlainObject(value.appState)) {
    throw new ToolError(
      "INVALID_SCENE",
      `${label}.appState must be an object`,
      "Provide appState as a JSON object",
    );
  }

  if (
    value.files !== undefined &&
    value.files !== null &&
    !isPlainObject(value.files)
  ) {
    throw new ToolError(
      "INVALID_SCENE",
      `${label}.files must be an object if provided`,
      "Provide files as an object map",
    );
  }
}

export const mergeScenePatch = (
  scene: ExcalidrawScene,
  patch: unknown,
): ExcalidrawScene => {
  assertPlainObject(patch, "patch");

  const merged: ExcalidrawScene = { ...scene };

  for (const [key, value] of Object.entries(patch)) {
    if (BLOCKED_PATCH_KEYS.has(key)) {
      throw new ToolError(
        "INVALID_PARAMS",
        `patch key "${key}" is not allowed`,
        "Remove reserved keys from patch",
      );
    }

    if (key === "appState" || key === "files") {
      assertPlainObject(value, key);
      const current = isPlainObject(merged[key]) ? merged[key] : {};
      merged[key] = { ...current, ...value };
      continue;
    }

    merged[key] = value;
  }

  assertValidScene(merged);
  return merged;
};

export const countSceneFiles = (scene: ExcalidrawScene): number => {
  if (!scene.files || typeof scene.files !== "object") {
    return 0;
  }
  return Object.keys(scene.files).length;
};
