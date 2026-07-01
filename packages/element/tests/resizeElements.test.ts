import {
  resizeFlip,
  isInverted,
} from "@excalidraw/excalidraw/interaction/trace";

import { getCursorForResizingElement } from "../src/resizeTest";

import type { TransformHandleDirection } from "../src/transformHandles";

// Milestone 1 oracle validation, bypassing the DOM. The flip-condition logic
// (resizeElements.ts `getNextMultipleWidthAndHeightFromPointer`, the
// `flipConditionsMap`) is not exported — it's applied via computed inputs — so
// we validate the trace `resizeFlip` oracle against an independent transcription
// of that map. Agreement between the two differently-structured implementations
// is the check that the oracle faithfully models the real branch.

// Transcribed verbatim from resizeElements.ts `flipConditionsMap`. Each entry is
// [flipX, flipY] as a function of pointer vs anchor.
const referenceFlip = (
  handle: TransformHandleDirection,
  p: { x: number; y: number },
  a: { x: number; y: number },
): { x: boolean; y: boolean } => {
  const map: Record<TransformHandleDirection, [boolean, boolean]> = {
    ne: [p.x < a.x, p.y > a.y],
    se: [p.x < a.x, p.y < a.y],
    sw: [p.x > a.x, p.y < a.y],
    nw: [p.x > a.x, p.y > a.y],
    e: [p.x < a.x, false],
    w: [p.x > a.x, false],
    n: [false, p.y > a.y],
    s: [false, p.y < a.y],
  };
  const [x, y] = map[handle];
  return { x, y };
};

const HANDLES: TransformHandleDirection[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

// pointer in every quadrant around the anchor, plus on-axis ties
const anchor = { x: 0, y: 0 };
const POINTERS = [
  { x: 5, y: 5 },
  { x: -5, y: 5 },
  { x: 5, y: -5 },
  { x: -5, y: -5 },
  { x: 0, y: 5 },
  { x: 5, y: 0 },
  { x: 0, y: 0 },
];

describe("resizeFlip oracle matches the source flipConditionsMap", () => {
  for (const handle of HANDLES) {
    it(`handle ${handle}`, () => {
      for (const p of POINTERS) {
        expect(resizeFlip(handle, p, anchor)).toEqual(
          referenceFlip(handle, p, anchor),
        );
      }
    });
  }

  it("only flips along axes the handle drives", () => {
    // side handles never flip on their fixed axis regardless of pointer
    expect(resizeFlip("e", { x: 100, y: -100 }, anchor).y).toBe(false);
    expect(resizeFlip("w", { x: -100, y: 100 }, anchor).y).toBe(false);
    expect(resizeFlip("n", { x: 100, y: 100 }, anchor).x).toBe(false);
    expect(resizeFlip("s", { x: -100, y: -100 }, anchor).x).toBe(false);
  });
});

describe("inversion predicate and cursor (resizeTest.ts)", () => {
  const cursor = (
    width: number,
    height: number,
    handle: "nw" | "se" | "ne" | "sw",
  ) =>
    getCursorForResizingElement({
      element: { width, height, angle: 0 } as any,
      transformHandleType: handle,
    });

  it("isInverted is true only when width/height have opposite signs", () => {
    expect(isInverted({ width: 100, height: 50 })).toBe(false);
    expect(isInverted({ width: -100, height: -50 })).toBe(false);
    expect(isInverted({ width: -100, height: 50 })).toBe(true);
    expect(isInverted({ width: 100, height: -50 })).toBe(true);
  });

  // Exit-gate: both nw/se inverted-cursor cases must be exercised.
  it("nw/se cursor swaps under inversion, matches isInverted", () => {
    expect(cursor(100, 50, "nw")).toBe("nwse-resize");
    expect(cursor(100, 50, "se")).toBe("nwse-resize");
    // inverted → swapped diagonal
    expect(cursor(-100, 50, "nw")).toBe("nesw-resize");
    expect(cursor(-100, 50, "se")).toBe("nesw-resize");
    expect(isInverted({ width: -100, height: 50 })).toBe(true);
  });

  it("ne/sw cursor swaps under inversion too", () => {
    expect(cursor(100, 50, "ne")).toBe("nesw-resize");
    expect(cursor(100, 50, "sw")).toBe("nesw-resize");
    expect(cursor(100, -50, "ne")).toBe("nwse-resize");
    expect(cursor(100, -50, "sw")).toBe("nwse-resize");
  });
});
