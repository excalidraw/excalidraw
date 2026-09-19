import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { render } from "@excalidraw/excalidraw/tests/test-utils";
import { createUndoAction } from "@excalidraw/excalidraw/actions/actionHistory";
import "@excalidraw/utils/test-utils";

import type { Bounds } from "@excalidraw/common";

import type { ExcalidrawArrowElement } from "../src/types";

const { h } = window;

const mouse = new Pointer("mouse");

/** Absolute (scene) coordinates of an arrow's points. */
const scenePoints = (arrow: ExcalidrawArrowElement) =>
  arrow.points.map(([x, y]) => [arrow.x + x, arrow.y + y] as [number, number]);

/**
 * Whether any segment of the arrow runs through `box`.
 *
 * Elbow segments are axis aligned, so an overlap test per segment is enough —
 * no need for a general segment/rect intersection.
 */
const crosses = (arrow: ExcalidrawArrowElement, box: Bounds) => {
  const [bx1, by1, bx2, by2] = box;
  const points = scenePoints(arrow);

  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const sx1 = Math.min(x1, x2);
    const sx2 = Math.max(x1, x2);
    const sy1 = Math.min(y1, y2);
    const sy2 = Math.max(y1, y2);

    if (sx1 < bx2 && sx2 > bx1 && sy1 < by2 && sy2 > by1) {
      return true;
    }
  }

  return false;
};

const boundsOf = (element: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Bounds => [
  element.x,
  element.y,
  element.x + element.width,
  element.y + element.height,
];

const drawElbowArrow = (from: [number, number], to: [number, number]) => {
  UI.clickTool("arrow");
  UI.clickOnTestId("elbow-arrow");

  mouse.reset();
  mouse.moveTo(from[0], from[1]);
  mouse.click();
  mouse.moveTo(to[0], to[1]);
  mouse.click();

  return h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;
};

/** Two 100x100 rectangles facing each other across an empty 400px corridor. */
const createEndpointShapes = () => {
  const start = UI.createElement("rectangle", {
    x: -300,
    y: -50,
    width: 100,
    height: 100,
  });
  const end = UI.createElement("rectangle", {
    x: 200,
    y: -50,
    width: 100,
    height: 100,
  });

  return { start, end };
};

describe("elbow arrow obstacle avoidance", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("routes around a shape sitting directly between the bound shapes", () => {
    createEndpointShapes();
    const blocker = UI.createElement("rectangle", {
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });

    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);
    expect(crosses(arrow, boundsOf(blocker))).toBe(false);
  });

  it("routes around several shapes in the corridor", () => {
    createEndpointShapes();
    const first = UI.createElement("rectangle", {
      x: -150,
      y: -50,
      width: 100,
      height: 100,
    });
    const second = UI.createElement("rectangle", {
      x: 20,
      y: -50,
      width: 100,
      height: 100,
    });

    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    expect(crosses(arrow, boundsOf(first))).toBe(false);
    expect(crosses(arrow, boundsOf(second))).toBe(false);
  });

  it("routes around a shape added to the board after the arrow", () => {
    createEndpointShapes();
    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    const blocker = UI.createElement("rectangle", {
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });

    expect(crosses(arrow, boundsOf(blocker))).toBe(false);
  });

  it("re-routes when a shape is dragged into the arrow's path", () => {
    createEndpointShapes();
    const blocker = UI.createElement("rectangle", {
      x: -50,
      y: 300,
      width: 100,
      height: 100,
    });
    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    mouse.reset();
    mouse.select(blocker);
    mouse.downAt(0, 350);
    mouse.moveTo(0, 0);
    mouse.up();

    expect(crosses(arrow, boundsOf(blocker))).toBe(false);
  });

  it("goes straight again when the blocking shape is dragged away", () => {
    createEndpointShapes();
    const blocker = UI.createElement("rectangle", {
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });
    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    // detoured while the blocker is in the way
    expect(arrow.points.length).toBeGreaterThan(2);

    mouse.reset();
    mouse.select(blocker);
    mouse.downAt(0, 0);
    mouse.moveTo(0, 400);
    mouse.up();

    // nothing is in the way any more, so the route should be a straight run
    expect(arrow.points.length).toBe(2);
  });

  it("routes through a frame instead of around it", () => {
    createEndpointShapes();
    API.setElements([
      ...h.elements,
      API.createElement({
        type: "frame",
        x: -150,
        y: -150,
        width: 300,
        height: 300,
      }),
    ]);

    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    // a frame is a container, not something to go around
    expect(arrow.points.length).toBe(2);
  });

  it("treats a locked shape as an obstacle", () => {
    createEndpointShapes();
    const blocker = API.createElement({
      type: "rectangle",
      x: -50,
      y: -50,
      width: 100,
      height: 100,
      locked: true,
    });
    API.setElements([...h.elements, blocker]);

    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    expect(crosses(arrow, boundsOf(blocker))).toBe(false);
  });

  it("routes around a shape that lives inside a frame", () => {
    createEndpointShapes();
    const blocker = UI.createElement("rectangle", {
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });
    API.setElements([
      ...h.elements,
      API.createElement({
        type: "frame",
        x: -150,
        y: -150,
        width: 300,
        height: 300,
      }),
    ]);
    const frame = h.elements[h.elements.length - 1];
    h.app.scene.mutateElement(blocker, { frameId: frame.id });

    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    // the frame itself is transparent to the router, its children are not
    expect(crosses(arrow, boundsOf(blocker))).toBe(false);
  });

  it("treats a move and the reroutes it causes as one undo step", () => {
    createEndpointShapes();
    const blocker = UI.createElement("rectangle", {
      x: -50,
      y: 300,
      width: 100,
      height: 100,
    });
    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    const pointsBefore = arrow.points.length;
    expect(pointsBefore).toBe(2);

    mouse.reset();
    mouse.select(blocker);
    mouse.downAt(0, 350);
    mouse.moveTo(0, 0);
    mouse.up();

    expect(arrow.points.length).toBeGreaterThan(2);
    expect(blocker.y).toBe(-50);

    API.executeAction(createUndoAction(h.history));

    // history swaps element objects, so re-read both from the scene
    const blockerAfter = h.elements.find((el) => el.id === blocker.id)!;
    const arrowAfter = h.elements.find(
      (el) => el.id === arrow.id,
    ) as ExcalidrawArrowElement;

    // one undo puts back both the shape and the route it displaced
    expect(blockerAfter.y).toBe(300);
    expect(arrowAfter.points.length).toBe(pointsBefore);
  });

  it("computes the same route every time it is recomputed", () => {
    createEndpointShapes();
    UI.createElement("rectangle", {
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 60,
      y: -170,
      width: 80,
      height: 120,
    });

    const arrow = drawElbowArrow([-210, 0], [210, 0]);
    const first = JSON.stringify(scenePoints(arrow));

    // routing keeps a memo of what the last route avoided; recomputing must
    // not let that memo drift the answer, or collaborators would diverge
    for (let i = 0; i < 5; i++) {
      h.app.scene.mutateElement(arrow, { points: arrow.points });
      expect(JSON.stringify(scenePoints(arrow))).toBe(first);
    }
  });

  it("falls back to a direct route when the end shape is fully enclosed", () => {
    createEndpointShapes();
    // a ring of shapes boxing the end rectangle in
    API.setElements([
      ...h.elements,
      API.createElement({
        type: "rectangle",
        x: 150,
        y: -120,
        width: 220,
        height: 40,
      }),
      API.createElement({
        type: "rectangle",
        x: 150,
        y: 80,
        width: 220,
        height: 40,
      }),
      API.createElement({
        type: "rectangle",
        x: 150,
        y: -120,
        width: 40,
        height: 240,
      }),
      API.createElement({
        type: "rectangle",
        x: 330,
        y: -120,
        width: 40,
        height: 240,
      }),
    ]);

    const arrow = drawElbowArrow([-210, 0], [210, 0]);

    // no route exists, but the arrow must still be drawn and still be bound
    expect(arrow.points.length).toBeGreaterThanOrEqual(2);
    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);
  });
});

describe("elbow arrow binding to non-rectangular shapes", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("binds when the end is released over a diamond's bounding box corner", () => {
    UI.createElement("rectangle", {
      x: -300,
      y: -50,
      width: 100,
      height: 100,
    });
    const diamond = UI.createElement("diamond", {
      x: 200,
      y: -50,
      width: 100,
      height: 100,
    });

    // inside the diamond's bounding box, outside its outline
    const arrow = drawElbowArrow([-210, 0], [207, -43]);

    expect(arrow.endBinding?.elementId).toBe(diamond.id);
  });

  it("binds when the end is released just outside a diamond's left vertex", () => {
    UI.createElement("rectangle", {
      x: -300,
      y: -50,
      width: 100,
      height: 100,
    });
    const diamond = UI.createElement("diamond", {
      x: 200,
      y: -50,
      width: 100,
      height: 100,
    });

    const arrow = drawElbowArrow([-210, 0], [196, 0]);

    expect(arrow.endBinding?.elementId).toBe(diamond.id);
  });

  it("binds when the end is released over an ellipse's bounding box corner", () => {
    UI.createElement("rectangle", {
      x: -300,
      y: -50,
      width: 100,
      height: 100,
    });
    const ellipse = UI.createElement("ellipse", {
      x: 200,
      y: -50,
      width: 100,
      height: 100,
    });

    const arrow = drawElbowArrow([-210, 0], [203, -47]);

    expect(arrow.endBinding?.elementId).toBe(ellipse.id);
  });
});
