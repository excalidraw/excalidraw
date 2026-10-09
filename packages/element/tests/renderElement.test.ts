import { vi } from "vitest";

import { drawRoughShapeWithClippedFill } from "../src/renderElement";

import type { NonDeletedExcalidrawElement } from "../src/types";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Drawable, OpSet } from "roughjs/bin/core";

const createRectangleElement = () =>
  ({
    type: "rectangle",
    width: 200,
    height: 100,
    roundness: null,
    strokeWidth: 1,
  } as NonDeletedExcalidrawElement);

const createEllipseElement = () =>
  ({
    type: "ellipse",
    width: 200,
    height: 100,
    roundness: null,
    strokeWidth: 1,
  } as NonDeletedExcalidrawElement);

const createContext = () => {
  const calls: string[] = [];

  const context = {
    save: vi.fn(() => calls.push("save")),
    beginPath: vi.fn(() => calls.push("beginPath")),
    moveTo: vi.fn(() => calls.push("moveTo")),
    lineTo: vi.fn(() => calls.push("lineTo")),
    bezierCurveTo: vi.fn(() => calls.push("bezierCurveTo")),
    closePath: vi.fn(() => calls.push("closePath")),
    rect: vi.fn(() => calls.push("rect")),
    clip: vi.fn(() => calls.push("clip")),
    restore: vi.fn(() => calls.push("restore")),
  } as unknown as CanvasRenderingContext2D;

  return { context, calls };
};

const createRoughCanvas = (calls: string[]) => {
  const draw = vi.fn((drawable: Drawable) => {
    calls.push(`draw:${drawable.sets.map((set) => set.type).join(",")}`);
  });

  return { draw } as unknown as RoughCanvas;
};

const createShape = (sets: OpSet[]): Drawable =>
  ({
    shape: "rectangle",
    sets,
    options: { hachureGap: 8 },
  } as Drawable);

const createFillSketchSet = () =>
  ({
    type: "fillSketch",
    ops: [
      { op: "move", data: [20, 20] },
      { op: "lineTo", data: [180, 80] },
    ],
  } as OpSet);

const createFillPathSet = () =>
  ({
    type: "fillPath",
    ops: [
      { op: "move", data: [20, 20] },
      { op: "lineTo", data: [180, 80] },
    ],
  } as OpSet);

const createOutlineSet = () =>
  ({
    type: "path",
    ops: [
      { op: "move", data: [-2, 0] },
      { op: "lineTo", data: [202, 0] },
      { op: "bcurveTo", data: [204, 20, 204, 80, 202, 100] },
      { op: "lineTo", data: [-2, 100] },
    ],
  } as OpSet);

describe("drawRoughShapeWithClippedFill", () => {
  it("clips patterned fillSketch sets before drawing the outline", () => {
    const fillSketchSet = createFillSketchSet();
    const outlineSet = createOutlineSet();
    const shape = createShape([fillSketchSet, outlineSet]);
    const { context, calls } = createContext();
    const rc = createRoughCanvas(calls);

    drawRoughShapeWithClippedFill(shape, createRectangleElement(), rc, context);

    expect(calls).toEqual([
      "save",
      "beginPath",
      "rect",
      "clip",
      "draw:fillSketch",
      "restore",
      "draw:path",
    ]);
    expect(rc.draw).toHaveBeenCalledTimes(2);
    expect(vi.mocked(rc.draw).mock.calls[0][0].sets[0].type).toBe("fillSketch");
    // fill geometry must reach the canvas untouched - the clip constrains what
    // is visible, it must not move the strokes
    expect(vi.mocked(rc.draw).mock.calls[0][0].sets[0]).toEqual(fillSketchSet);
    expect(vi.mocked(rc.draw).mock.calls[1][0].sets).toEqual([outlineSet]);
  });

  it("clips solid fillPath sets before drawing the outline", () => {
    const fillPathSet = createFillPathSet();
    const outlineSet = createOutlineSet();
    const shape = createShape([fillPathSet, outlineSet]);
    const { context, calls } = createContext();
    const rc = createRoughCanvas(calls);

    drawRoughShapeWithClippedFill(shape, createRectangleElement(), rc, context);

    expect(calls).toEqual([
      "save",
      "beginPath",
      "rect",
      "clip",
      "draw:fillPath",
      "restore",
      "draw:path",
    ]);
    expect(rc.draw).toHaveBeenCalledTimes(2);
    expect(vi.mocked(rc.draw).mock.calls[0][0].sets[0].type).toBe("fillPath");
    // fill geometry must reach the canvas untouched - the clip constrains what
    // is visible, it must not move the strokes
    expect(vi.mocked(rc.draw).mock.calls[0][0].sets[0]).toEqual(fillPathSet);
    expect(vi.mocked(rc.draw).mock.calls[1][0].sets).toEqual([outlineSet]);
  });

  it("uses the rough outline for ellipse fill clipping", () => {
    const fillSketchSet = createFillSketchSet();
    const outlineSet = createOutlineSet();
    const shape = createShape([fillSketchSet, outlineSet]);
    const { context, calls } = createContext();
    const rc = createRoughCanvas(calls);

    drawRoughShapeWithClippedFill(shape, createEllipseElement(), rc, context);

    expect(calls).toEqual([
      "save",
      "beginPath",
      "moveTo",
      "lineTo",
      "bezierCurveTo",
      "lineTo",
      "closePath",
      "clip",
      "draw:fillSketch",
      "restore",
      "draw:path",
    ]);
  });

  it("draws shapes without fill sets in one pass", () => {
    const outlineSet = { type: "path", ops: [] } as OpSet;
    const shape = createShape([outlineSet]);
    const { context, calls } = createContext();
    const rc = createRoughCanvas(calls);

    drawRoughShapeWithClippedFill(shape, createRectangleElement(), rc, context);

    expect(calls).toEqual(["draw:path"]);
    expect(rc.draw).toHaveBeenCalledWith(shape);
    expect(context.clip).not.toHaveBeenCalled();
  });
});
