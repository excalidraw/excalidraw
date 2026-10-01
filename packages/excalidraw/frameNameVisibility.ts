import { FRAME_STYLE } from "@excalidraw/common";

/** A frame and its name's width, in screen pixels. */
export type FrameNameLayout = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelWidth: number;
};

type Size = { width: number; height: number };

const MIN_HEIGHT = 60;
const FULL_HEIGHT = 90;
const MIN_WIDTH_PER_LABEL = 2;
const FULL_WIDTH_PER_LABEL = 3;
const LABEL_SPACING = 120;
export const FRAME_NAME_HEIGHT =
  FRAME_STYLE.nameFontSize * FRAME_STYLE.nameLineHeight +
  FRAME_STYLE.nameOffsetY;

const ramp = (value: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

const area = (f: FrameNameLayout) => f.width * f.height;

const contains = (outer: FrameNameLayout, inner: FrameNameLayout) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

const sizeOpacity = (f: FrameNameLayout) =>
  Math.min(
    ramp(
      f.width,
      f.labelWidth * MIN_WIDTH_PER_LABEL,
      f.labelWidth * FULL_WIDTH_PER_LABEL,
    ),
    ramp(f.height, MIN_HEIGHT, FULL_HEIGHT),
  );

const labelOnScreen = (f: FrameNameLayout, viewport: Size) =>
  f.x < viewport.width &&
  f.x + Math.min(f.width, f.labelWidth) > 0 &&
  f.y > 0 &&
  f.y - FRAME_NAME_HEIGHT < viewport.height;

// The frame the view is in: the innermost one holding the middle of the view and filling half of it.
const currentFrame = (frames: readonly FrameNameLayout[], viewport: Size) =>
  frames
    .filter(
      (f) =>
        f.x <= viewport.width / 2 &&
        f.y <= viewport.height / 2 &&
        f.x + f.width >= viewport.width / 2 &&
        f.y + f.height >= viewport.height / 2 &&
        (f.width >= viewport.width / 2 || f.height >= viewport.height / 2),
    )
    .reduce<FrameNameLayout | null>(
      (best, f) => (best && area(best) <= area(f) ? best : f),
      null,
    );

// Selected and hovered names show on top of the others without displacing
// them, so moving the pointer never reshuffles the rest of the board.
export const frameNameOpacities = (
  frames: readonly FrameNameLayout[],
  viewport: Size,
  pinnedIds: ReadonlySet<string>,
) => {
  const current = currentFrame(frames, viewport);
  const opacities = new Map<string, number>();
  const placed: FrameNameLayout[] = current ? [current] : [];
  const tooSmall = new Set<string>();
  const decided: FrameNameLayout[] = [];

  for (const f of [...frames].sort((a, b) => area(b) - area(a))) {
    const parent = decided.findLast((p) => contains(p, f));
    decided.push(f);
    const opacity = parent && tooSmall.has(parent.id) ? 0 : sizeOpacity(f);
    if (opacity === 0) {
      tooSmall.add(f.id);
    }
    if (pinnedIds.has(f.id) || f.id === current?.id) {
      opacities.set(f.id, 1);
      continue;
    }
    if (opacity === 0 || !labelOnScreen(f, viewport)) {
      opacities.set(f.id, opacity);
      continue;
    }
    const crowding = Math.max(
      0,
      ...placed
        .filter(
          (p) =>
            labelOnScreen(p, viewport) &&
            Math.hypot(p.x - f.x, p.y - f.y) < LABEL_SPACING,
        )
        .map((p) => opacities.get(p.id) ?? 1),
    );
    const shown = opacity * (1 - crowding);
    opacities.set(f.id, shown);
    if (shown > 0) {
      placed.push(f);
    }
  }

  return opacities;
};
