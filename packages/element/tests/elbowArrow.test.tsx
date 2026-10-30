import { ARROW_TYPE, DEFAULT_ZOOM } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import { actionSelectAll } from "@excalidraw/excalidraw/actions";
import { actionChangeArrowhead } from "@excalidraw/excalidraw/actions/actionProperties";
import { actionDuplicateSelection } from "@excalidraw/excalidraw/actions/actionDuplicateSelection";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  queryByTestId,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";
import "@excalidraw/utils/test-utils";
import { bindBindingElement, validateElbowPoints } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import { Scene } from "../src/Scene";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
  NonDeleted,
} from "../src/types";

const { h } = window;

const mouse = new Pointer("mouse");

describe("elbow arrow segment move", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("can move the second segment of a fully connected elbow arrow", () => {
    UI.createElement("rectangle", {
      x: -100,
      y: -50,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 200,
      y: 150,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(200, 200);
    mouse.click();

    mouse.reset();
    mouse.moveTo(100, 100);
    mouse.down();
    mouse.moveTo(115, 100);
    mouse.up();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawElbowArrowElement;

    expect(h.state.selectedElementIds).toEqual({ [arrow.id]: true });
    expect(arrow.fixedSegments?.length).toBe(1);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [110, 0],
      [110, 200],
      [190, 200],
    ]);

    mouse.reset();
    mouse.moveTo(105, 74.275);
    mouse.doubleClick();

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [110, 0],
      [110, 200],
      [190, 200],
    ]);
  });

  it("can move the second segment of an unconnected elbow arrow", () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(250, 200);
    mouse.click();

    mouse.reset();
    mouse.moveTo(125, 100);
    mouse.down();
    mouse.moveTo(130, 100);
    mouse.up();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [130, 0],
      [130, 200],
      [250, 200],
    ]);

    mouse.reset();
    mouse.moveTo(130, 100);
    mouse.doubleClick();

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [125, 0],
      [125, 200],
      [250, 200],
    ]);
  });
});

describe("elbow arrow routing", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("can properly generate orthogonal arrow points", () => {
    const scene = new Scene();
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
    }) as NonDeleted<ExcalidrawElbowArrowElement>;
    scene.insertElement(arrow);
    h.app.scene.mutateElement(arrow, {
      points: [
        pointFrom<LocalPoint>(-45 - arrow.x, -100.1 - arrow.y),
        pointFrom<LocalPoint>(45 - arrow.x, 99.9 - arrow.y),
      ],
    });
    expect(arrow.points).toEqual([
      [0, 0],
      [0, 100],
      [90, 100],
      [90, 200],
    ]);
    expect(arrow.x).toEqual(-45);
    expect(arrow.y).toEqual(-100.1);
    expect(arrow.width).toEqual(90);
    expect(arrow.height).toEqual(200);
  });

  it("can generate proper points for bound elbow arrow", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    }) as NonDeleted<ExcalidrawBindableElement>;
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    }) as NonDeleted<ExcalidrawBindableElement>;
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: -45,
      y: -100.1,
      width: 90,
      height: 200,
      points: [pointFrom(0, 0), pointFrom(90, 200)],
    }) as NonDeleted<ExcalidrawElbowArrowElement>;
    API.setElements([rectangle1, rectangle2, arrow]);

    bindBindingElement(
      arrow,
      rectangle1,
      "orbit",
      "start",
      h.scene,
      DEFAULT_ZOOM,
    );
    bindBindingElement(
      arrow,
      rectangle2,
      "orbit",
      "end",
      h.scene,
      DEFAULT_ZOOM,
    );

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);

    h.scene.mutateElement(arrow, {
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(90, 200)],
    });

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [39, 0],
      [39, 200],
      [78, 200],
    ]);
  });
});

describe("elbow arrow ui", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
  });

  it("can follow bound shapes", async () => {
    UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);

    mouse.reset();
    mouse.moveTo(-53, -99);
    mouse.click();
    mouse.moveTo(53, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(arrow.type).toBe("arrow");
    expect(arrow.elbowed).toBe(true);
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [39, 0],
      [39, 200],
      [78, 200],
    ]);
  });

  it("can follow bound rotated shapes", async () => {
    UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(-53, -99);
    mouse.click();
    mouse.moveTo(53, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    mouse.click(51, 51);

    const inputAngle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    UI.updateInput(inputAngle, String("40"));

    expect(arrow.points.map((point) => point.map(Math.round))).toEqual([
      [0, 0],
      [51, 0],
      [51, 164],
      [101, 164],
    ]);
  });

  it("keeps arrow shape when the whole set of arrow and bindables are duplicated", async () => {
    UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(-53, -99);
    mouse.click();
    mouse.moveTo(53, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;
    const originalArrowId = arrow.id;

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);

    act(() => {
      h.app.actionManager.executeAction(actionSelectAll);
    });

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    expect(h.elements.length).toEqual(6);

    const duplicatedArrow = h.scene.getSelectedElements(
      h.state,
    )[2] as ExcalidrawArrowElement;

    expect(duplicatedArrow.id).not.toBe(originalArrowId);
    expect(duplicatedArrow.type).toBe("arrow");
    expect(duplicatedArrow.elbowed).toBe(true);
    expect(duplicatedArrow.points).toCloselyEqualPoints([
      [0, 0],
      [39, 0],
      [39, 200],
      [78, 200],
    ]);
    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);
  });

  it("changes arrow shape to unbind variant if only the connected elbow arrow is duplicated", async () => {
    UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(-53, -99);
    mouse.click();
    mouse.moveTo(53, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;
    const originalArrowId = arrow.id;

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    expect(h.elements.length).toEqual(4);

    const duplicatedArrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(duplicatedArrow.id).not.toBe(originalArrowId);
    expect(duplicatedArrow.type).toBe("arrow");
    expect(duplicatedArrow.elbowed).toBe(true);
    expect(duplicatedArrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, 100],
      [78, 100],
      [78, 200],
    ]);
  });
});

describe("elbow arrow routes with one or two corners", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const connect = (diamondY: number) => {
    // the rectangle's right side's middle is at y = 127.5
    UI.createElement("rectangle", { x: 0, y: 100, width: 120, height: 55 });
    UI.createElement("diamond", {
      x: 220,
      y: diamondY,
      width: 200,
      height: 124,
    });
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");
    mouse.reset();
    mouse.moveTo(120, 127.5);
    mouse.click();
    mouse.moveTo(320, diamondY);
    mouse.click();

    return h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawElbowArrowElement;
  };

  it("connects elements closer than the padding with a single corner", () => {
    // 40px from the rectangle's side to the diamond's top: no step to the
    // padding around the diamond on the way
    const arrow = connect(167.5);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 34.15],
    ]);
  });

  it("routes around the elements when a single corner doesn't fit", () => {
    const arrow = connect(167.5);

    // the rectangle below the diamond's top: the corner would be inside it
    UI.clickTool("selection");
    mouse.reset();
    mouse.moveTo(60, 100);
    mouse.down();
    mouse.moveTo(60, 180);
    mouse.up();

    expect(arrow.points.length).toBeGreaterThan(3);
  });

  it("doesn't put the arrowhead on a leg too short for it", () => {
    // 25px from the rectangle's side to the diamond's top
    const arrow = connect(152.5);

    expect(arrow.points.length).toBeGreaterThan(3);
  });

  it("routes again to fit an arrowhead added to a short leg", () => {
    API.setAppState({ currentItemEndArrowhead: null });
    // about 10px from the rectangle's side to the diamond's top
    const arrow = connect(143.5);
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 10.15],
    ]);

    act(() => {
      h.app.actionManager.executeAction(actionChangeArrowhead, "ui", {
        position: "end",
        type: "arrow",
      });
    });

    const updated = h.elements.find(
      (element) => element.id === arrow.id,
    ) as ExcalidrawElbowArrowElement;
    const [corner, end] = updated.points.slice(-2);
    expect(updated.endArrowhead).toBe("arrow");
    expect(end[1] - corner[1]).toBeGreaterThanOrEqual(25);
  });

  it("doesn't route a leg too short to keep its corner", () => {
    // the arrow leaves the box above at x = 134, and enters the one below
    // at x = 139, a leg too short to round its corner
    UI.createElement("rectangle", { x: 0, y: 0, width: 128, height: 100 });
    UI.createElement("rectangle", { x: 100, y: 200, width: 128, height: 100 });
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");
    mouse.reset();
    mouse.moveTo(128, 50);
    mouse.click();
    mouse.moveTo(139, 200);
    mouse.click();

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawElbowArrowElement;
    expect(arrow.points.length).toBeGreaterThan(3);
    expect(validateElbowPoints(arrow.points)).toBe(true);
  });

  it("keeps clear of an element by its binding gap, thick strokes included", () => {
    const connectEllipse = (strokeWidth: number) => {
      API.setAppState({ currentItemEndArrowhead: null });
      // the ellipse's top is 12px below the rectangle's side's middle, and
      // the arrow enters its upper left, below its top
      UI.createElement("rectangle", { x: 0, y: 100, width: 120, height: 55 });
      UI.createElement("ellipse", {
        x: 220,
        y: 139.5,
        width: 200,
        height: 124,
      });
      API.updateElement(h.elements[1], { strokeWidth });
      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.moveTo(120, 127.5);
      mouse.click();
      mouse.moveTo(260, 151.9);
      mouse.click();

      return h.elements.find(
        (element) => element.type === "arrow",
      ) as ExcalidrawElbowArrowElement;
    };

    // a binding gap of 6px: the corner above the ellipse fits
    expect(connectEllipse(2).points.length).toBe(3);

    API.setElements([]);
    // 15px: the first leg would run over the stroke
    expect(connectEllipse(20).points.length).toBeGreaterThan(3);
  });

  it("connects elements with a single corner when a fixed segment lines up with the start", () => {
    const arrow = connect(167.5);

    // a step down, the arrow is routed around the diamond, and the segment
    // above it is fixed at the rectangle's previous middle
    UI.clickTool("selection");
    mouse.reset();
    mouse.moveTo(0, 120);
    mouse.down();
    mouse.moveTo(0, 140);
    mouse.up();
    h.app.scene.mutateElement(arrow, {
      fixedSegments: [
        {
          index: 3,
          start: pointFrom<LocalPoint>(44, -20),
          end: pointFrom<LocalPoint>(195, -20),
        },
      ],
    });
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [44, 0],
      [44, -20],
      [195, -20],
      [195, 14.15],
    ]);

    // and back up, the first leg lines up with the fixed segment
    mouse.reset();
    mouse.moveTo(0, 140);
    mouse.down();
    mouse.moveTo(0, 120);
    mouse.up();

    expect(arrow.fixedSegments ?? []).toEqual([]);
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 34.15],
    ]);
  });

  // a box, and another one `gap` px below and to the right of it, connected
  // from the bottom of one to the top of the other
  const connectBelow = (gap: number) => {
    UI.createElement("rectangle", { x: 0, y: 0, width: 278, height: 135 });
    UI.createElement("rectangle", {
      x: 518,
      y: 135 + gap,
      width: 278,
      height: 135,
    });
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");
    mouse.reset();
    mouse.moveTo(139, 135);
    mouse.click();
    mouse.moveTo(657, 135 + gap);
    mouse.click();

    return h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawElbowArrowElement;
  };

  it("connects elements closer than the padding with two corners, turning halfway", () => {
    API.setAppState({ currentItemEndArrowhead: null });
    const arrow = connectBelow(84);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, 36],
      [518, 36],
      [518, 72],
    ]);
  });

  it("turns closer to the end without an arrowhead to leave the arrowhead the padding", () => {
    const arrow = connectBelow(84);

    // 72px apart: the leg to the arrowhead gets the padding, and the other
    // leg the rest, still enough to round its corner
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, 32],
      [518, 32],
      [518, 72],
    ]);
  });

  it("turns halfway as on the grid when there's room", () => {
    const arrow = connectBelow(120);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, 54],
      [518, 54],
      [518, 108],
    ]);
  });

  it("doesn't put the arrowhead on a half too short for it", () => {
    const arrow = connectBelow(40);

    expect(arrow.points.length).toBeGreaterThan(4);
  });
});
