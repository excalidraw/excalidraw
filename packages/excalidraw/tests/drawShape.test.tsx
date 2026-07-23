import { KEYS } from "@excalidraw/common";

import { getTargetElements, isArrowElement } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { getShapeActionPredicates } from "../components/shapeActionPredicates";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { GlobalTestState, act, fireEvent, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const sketch = (points: [number, number][]) => {
  const [startX, startY] = points[0];

  mouse.downAt(startX, startY);
  act(() => {
    for (const [x, y] of points.slice(1)) {
      h.app.drawShape.trail.addPointToPath(x, y);
    }
  });
  const [endX, endY] = points[points.length - 1];
  mouse.upAt(endX, endY);
};

/** a closed, roughly rectangular path */
const rectanglePath = (
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number][] => {
  const points: [number, number][] = [];
  const step = 10;
  for (let i = x; i <= x + width; i += step) {
    points.push([i, y]);
  }
  for (let i = y; i <= y + height; i += step) {
    points.push([x + width, i]);
  }
  for (let i = x + width; i >= x; i -= step) {
    points.push([i, y + height]);
  }
  for (let i = y + height; i >= y; i -= step) {
    points.push([x, i]);
  }
  points.push([x, y]);
  return points;
};

const seg = (
  from: [number, number],
  to: [number, number],
  steps: number,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    points.push([
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    ]);
  }
  return points;
};

/** a V-headed arrow: the shaft, then both head arms drawn back from the tip */
const arrowPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number][] => {
  const tip: [number, number] = [x2, y2];
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const headLength = length * 0.3;
  const headAngle = Math.PI / 6;
  const arm = (sign: number): [number, number] => [
    x2 -
      headLength * (ux * Math.cos(headAngle) - sign * uy * Math.sin(headAngle)),
    y2 -
      headLength * (uy * Math.cos(headAngle) + sign * ux * Math.sin(headAngle)),
  ];
  return [
    ...seg([x1, y1], tip, 20),
    ...seg(tip, arm(1), 8),
    ...seg(arm(1), tip, 8),
    ...seg(tip, arm(-1), 8),
  ];
};

/** a closed, roughly circular path */
const circlePath = (
  cx: number,
  cy: number,
  radius: number,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
    points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  return points;
};

describe("drawShape tool", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "drawShape" });
    });
  });

  it("converts a sketched rectangle into a rectangle element", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("rectangle");
  });

  it("converts a sketched circle into an ellipse element", () => {
    sketch(circlePath(300, 300, 80));

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("ellipse");
  });

  it("keeps the drawShape tool active after finalizing a shape", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("does not select the recognized element, so styles stay tool defaults", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("does not select a recognized arrow, yet still binds it", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 300,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    sketch(arrowPath(160, 160, 390, 290));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(h.state.selectedLinearElement).toBeNull();
    expect(h.state.selectedElementIds).toEqual({});

    expect(arrow.startBinding?.elementId).toBe(start.id);
    expect(arrow.endBinding?.elementId).toBe(end.id);
  });

  it("does not select a recognized arrow that binds nothing", () => {
    sketch(arrowPath(100, 100, 400, 300));

    expect(h.elements.map((element) => element.type)).toEqual(["arrow"]);
    expect(h.state.selectedLinearElement).toBeNull();
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("upgrades a line drawn between two bindable shapes to a bound arrow", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    sketch(seg([205, 205], [395, 395], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.elementId).toBe(start.id);
    expect(arrow.endBinding?.elementId).toBe(end.id);
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.selectedLinearElement).toBeNull();
  });

  it("orbit-binds arrows sketched from inside one shape into another, endpoints on the outlines", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    // starts and ends deep inside the shapes
    sketch(seg([150, 150], [450, 450], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.mode).toBe("orbit");
    expect(arrow.endBinding?.mode).toBe("orbit");

    // the endpoints were pulled out of the shape interiors onto the outlines
    const [endDx, endDy] = arrow.points[arrow.points.length - 1];
    expect(arrow.x).toBeGreaterThan(200);
    expect(arrow.y).toBeGreaterThan(200);
    expect(arrow.x + endDx).toBeLessThan(400);
    expect(arrow.y + endDy).toBeLessThan(400);
  });

  it("keeps inside-bindings for an arrow sketched within a single shape", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 500,
      height: 500,
    });
    API.setElements([container]);

    sketch(arrowPath(150, 300, 400, 300));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.mode).toBe("inside");
    expect(arrow.endBinding?.mode).toBe("inside");
    // the endpoints stay where they were drawn
    expect(arrow.x).toBeCloseTo(150, 0);
    expect(arrow.y).toBeCloseTo(300, 0);
  });

  it("keeps a line sketched within a single shape a line", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 500,
      height: 500,
    });
    API.setElements([container]);

    sketch(seg([150, 150], [450, 450], 30));

    expect(h.elements.map((element) => element.type)).toEqual([
      "rectangle",
      "line",
    ]);
  });

  it("upgrades a line from inside a shape to blank canvas into an arrow orbit-bound at the shape", () => {
    const only = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    API.setElements([only]);

    sketch(seg([150, 150], [395, 395], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.elementId).toBe(only.id);
    expect(arrow.startBinding?.mode).toBe("orbit");
    expect(arrow.endBinding).toBeNull();
    // the start was pulled out of the shape interior onto the outline
    expect(arrow.x).toBeGreaterThan(200);
    expect(arrow.y).toBeGreaterThan(200);
  });

  it("upgrades a line from blank canvas into a shape into an arrow orbit-bound at the shape", () => {
    const only = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([only]);

    sketch(seg([100, 100], [450, 450], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding).toBeNull();
    expect(arrow.endBinding?.elementId).toBe(only.id);
    expect(arrow.endBinding?.mode).toBe("orbit");
    // the end was pulled back onto the outline
    const [endDx, endDy] = arrow.points[arrow.points.length - 1];
    expect(arrow.x + endDx).toBeLessThan(400);
    expect(arrow.y + endDy).toBeLessThan(400);
  });

  it("keeps a line touching no shape a line", () => {
    sketch(seg([100, 100], [400, 400], 30));

    expect(h.elements.map((element) => element.type)).toEqual(["line"]);
  });

  it("allows sketching consecutive shapes without reselecting the tool", () => {
    sketch(rectanglePath(100, 100, 200, 120));
    sketch(circlePath(600, 300, 80));

    expect(h.elements).toHaveLength(2);
    expect(h.elements[0].type).toBe("rectangle");
    expect(h.elements[1].type).toBe("ellipse");
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("ignores a sketch too small to be a shape", () => {
    sketch([
      [100, 100],
      [101, 101],
      [102, 100],
      [101, 99],
    ]);

    expect(h.elements).toHaveLength(0);
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("applies its own cursor while active", () => {
    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("url(");
  });
});

describe("drawShape styles panel & selection (preview path)", () => {
  /**
   * Unlike `sketch`, also drives the pointermove handler, so
   * `state.newElement` holds the live recognition preview mid-gesture the way
   * it does in the real app.
   */
  const sketchWithPreview = (points: [number, number][]) => {
    const [startX, startY] = points[0];

    mouse.downAt(startX, startY);
    act(() => {
      for (const [x, y] of points.slice(1)) {
        h.app.drawShape.trail.addPointToPath(x, y);
        h.app.drawShape.handlePointerMove({ x, y });
      }
    });
    const [endX, endY] = points[points.length - 1];
    mouse.upAt(endX, endY);
  };

  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "drawShape" });
    });
  });

  it("does not select a recognized arrow drawn with a live preview", () => {
    sketchWithPreview(arrowPath(100, 100, 400, 300));

    expect(h.elements.map((element) => element.type)).toEqual(["arrow"]);
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.selectedLinearElement).toBeNull();
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("does not select a recognized rectangle drawn with a live preview", () => {
    sketchWithPreview(rectanglePath(100, 100, 200, 120));

    expect(h.elements.map((element) => element.type)).toEqual(["rectangle"]);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("upgrades a line between two bindable shapes identically with a live preview", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    sketchWithPreview(seg([205, 205], [395, 395], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.elementId).toBe(start.id);
    expect(arrow.endBinding?.elementId).toBe(end.id);
    expect(h.state.newElement).toBeNull();
  });

  it("keeps the styles panel on tool defaults while sketching", () => {
    mouse.downAt(100, 100);
    act(() => {
      for (const [x, y] of rectanglePath(100, 100, 200, 120).slice(1)) {
        h.app.drawShape.trail.addPointToPath(x, y);
        h.app.drawShape.handlePointerMove({ x, y });
      }
    });

    // the preview exists, but the styles panel must not target it — it keeps
    // showing the tool defaults
    expect(h.state.newElement?.type).toBe("rectangle");
    const targetElements = getTargetElements(
      h.app.scene.getNonDeletedElementsMap(),
      h.state,
    );
    expect(targetElements).toEqual([]);

    // the drawShape panel is limited to stroke color, background, fill style
    // and stroke style
    const predicates = getShapeActionPredicates(
      h.state,
      targetElements,
      h.app.scene.getNonDeletedElementsMap(),
      h.app,
    );
    expect(predicates.strokeColor).toBe(true);
    expect(predicates.backgroundColor).toBe(true);
    expect(predicates.strokeStyle).toBe(true);
    // fill follows the standard rule: hidden while the background is
    // transparent (the default), shown otherwise
    expect(predicates.fill).toBe(false);
    expect(predicates.strokeWidth).toBe(false);
    expect(predicates.sloppiness).toBe(true);
    expect(predicates.roundness).toBe(false);
    expect(predicates.opacity).toBe(false);
    expect(predicates.layers).toBe(false);

    act(() => {
      h.setState({ currentItemBackgroundColor: "#ffc9c9" });
    });
    expect(
      getShapeActionPredicates(
        h.state,
        targetElements,
        h.app.scene.getNonDeletedElementsMap(),
        h.app,
      ).fill,
    ).toBe(true);

    mouse.upAt(300, 220);
    expect(h.state.selectedElementIds).toEqual({});
  });
});

describe("drawShape tool activation", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("activates via its keyboard shortcut", () => {
    expect(h.state.activeTool.type).toBe("selection");

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.X);
    });

    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("is not activated by an unmodified X (freedraw's shortcut)", () => {
    Keyboard.keyPress(KEYS.X);

    expect(h.state.activeTool.type).toBe("freedraw");
  });

  it("activates from the extra tools dropdown", () => {
    fireEvent.click(
      GlobalTestState.renderResult.container.querySelector(
        ".App-toolbar__extra-tools-trigger",
      )!,
    );

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-drawShape"]',
      )!,
    );

    expect(h.state.activeTool.type).toBe("drawShape");
  });
});
