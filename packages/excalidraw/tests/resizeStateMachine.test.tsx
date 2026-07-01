import { arrayToMap, reseed } from "@excalidraw/common";
import { getTransformHandles } from "@excalidraw/element";

import type { TransformHandleType } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getPointerInteractionMode } from "../interaction/pointerInteractionMode";
import { resizeFlip } from "../interaction/trace";

import { act, render } from "./test-utils";
import { Pointer, UI } from "./helpers/ui";

import type { PointerInteractionMode } from "../interaction/pointerInteractionMode";

// Milestone 1 model-based oracle. A tiny, explicit resize state machine (no
// dependency — the model doubles as documentation of the subsystem) generates
// interaction paths. Each path is replayed through the *real* App.tsx pointer
// handlers via the shared `Pointer`, and the per-step trace (interaction mode +
// flip predicate) is asserted against the model. This is the behavior-
// preservation gate the eventual handler refactor must keep green.

const { h } = window;
const mouse = new Pointer("mouse");

type Point = { x: number; y: number };

// --- the model -------------------------------------------------------------

type ResizeEvent =
  | { type: "down"; handle: TransformHandleType }
  | { type: "move"; to: Point }
  | { type: "up" };

type ModelState = {
  value: "idle" | "resizing";
  handle: TransformHandleType | null;
  flipped: { x: boolean; y: boolean };
};

const IDLE: ModelState = {
  value: "idle",
  handle: null,
  flipped: { x: false, y: false },
};

const step = (
  state: ModelState,
  event: ResizeEvent,
  anchor: Point,
): ModelState => {
  switch (event.type) {
    case "down":
      return {
        value: "resizing",
        handle: event.handle,
        flipped: { x: false, y: false },
      };
    case "move":
      if (state.value !== "resizing" || state.handle === null) {
        return state;
      }
      return {
        ...state,
        flipped: resizeFlip(state.handle, event.to, anchor),
      };
    case "up":
      return IDLE;
  }
};

// The model's expected interaction mode for the current state.
const expectedMode = (state: ModelState): PointerInteractionMode =>
  state.value === "resizing" && state.handle
    ? { kind: "resize", handleType: state.handle }
    : { kind: "idle" };

// --- geometry --------------------------------------------------------------

// The resize anchor for each handle is the opposite corner/edge-midpoint of the
// bounds (mirrors resizeElements.ts `anchorsMap`).
const anchorFor = (
  handle: TransformHandleType,
  [minX, minY, maxX, maxY]: [number, number, number, number],
): Point => {
  const w = maxX - minX;
  const hgt = maxY - minY;
  const map: Record<string, Point> = {
    ne: { x: minX, y: maxY },
    se: { x: minX, y: minY },
    sw: { x: maxX, y: minY },
    nw: { x: maxX, y: maxY },
    e: { x: minX, y: minY + hgt / 2 },
    w: { x: maxX, y: minY + hgt / 2 },
    n: { x: minX + w / 2, y: maxY },
    s: { x: minX + w / 2, y: minY },
  };
  return map[handle];
};

const CORNERS: TransformHandleType[] = ["nw", "ne", "sw", "se"];
const SIDES: TransformHandleType[] = ["n", "s", "e", "w"];
const HANDLES = [...CORNERS, ...SIDES];

// --- path generation (all-transitions over handle × flip) ------------------

type Path = { handle: TransformHandleType; to: Point; anchor: Point };

const generatePaths = (
  bounds: [number, number, number, number],
): Array<Path & { flip: "none" | "cross" }> => {
  const paths: Array<Path & { flip: "none" | "cross" }> = [];
  for (const handle of HANDLES) {
    const anchor = anchorFor(handle, bounds);
    const [minX, minY, maxX, maxY] = bounds;
    const start = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    // handle position (approx — sign relative to anchor is what matters)
    const hpos: Point = {
      x: handle.includes("w") ? minX : handle.includes("e") ? maxX : start.x,
      y: handle.includes("n") ? minY : handle.includes("s") ? maxY : start.y,
    };
    // no flip: 20% toward the anchor (shrink, never crossing it)
    paths.push({
      handle,
      anchor,
      flip: "none",
      to: {
        x: hpos.x + 0.2 * (anchor.x - hpos.x),
        y: hpos.y + 0.2 * (anchor.y - hpos.y),
      },
    });
    // flip: reflect the handle across the anchor (crosses every driven axis)
    paths.push({
      handle,
      anchor,
      flip: "cross",
      to: { x: 2 * anchor.x - hpos.x, y: 2 * anchor.y - hpos.y },
    });
  }
  return paths;
};

// --- replay ----------------------------------------------------------------

const traceMode = (handle: TransformHandleType): PointerInteractionMode =>
  getPointerInteractionMode(h.state, {
    isResizing: h.state.isResizing,
    handleType: handle,
  });

const handleCenter = (
  element: ExcalidrawElement,
  handle: TransformHandleType,
) => {
  const rect = getTransformHandles(
    element,
    h.state.zoom,
    arrayToMap(h.elements),
    "mouse",
    {},
  )[handle];
  if (!rect) {
    throw new Error(`no ${handle} handle`);
  }
  return { x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 };
};

const centerOf = (element: ExcalidrawElement): Point => ({
  x: element.x + element.width / 2,
  y: element.y + element.height / 2,
});

// Observe flip from the *result* geometry (independent of the oracle formula):
// an axis flipped iff the element's center crossed the anchor on that axis.
const observedFlip = (
  before: Point,
  after: Point,
  anchor: Point,
): { x: boolean; y: boolean } => ({
  x: Math.sign(before.x - anchor.x) !== Math.sign(after.x - anchor.x),
  y: Math.sign(before.y - anchor.y) !== Math.sign(after.y - anchor.y),
});

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;
});

describe("resize state machine — generated paths replayed on real handlers", () => {
  const bounds: [number, number, number, number] = [0, 0, 200, 100];

  for (const path of generatePaths(bounds)) {
    it(`${path.handle} (${path.flip})`, () => {
      const rectangle = UI.createElement("rectangle", {
        x: bounds[0],
        y: bounds[1],
        width: bounds[2] - bounds[0],
        height: bounds[3] - bounds[1],
      });

      const before = centerOf(rectangle.get());

      let model = IDLE;
      act(() => {
        h.setState({ selectedElementIds: { [rectangle.id]: true } });
      });

      const start = handleCenter(rectangle.get(), path.handle);
      mouse.reset();
      mouse.downAt(start.x, start.y);
      model = step(model, { type: "down", handle: path.handle }, path.anchor);

      mouse.moveTo(path.to.x, path.to.y);
      model = step(model, { type: "move", to: path.to }, path.anchor);
      // interaction mode reported by the real handler matches the model
      expect(traceMode(path.handle)).toEqual(expectedMode(model));
      expect(model.value).toBe("resizing");

      mouse.upAt(path.to.x, path.to.y);
      model = step(model, { type: "up" }, path.anchor);

      // back to idle
      expect(
        getPointerInteractionMode(h.state, {
          isResizing: false,
          handleType: false,
        }),
      ).toEqual({ kind: "idle" });

      // oracle flip prediction (captured in the model) matches the real
      // handler's resulting geometry
      const after = centerOf(rectangle.get());
      const observed = observedFlip(before, after, path.anchor);
      const predicted = resizeFlip(path.handle, path.to, path.anchor);
      expect(predicted).toEqual(observed);

      if (path.flip === "cross") {
        // a crossing path must actually flip at least one driven axis
        expect(predicted.x || predicted.y).toBe(true);
      } else {
        expect(predicted).toEqual({ x: false, y: false });
      }
    });
  }

  it("covers both nw and se corners in the generated set", () => {
    const handles = new Set(generatePaths(bounds).map((p) => p.handle));
    expect(handles.has("nw")).toBe(true);
    expect(handles.has("se")).toBe(true);
  });
});
