import { newFrameElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const MARGIN = 48;
const STACK_GAP = 64;
const FRAME_PAD = 16;

export type StackModuleSceneSlice = {
  stackId: string;
  elements: ExcalidrawElement[];
};

function elementBounds(elements: readonly ExcalidrawElement[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function shiftElements(elements: ExcalidrawElement[], dx: number, dy: number) {
  for (const el of elements) {
    (el as { x: number; y: number }).x = el.x + dx;
    (el as { y: number }).y = el.y + dy;
  }
}

/**
 * Place per-stack module subgraphs side-by-side with a labeled stack frame each.
 */
export function composeStackModuleScenes(
  slices: readonly StackModuleSceneSlice[],
): ExcalidrawElement[] {
  const nonEmpty = slices.filter((s) => s.elements.length > 0);
  if (nonEmpty.length === 0) {
    return [];
  }
  if (nonEmpty.length === 1) {
    const only = nonEmpty[0]!;
    return wrapStackFrame(only.stackId, only.elements, MARGIN, MARGIN);
  }

  let cursorX = MARGIN;
  const cursorY = MARGIN;
  const composed: ExcalidrawElement[] = [];

  for (const slice of nonEmpty) {
    const wrapped = wrapStackFrame(
      slice.stackId,
      slice.elements,
      cursorX,
      cursorY,
    );
    const bounds = elementBounds(wrapped);
    if (bounds) {
      cursorX = bounds.maxX + STACK_GAP;
    }
    composed.push(...wrapped);
  }

  return composed;
}

function wrapStackFrame(
  stackId: string,
  elements: ExcalidrawElement[],
  originX: number,
  originY: number,
): ExcalidrawElement[] {
  const bounds = elementBounds(elements);
  if (!bounds) {
    return elements;
  }
  const dx = originX + FRAME_PAD - bounds.minX;
  const dy = originY + FRAME_PAD + 20 - bounds.minY;
  shiftElements(elements, dx, dy);

  const shifted = elementBounds(elements)!;
  const frame = newFrameElement({
    x: shifted.minX - FRAME_PAD,
    y: shifted.minY - FRAME_PAD - 20,
    width: shifted.maxX - shifted.minX + 2 * FRAME_PAD,
    height: shifted.maxY - shifted.minY + 2 * FRAME_PAD + 20,
    name: stackId,
    customData: {
      terraform: true,
      terraformStackFrame: true,
      stackId,
    },
  });

  const childIds = elements
    .filter((el) => !el.frameId && el.type !== "arrow" && el.type !== "line")
    .map((el) => el.id);

  for (const el of elements) {
    if (!el.frameId && childIds.includes(el.id)) {
      (el as { frameId: string | null }).frameId = frame.id;
    }
  }

  return [frame, ...elements];
}

export function buildLayoutBoxesFromElements(
  elements: readonly ExcalidrawElement[],
): Record<string, { x: number; y: number; width: number; height: number }> {
  const out: Record<
    string,
    { x: number; y: number; width: number; height: number }
  > = {};
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const role = (el.customData as { terraformVisibilityRole?: string } | undefined)
      ?.terraformVisibilityRole;
    if (role && role !== "resource") {
      continue;
    }
    const key =
      typeof (el.customData as { nodePath?: string } | undefined)?.nodePath ===
      "string"
        ? (el.customData as { nodePath: string }).nodePath
        : el.id;
    out[key] = { x: el.x, y: el.y, width: el.width, height: el.height };
  }
  return out;
}
