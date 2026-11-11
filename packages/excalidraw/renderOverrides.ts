import { clamp } from "@excalidraw/math";

import type {
  ElementRenderOffsets,
  ElementRenderOverride,
  ElementRenderOverrides,
} from "./types";

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

/**
 * Extracts the offsets of a snapshot, returning `previous` when they are the
 * same. Visibility is memoized on this map's identity, so a snapshot that only
 * changes opacities (a fade) never re-runs viewport geometry.
 */
export const getElementRenderOffsets = (
  overrides: ElementRenderOverrides,
  previous: ElementRenderOffsets,
): ElementRenderOffsets => {
  // Compare before allocating: fades can carry many unchanged offsets.
  let offsetCount = 0;
  let changed = false;
  for (const [id, { offset }] of overrides) {
    if (!offset) {
      continue;
    }
    offsetCount++;
    const before = previous.get(id);
    if (!before || before.x !== offset.x || before.y !== offset.y) {
      changed = true;
      break;
    }
  }
  if (!changed && offsetCount === previous.size) {
    return previous;
  }

  const next = new Map<string, NonNullable<ElementRenderOverride["offset"]>>();
  for (const [id, { offset }] of overrides) {
    if (offset) {
      next.set(id, offset);
    }
  }
  return next;
};
