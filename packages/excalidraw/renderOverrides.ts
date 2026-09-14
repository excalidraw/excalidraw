import { clamp } from "@excalidraw/math";

import type { ElementRenderOverride, ElementRenderOverrides } from "./types";

/** Validate and copy before publishing, so a rejected snapshot changes nothing. */
export const copyElementRenderOverrides = (
  overrides: ElementRenderOverrides | null,
): ElementRenderOverrides => {
  const copy = new Map<string, ElementRenderOverride>();
  for (const [id, value] of overrides ?? []) {
    const { opacity, offset } = value;
    if (
      (opacity !== undefined && !Number.isFinite(opacity)) ||
      (offset !== undefined &&
        (offset === null ||
          !Number.isFinite(offset.x) ||
          !Number.isFinite(offset.y)))
    ) {
      throw new TypeError(`Render overrides for ${id} must be finite numbers`);
    }
    if (opacity === undefined && offset === undefined) {
      continue;
    }
    copy.set(id, {
      ...(opacity !== undefined ? { opacity: clamp(opacity, 0, 100) } : {}),
      ...(offset ? { offset: { x: offset.x, y: offset.y } } : {}),
    });
  }
  return copy;
};
