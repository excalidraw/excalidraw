import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const SCHEMA_VERSIONS = {
  initial: 1,
  frameBackgrounds: 2,
  latest: 2,
} as const;

export const resolveSchemaVersion = (
  schemaVersion: number | undefined,
  fallbackVersion: number,
) => {
  if (
    Number.isInteger(schemaVersion) &&
    (schemaVersion as number) >= SCHEMA_VERSIONS.initial
  ) {
    return schemaVersion as number;
  }
  return fallbackVersion;
};

export const migrateElementsBySchema = (
  elements: readonly ExcalidrawElement[] | null | undefined,
  schemaVersion: number,
) => {
  if (!elements) {
    return elements;
  }

  return elements.map((element) => {
    if (element.type !== "frame") {
      return element;
    }

    const { backgroundEnabled: _, ...frameWithoutBackgroundEnabled } =
      element as ExcalidrawElement & {
        backgroundEnabled?: boolean;
      };

    if (schemaVersion >= SCHEMA_VERSIONS.frameBackgrounds) {
      return frameWithoutBackgroundEnabled;
    }

    return {
      ...frameWithoutBackgroundEnabled,
      backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
    } as ExcalidrawElement;
  });
};
