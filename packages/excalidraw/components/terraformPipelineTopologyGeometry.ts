/**
 * Title-aware geometry helpers for pipeline topology hull frames.
 *
 * Topology frames render a name label *above* the rectangle. When checking
 * whether two hulls can share space (collision diagnostics) or advancing a
 * forced vertical band (role-aware packing), the label area must be included —
 * otherwise a frame title silently overlaps the rectangle (or primary card)
 * stacked above it. See REGION_SUBNET_VERTICAL_BANDS_PLAN.md.
 */
import { FRAME_STYLE } from "@excalidraw/common";

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Vertical space a frame's name label consumes above its rectangle. Mirrors
 * the renderer: `nameFontSize * nameLineHeight + nameOffsetY`.
 */
export const PIPELINE_FRAME_TITLE_HEIGHT =
  FRAME_STYLE.nameFontSize * FRAME_STYLE.nameLineHeight +
  FRAME_STYLE.nameOffsetY;

/** Strict rectangle overlap (shared edges do not count as overlapping). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Strict vertical-interval overlap, ignoring X (distinct-band test). */
export function yIntervalsOverlap(a: Rect, b: Rect): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Just the title strip above a frame rectangle. */
export function frameTitleRect(frame: Rect): Rect {
  return {
    x: frame.x,
    y: frame.y - PIPELINE_FRAME_TITLE_HEIGHT,
    width: frame.width,
    height: PIPELINE_FRAME_TITLE_HEIGHT,
  };
}

/** Frame rectangle extended upward to include its title label. */
export function topologyFrameCollisionHull(frame: Rect): Rect {
  return {
    x: frame.x,
    y: frame.y - PIPELINE_FRAME_TITLE_HEIGHT,
    width: frame.width,
    height: frame.height + PIPELINE_FRAME_TITLE_HEIGHT,
  };
}

/** Bounding union of a set of rectangles (null when empty). */
export function unionTopologyHulls(rects: readonly Rect[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
