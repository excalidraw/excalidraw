import { ARROW_TYPE, DEFAULT_ZOOM, arrayToMap } from "@excalidraw/common";
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
import {
  bindBindingElement,
  updateElbowArrowPoints,
  updateElbowArrowRoute,
  validateElbowPoints,
} from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import { getBindingGap } from "../src/binding";
import { Scene } from "../src/Scene";
import { ELBOW_ARROW_CORNER_RADIUS } from "../src/shape";
import { MIN_LEG, PADDING } from "../src/elbowArrowTemplates";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
  FixedPoint,
  NonDeleted,
  NonDeletedSceneElementsMap,
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

    // the moved segment is where it was dragged to
    expect(arrow.x + arrow.points[1][0]).toBeCloseTo(115);
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [109, 0],
      [109, 200],
      [188, 200],
    ]);

    mouse.reset();
    mouse.moveTo(105, 74.275);
    mouse.doubleClick();

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [109, 0],
      [109, 200],
      [188, 200],
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

  it("can move an elbow arrow to the origin while routing it", () => {
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 5,
      y: 5,
      points: [pointFrom(0, 0), pointFrom(100, 0)],
    }) as NonDeleted<ExcalidrawElbowArrowElement>;
    API.setElements([arrow]);

    h.scene.mutateElement(arrow, { x: 0, y: 0, points: arrow.points });

    expect([arrow.x, arrow.y]).toEqual([0, 0]);
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
      [44, 0],
      [44, 200],
      [88, 200],
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
      [44, 0],
      [44, 200],
      [88, 200],
    ]);
  });

  it("enters a side its end is dragged onto from inside its element by that side", () => {
    // a loop from the right of a wide rectangle, with the end dragged inside
    // it towards the top, near its right: the end snaps onto the top (much
    // further from the center sideways than up), and the arrow enters it
    // from above, as it does once bound, rather than along it
    UI.createElement("rectangle", { x: 0, y: 0, width: 200, height: 100 });
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");
    mouse.reset();
    mouse.moveTo(200, 50);
    mouse.down();
    for (let i = 1; i <= 4; i++) {
      mouse.moveTo(200 - (50 * i) / 6, 50 - (50 * i) / 6);
    }

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawElbowArrowElement;
    const [corner, end] = arrow.points.slice(-2);
    expect(arrow.y + end[1]).toBeLessThan(0);
    expect(end[0]).toBeCloseTo(corner[0]);
    expect(end[1]).toBeGreaterThan(corner[1]);

    mouse.up();
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

    // turning halfway between the elements (the rotated one's outline,
    // rather than its bounding box)
    expect(arrow.points).toCloselyEqualPoints(
      [
        [0, 0],
        [50.5, 0],
        [50.5, 164],
        [101.1, 164],
      ],
      0,
    );
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
      [44, 0],
      [44, 200],
      [88, 200],
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
      [88, 100],
      [88, 200],
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

  it("connects elements with a single corner where the leg has its padding", () => {
    // 46px from the rectangle's side to the diamond's top: a leg of the
    // padding, and no step to the padding around the diamond on the way
    const arrow = connect(173.5);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 40.15],
    ]);
  });

  it("routes around the elements when a single corner doesn't fit", () => {
    const arrow = connect(173.5);

    // the rectangle below the diamond's top: the corner would be inside it
    UI.clickTool("selection");
    mouse.reset();
    mouse.moveTo(60, 100);
    mouse.down();
    mouse.moveTo(60, 180);
    mouse.up();

    expect(arrow.points.length).toBeGreaterThan(3);
  });

  it.each([167.5, 152.5, 142.5])(
    "doesn't route a leg shorter than the padding (the diamond at y=%d)",
    (diamondY) => {
      // about 34, 19 and 9px from the rectangle's side to the diamond's top:
      // the route steps up out of the way to give the leg its padding
      const arrow = connect(diamondY);

      const [corner, end] = arrow.points.slice(-2);
      expect(arrow.points.length).toBeGreaterThan(3);
      expect(end[1] - corner[1]).toBeCloseTo(MIN_LEG);
    },
  );

  it("keeps a leg the same with an arrowhead added to it", () => {
    API.setAppState({ currentItemEndArrowhead: null });
    // about 46px from the rectangle's side to the diamond's top
    const arrow = connect(173.5);
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 40.15],
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
    expect(updated.endArrowhead).toBe("arrow");
    expect(updated.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 40.15],
    ]);
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
      // the arrow enters its upper right, far enough below its top for the
      // leg to have the padding (a tall ellipse, for its top to reach that
      // far down), the first leg running over its top on the way there
      UI.createElement("rectangle", { x: 0, y: 100, width: 120, height: 55 });
      UI.createElement("ellipse", {
        x: 220,
        y: 139.5,
        width: 200,
        height: 400,
      });
      API.updateElement(h.elements[1], { strokeWidth });
      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.moveTo(120, 127.5);
      mouse.click();
      mouse.moveTo(383.5, 185);
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
    const arrow = connect(173.5);

    // a step down, the arrow is routed around the diamond, and the segment
    // above it is fixed at the rectangle's previous middle
    UI.clickTool("selection");
    mouse.reset();
    mouse.moveTo(0, 120);
    mouse.down();
    mouse.moveTo(0, 150);
    mouse.up();
    h.app.scene.mutateElement(arrow, {
      fixedSegments: [
        {
          index: 3,
          start: pointFrom<LocalPoint>(44, -30),
          end: pointFrom<LocalPoint>(195, -30),
        },
      ],
    });
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [44, 0],
      [44, -30],
      [195, -30],
      [195, 10.15],
    ]);

    // and back up, the first leg lines up with the fixed segment
    mouse.reset();
    mouse.moveTo(0, 150);
    mouse.down();
    mouse.moveTo(0, 120);
    mouse.up();

    expect(arrow.fixedSegments ?? []).toEqual([]);
    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [195, 0],
      [195, 40.15],
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

  it("connects elements with two corners, turning halfway, with just room for both legs", () => {
    // 80px apart: both legs at the padding
    const arrow = connectBelow(92);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, 40],
      [518, 40],
      [518, 80],
    ]);
  });

  it("turns back between them where there isn't room for both legs", () => {
    // 72px apart: both legs keep the padding, and the route turns back
    // between them
    const arrow = connectBelow(84);

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, 40],
      [258.97, 40],
      [258.97, 32],
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

  it("doesn't turn between them where there isn't room for both legs", () => {
    const arrow = connectBelow(30);
    expect(arrow.points.length).toBeGreaterThan(4);
  });
});

describe("elbow arrow updates with unchanged bindings", () => {
  const binding = (element: { id: string }, fixedPoint: [number, number]) => ({
    elementId: element.id,
    fixedPoint: fixedPoint as FixedPoint,
    mode: "orbit" as const,
  });

  /** Two elements side by side, connected by a straight elbow arrow */
  const setup = () => {
    const start = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 100,
      height: 100,
    });
    const elementsMap = arrayToMap([start, end]) as NonDeletedSceneElementsMap;
    let arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 100,
      y: 50,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      startBinding: binding(start, [1, 0.5]),
      endBinding: binding(end, [0, 0.5]),
    }) as unknown as ExcalidrawElbowArrowElement;
    arrow = {
      ...arrow,
      ...updateElbowArrowRoute(arrow, elementsMap),
    };

    return { start, end, elementsMap, arrow };
  };

  it("does nothing when only the same bindings are set again", () => {
    const { arrow, elementsMap } = setup();

    expect(
      updateElbowArrowPoints(arrow, elementsMap, {
        startBinding: arrow.startBinding,
        endBinding: arrow.endBinding,
      }),
    ).toEqual({});
  });

  it("follows a moved element when its endpoints are given with the same bindings", () => {
    const { start, end, arrow } = setup();
    expect(arrow.points.length).toBe(2);

    const movedEnd = { ...end, y: 200 };
    const update = updateElbowArrowPoints(
      arrow,
      arrayToMap([start, movedEnd]) as NonDeletedSceneElementsMap,
      {
        points: [arrow.points[0], arrow.points[arrow.points.length - 1]],
        startBinding: arrow.startBinding,
        endBinding: arrow.endBinding,
      },
    );

    const points = update.points!;
    // the arrow now ends on the middle of the moved element's left side
    expect(update.y! + points[points.length - 1][1]).toBeCloseTo(250, 1);
  });

  it("moves its end onto its first corner", () => {
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
      ],
    }) as unknown as ExcalidrawElbowArrowElement;

    // (an unrelated element, as there's nothing to route with no elements)
    const elementsMap = arrayToMap([
      API.createElement({ type: "rectangle", x: 500, y: 500 }),
    ]) as NonDeletedSceneElementsMap;

    const update = updateElbowArrowPoints(arrow, elementsMap, {
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      startBinding: null,
      endBinding: null,
    });

    expect(update.points).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it("fixes a moved segment when the same bindings are given along", () => {
    const { start, arrow: straightArrow } = setup();
    // move the end element below and to the right, so the route bends
    const end = API.createElement({
      type: "rectangle",
      x: 300,
      y: 300,
      width: 100,
      height: 100,
    });
    const elementsMap = arrayToMap([start, end]) as NonDeletedSceneElementsMap;
    let arrow = {
      ...straightArrow,
      endBinding: binding(end, [0, 0.5]),
    } as ExcalidrawElbowArrowElement;
    arrow = { ...arrow, ...updateElbowArrowRoute(arrow, elementsMap) };
    expect(arrow.points.length).toBe(4);

    // move the middle (vertical) segment 20px to the right
    const [, a, b] = arrow.points;
    const update = updateElbowArrowPoints(arrow, elementsMap, {
      fixedSegments: [
        {
          index: 2,
          start: pointFrom<LocalPoint>(a[0] + 20, a[1]),
          end: pointFrom<LocalPoint>(b[0] + 20, b[1]),
        },
      ],
      startBinding: arrow.startBinding,
      endBinding: arrow.endBinding,
    });

    expect(update.fixedSegments).toHaveLength(1);
    expect(update.points![1][0]).toBeCloseTo(a[0] + 20);
  });
});

describe("elbow arrow routing between close diagonal elements", () => {
  // the binding gap: BASE_BINDING_GAP + strokeWidth / 2
  const GAP = 6;

  /**
   * Routes an arrow from the bottom of `start` to the top of `end`, with the
   * scene mirrored vertically if `mirrored`, and returns its global points
   * mirrored back
   */
  const route = (mirrored: boolean) => {
    const flipY = (y: number, height: number) => (mirrored ? -(y + height) : y);
    const start = API.createElement({
      type: "rectangle",
      x: 0,
      y: flipY(0, 109),
      width: 156,
      height: 109,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 173,
      y: flipY(158, 150),
      width: 119,
      height: 150,
    });
    const startFixedPoint: FixedPoint = [0.8, 1 + GAP / 109];
    const endFixedPoint: FixedPoint = [0.2, -GAP / 150];
    const flip = ([x, y]: FixedPoint): FixedPoint =>
      mirrored ? [x, 1 - y] : [x, y];
    const elementsMap = arrayToMap([start, end]) as NonDeletedSceneElementsMap;
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
      startBinding: {
        elementId: start.id,
        fixedPoint: flip(startFixedPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: end.id,
        fixedPoint: flip(endFixedPoint),
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const update = updateElbowArrowRoute(arrow, elementsMap);

    return update.points!.map(([x, y]) => [
      update.x! + x,
      mirrored ? -(update.y! + y) : update.y! + y,
    ]);
  };

  it("routes the same way when the start is to the bottom-left of the end as when it is to the top-left", () => {
    const topLeft = route(false);
    const bottomLeft = route(true);

    // between the elements across the wider (vertical) gap, turning back
    // between them, as the gap is too narrow for both legs
    expect(topLeft).toHaveLength(6);
    expect(bottomLeft).toCloselyEqualPoints(topLeft as [number, number][]);
  });
});

describe("elbow arrow endpoints exactly on the bound element's outline", () => {
  it("leaves the side the endpoint is on", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 40,
    });
    const end = API.createElement({
      type: "rectangle",
      x: -300,
      y: -300,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      // exactly on the top edge, 10% along it (where the element's center
      // is further to the side than below)
      x: 20,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-270, -194)],
      startBinding: {
        elementId: start.id,
        fixedPoint: [0.1, -6 / 40],
        mode: "orbit",
      },
      endBinding: {
        elementId: end.id,
        fixedPoint: [0.5001, 1 + 6 / 100],
        mode: "orbit",
      },
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points } = updateElbowArrowRoute(
      arrow,
      arrayToMap([start, end]) as NonDeletedSceneElementsMap,
    );

    // up out of the top edge, not along it
    expect(points![1][0]).toBeCloseTo(points![0][0]);
    expect(points![1][1]).toBeLessThan(points![0][1]);
  });
});

describe("elbow arrow routing between overlapping elements", () => {
  it("goes around them both, as one, without jumping while they overlap", () => {
    // an arrow from the right of the lower element to the left of the upper
    // one, with the lower one dragged up through the upper one
    const upper = API.createElement({
      type: "rectangle",
      x: 770.35,
      y: 366.07,
      width: 224.54,
      height: 112,
    });
    let lower = API.createElement({
      type: "rectangle",
      x: 777.3,
      y: 552.24,
      width: 224.54,
      height: 112,
    });
    let arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 1007.84,
      y: 608.25,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-243, -186)],
      startBinding: {
        elementId: lower.id,
        fixedPoint: [1.0267, 0.5001],
        mode: "orbit",
      },
      endBinding: {
        elementId: upper.id,
        fixedPoint: [-0.0267, 0.5001],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const globalPoints = (element: ExcalidrawElbowArrowElement) =>
      element.points.map(
        ([px, py]) => [element.x + px, element.y + py] as [number, number],
      );

    /** The arrow's route with the lower element moved to `y` */
    const routeWithLowerAt = (y: number) => {
      lower = { ...lower, y };
      const elementsMap = arrayToMap([
        upper,
        lower,
      ]) as NonDeletedSceneElementsMap;
      const routed = {
        ...arrow,
        ...updateElbowArrowRoute(arrow, elementsMap),
      } as ExcalidrawElbowArrowElement;
      arrow = routed;

      // the same as for the arrow made anew between the same endpoints:
      // where it was routed before doesn't matter
      const fresh = {
        ...arrow,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      } as ExcalidrawElbowArrowElement;
      expect(globalPoints(routed)).toCloselyEqualPoints(
        globalPoints({
          ...fresh,
          ...updateElbowArrowRoute(fresh, elementsMap),
        } as ExcalidrawElbowArrowElement),
      );

      return globalPoints(routed);
    };

    // in 1px steps, the lower one dragged up through the upper one, the two
    // overlapping all along
    const routes: [number, number][][] = [];
    for (let y = 466; y > 266; y -= 1) {
      routes.push(routeWithLowerAt(y));
    }

    // around them both, as one, and only ever moving along with the element
    // being dragged, never jumping
    routes.forEach((points, step) => {
      expect(points).toHaveLength(6);
      if (step > 0) {
        points.forEach(([px, py], i) => {
          const [qx, qy] = routes[step - 1][i];
          expect(Math.abs(px - qx) + Math.abs(py - qy)).toBeLessThanOrEqual(
            1.01,
          );
        });
      }
    });
  });
  // diamonds tip to tip, their bounds overlapping, but not the diamonds,
  // with the start on the top of the lower one, and the end on the right of
  // the upper one
  const routeTipToTip = (lowerX: number) => {
    const lower = API.createElement({
      type: "diamond",
      x: lowerX,
      y: -706.24,
      width: 226.95,
      height: 248.6,
    });
    const upper = API.createElement({
      type: "diamond",
      x: 2158.34,
      y: -869.92,
      width: 226.95,
      height: 248.6,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: lower.id,
        fixedPoint: [0.5023, 0.0073],
        mode: "orbit",
      },
      endBinding: {
        elementId: upper.id,
        fixedPoint: [0.995, 0.5028],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    return updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    ).points!;
  };

  it.each([2290.31, 2270.31])(
    "doesn't go around elements as one where only their bounds overlap (the lower one at x=%d)",
    (lowerX) => {
      // the start 20px right of the end, or just right of it, too close to
      // it for the end's leg: up a hairpin's width past the end (with the
      // start's leg as long as the room up to the end, there's none to turn
      // back halfway), right a padding past the end, and down and left into
      // it, rather than around them both
      const points = routeTipToTip(lowerX);

      const start = points[0];
      const end = points[points.length - 1];
      const turn = end[1] - ELBOW_ARROW_CORNER_RADIUS;
      expect(points).toCloselyEqualPoints([
        start,
        [start[0], turn],
        [end[0] + PADDING, turn],
        [end[0] + PADDING, end[1]],
        end,
      ]);
    },
  );
  it("keeps a leg's padding as it's dragged inside the other one's bounds", () => {
    // diamonds diagonal from each other, not overlapping, with the start on
    // the top of the lower one, inside the bounds of the upper one, and the
    // end on the right of the upper one, the lower one dragged sideways in
    // half px steps
    const upper = API.createElement({
      type: "diamond",
      x: 2158.24,
      y: -869.92,
      width: 226.95,
      height: 248.6,
    });
    const routes = Array.from({ length: 61 }, (_, step) => {
      const lower = API.createElement({
        type: "diamond",
        x: 2072.06 + (step - 30) / 2,
        y: -665.19,
        width: 226.95,
        height: 248.6,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: lower.id,
          fixedPoint: [0.5023, 0.0073],
          mode: "orbit",
        },
        endBinding: {
          elementId: upper.id,
          fixedPoint: [0.995, 0.5028],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;
      const update = updateElbowArrowRoute(
        arrow,
        arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
      );
      return update.points!.map(
        ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
      );
    });

    // up about a padding all along (the route has to leave the upper one's
    // bounds anyway), never cut short, and never jumping
    routes.forEach((points, step) => {
      expect(points).toHaveLength(5);
      expect(points[0][1] - points[1][1]).toBeGreaterThan(30);
      if (step > 0) {
        points.forEach(([px, py], i) => {
          const [qx, qy] = routes[step - 1][i];
          expect(Math.abs(px - qx) + Math.abs(py - qy)).toBeLessThanOrEqual(
            2.5,
          );
        });
      }
    });
  });

  it("gives a leg its padding where it starts inside the other one's bounds", () => {
    // diamonds diagonal from each other, not overlapping, with the start on
    // the top of the lower one, inside the bounds of the upper one, and the
    // end on the right of the upper one
    const lower = API.createElement({
      type: "diamond",
      x: 2074.24,
      y: -673.58,
      width: 226.95,
      height: 248.6,
    });
    const upper = API.createElement({
      type: "diamond",
      x: 2158.24,
      y: -869.92,
      width: 226.95,
      height: 248.6,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: lower.id,
        fixedPoint: [0.5023, 0.0073],
        mode: "orbit",
      },
      endBinding: {
        elementId: upper.id,
        fixedPoint: [0.995, 0.5028],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points } = updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    );

    // up a padding (the route has to leave the upper one's bounds anyway,
    // so cutting the leg short to stay a little less deep in them doesn't
    // make it any better), right past the upper one, and up and left into
    // the end
    expect(points).toHaveLength(5);
    expect(points![1][0]).toBeCloseTo(points![0][0]);
    expect(points![0][1] - points![1][1]).toBeGreaterThan(30);
    expect(points![2][0]).toBeGreaterThan(points![4][0]);
  });

  it("loops through the room in the corner of the bounds around both, rather than around them", () => {
    // diamonds diagonal from each other, their bounds overlapping, with the
    // start on top of the lower one and the end on the right of the upper
    // one, just above the start: only their bounds' corners overlap, so the
    // room above the lower one and right of the upper one is clear of both
    const upper = API.createElement({
      type: "diamond",
      x: 2123.26,
      y: -856.89,
      width: 226.95,
      height: 248.6,
    });
    const lower = API.createElement({
      type: "diamond",
      x: 2235.93,
      y: -711.21,
      width: 226.95,
      height: 248.6,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: lower.id,
        fixedPoint: [0.5023, 0.0073],
        mode: "orbit",
      },
      endBinding: {
        elementId: upper.id,
        fixedPoint: [0.995, 0.5028],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points } = updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    );

    // up a padding, right a padding past the end, down and left into it:
    // a short loop, rather than one around the bounds of both
    expect(points).toHaveLength(5);
    expect(points![0][1] - points![1][1]).toBeCloseTo(40, 0);
    expect(points![2][0] - points![4][0]).toBeCloseTo(40, 0);
  });

  it.each([2160, 2180, 2189.7, 2200, 2220, 2240])(
    "loops on out of the other one's bounds, rather than around them, the start deep in them (the lower one at x=%d)",
    (lowerX) => {
      // as above, the start on top of the lower one inside the upper one's
      // bounds, the deeper the further left: the route has to get out of
      // them anyway, and gets out the nearer way, rather than through them
      // the whole way up on its first leg
      const upper = API.createElement({
        type: "diamond",
        x: 2123.59,
        y: -863.11,
        width: 226.95,
        height: 248.6,
      });
      const lower = API.createElement({
        type: "diamond",
        x: lowerX,
        y: -720.93,
        width: 226.95,
        height: 248.6,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: lower.id,
          fixedPoint: [0.5023, 0.0073],
          mode: "orbit",
        },
        endBinding: {
          elementId: upper.id,
          fixedPoint: [0.995, 0.5028],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
      );

      // up a padding, right a padding past the end, down and left into it
      expect(points).toHaveLength(5);
      expect(points![0][1] - points![1][1]).toBeCloseTo(40, 0);
      expect(points![2][0] - points![4][0]).toBeCloseTo(40, 0);
    },
  );

  it("goes around both by the padding past the other one, rather than along its side, as either is dragged sideways", () => {
    // rectangles the same size, nearly on top of each other, from the right
    // of the one behind to the left of the one in front, which reaches out
    // past it by just short of the padding (and the binding gap): the route
    // goes around under both
    const routeWith = (startX: number, endX: number) => {
      const start = API.createElement({
        type: "rectangle",
        x: startX,
        y: 440.49,
        width: 224.54,
        height: 112,
      });
      const end = API.createElement({
        type: "rectangle",
        x: endX,
        y: 447.76,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: start.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: end.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;
      const update = updateElbowArrowRoute(
        arrow,
        arrayToMap([start, end]) as NonDeletedSceneElementsMap,
      );
      return {
        start,
        end,
        points: update.points!.map(
          ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
        ),
      };
    };

    // past the other one's far side by the padding: down past the right of
    // the one in front, and up past the left of the one behind
    const { start, end, points } = routeWith(985.19, 1030.78);
    expect(points).toHaveLength(6);
    expect(points[1][0]).toBeCloseTo(
      end.x + end.width + getBindingGap(end) + PADDING,
    );
    expect(points[3][0]).toBeCloseTo(start.x - getBindingGap(start) - PADDING);

    // and either dragged sideways, in half px steps, the route only ever
    // moving along with it, never jumping
    for (const drag of [
      (dx: number) => routeWith(985.19 + dx, 1030.78),
      (dx: number) => routeWith(985.19, 1030.78 + dx),
    ]) {
      const routes = Array.from(
        { length: 121 },
        (_, step) => drag((step - 60) / 2).points,
      );
      routes.forEach((route, step) => {
        expect(route).toHaveLength(6);
        if (step > 0) {
          route.forEach(([px, py], i) => {
            const [qx, qy] = routes[step - 1][i];
            expect(Math.abs(px - qx) + Math.abs(py - qy)).toBeLessThanOrEqual(
              0.51,
            );
          });
        }
      });
    }
  });

  it("loops back a hairpin's width where the end is right by where the start's leg ends", () => {
    // the start on top of the lower one, just right of the upper one, which
    // overlaps the lower one's top left, and the end on the right of the
    // upper one, about where the start's leg ends: turning back onto the
    // end's line would fold the route back onto itself (rectangles, as a
    // diamond's corner by the end would reach across the start's line, and
    // the route would turn back under it instead)
    const lower = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 224.54,
      height: 112,
    });
    const upper = API.createElement({
      type: "rectangle",
      x: -115.25,
      y: -99,
      width: 224.54,
      height: 112,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: lower.id,
        fixedPoint: [0.5001, -0.0267],
        mode: "orbit",
      },
      endBinding: {
        elementId: upper.id,
        fixedPoint: [1.0267, 0.5001],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points } = updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    );

    // up past where the end is by a hairpin's width, right a padding past
    // the end, and down and left into it: a short loop, rather than one
    // around the bounds of both
    expect(points).toHaveLength(5);
    expect(points![3][1] - points![2][1]).toBeCloseTo(
      ELBOW_ARROW_CORNER_RADIUS,
      0,
    );
    expect(points![2][0] - points![4][0]).toBeCloseTo(40, 0);
  });
});

describe("elbow arrow clearance", () => {
  it.each([740, 760, 770.35, 773.75, 776, 778.32, 790])(
    "keeps the padding around an element where nothing is in front of it (the element above at x = %d)",
    (upperX) => {
      // the start leaves the right side of the lower element, which nothing
      // is in front of: the upper element is above it, ending to the left of
      // its right side, level with it or a little past it
      const upper = API.createElement({
        type: "rectangle",
        x: upperX,
        y: 366.07,
        width: 224.54,
        height: 112,
      });
      const lower = API.createElement({
        type: "rectangle",
        x: 773.75,
        y: 502.38,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 1004.29,
        y: 558.4,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(-240, -136),
        ],
        startBinding: {
          elementId: lower.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: upper.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([upper, lower]) as NonDeletedSceneElementsMap,
      );

      // between the elements, with the first and last legs (out of the
      // binding gap) a padding long
      expect(points).toHaveLength(6);
      expect(points![1][0] - points![0][0]).toBeCloseTo(40, 0);
      expect(points![5][0] - points![4][0]).toBeCloseTo(40, 0);
    },
  );
});

describe("elbow arrow legs next to another element", () => {
  it("gives the legs their padding when their endpoints are right by the other element", () => {
    // overlapping elements, with the start on the right of the upper one
    // just above the lower one, and the end on the left of the lower one
    // just below the upper one: the elements aren't avoided, but the legs
    // still get their padding
    const lower = API.createElement({
      type: "rectangle",
      x: 856.95,
      y: 621.29,
      width: 224.54,
      height: 112,
    });
    const upper = API.createElement({
      type: "rectangle",
      x: 781.08,
      y: 561.2,
      width: 224.54,
      height: 112,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: upper.id,
        fixedPoint: [1.0267, 0.5001],
        mode: "orbit",
      },
      endBinding: {
        elementId: lower.id,
        fixedPoint: [-0.0267, 0.5001],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points } = updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    );
    const length = (a: LocalPoint, b: LocalPoint) =>
      Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);

    // around them, without hooking back to keep a leg short
    expect(points!.length).toBeLessThanOrEqual(6);
    expect(length(points![0], points![1])).toBeGreaterThanOrEqual(39.5);
    expect(
      length(points![points!.length - 2], points![points!.length - 1]),
    ).toBeGreaterThanOrEqual(39.5);
  });

  it("goes around the bounds of both, but through the room in their corner, when they overlap", () => {
    // partly overlapping elements, with the start on the right of the upper
    // one just above the lower one, and the end on the left of the lower one
    // just below the upper one
    const lower = API.createElement({
      type: "rectangle",
      x: 854.11,
      y: 628.21,
      width: 224.54,
      height: 112,
    });
    const upper = API.createElement({
      type: "rectangle",
      x: 642.92,
      y: 560.95,
      width: 224.54,
      height: 112,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: upper.id,
        fixedPoint: [1.0267, 0.5001],
        mode: "orbit",
      },
      endBinding: {
        elementId: lower.id,
        fixedPoint: [-0.0267, 0.5001],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points, x, y } = updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    );

    // right past the lower one by a padding, down below it by a padding,
    // left to where the end's leg starts, up through the room in the corner
    // of the bounds around both (below the upper one, left of the lower
    // one, around neither), and right into the end: around the bounds of
    // both, rather than back between the endpoints through both of them,
    // and not around the upper one too, as nothing's in the way
    const gap = getBindingGap(upper);
    const global = points!.map(
      ([px, py]) => [px + x!, py + y!] as [number, number],
    );
    const [start, end] = [global[0], global[global.length - 1]];
    const right = lower.x + lower.width + gap + 40;
    const leg = end[0] - 40;
    const bottom = lower.y + lower.height + gap + 40;
    expect(global).toCloselyEqualPoints([
      start,
      [right, start[1]],
      [right, bottom],
      [leg, bottom],
      [leg, end[1]],
      end,
    ]);
  });

  it.each([
    [604.32, 517.29],
    [604.32, 520],
    [604.32, 525],
    [608.24, 520],
  ])(
    "gives both legs their padding where the elements' corners nearly touch (the upper one at %d, %d)",
    (upperX, upperY) => {
      // the upper element's bottom right corner is just above and left of the
      // lower one's top left corner (their binding gaps overlapping, and even
      // their sides a little), and the route turns back between them
      const lower = API.createElement({
        type: "rectangle",
        x: 848.21,
        y: 630.52,
        width: 224.54,
        height: 112,
      });
      const upper = API.createElement({
        type: "rectangle",
        x: upperX,
        y: upperY,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: upper.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: lower.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
      );

      expect(points).toHaveLength(6);
      expect(points![1][0] - points![0][0]).toBeCloseTo(40);
      expect(points![5][0] - points![4][0]).toBeCloseTo(40);
    },
  );

  it("gives the start leg its padding along the top of the other element", () => {
    // the upper element's bottom right corner is above and left of the lower
    // one's top left corner, and the route turns back through the gap
    // between them: its middle runs along the top of the lower one by the
    // start leg (but well along it, rather than by its corner)
    const lower = API.createElement({
      type: "rectangle",
      x: 848.21,
      y: 630.52,
      width: 224.54,
      height: 112,
    });
    const upper = API.createElement({
      type: "rectangle",
      x: 607.42,
      y: 506.33,
      width: 224.54,
      height: 112,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: upper.id,
        fixedPoint: [1.0267, 0.5001],
        mode: "orbit",
      },
      endBinding: {
        elementId: lower.id,
        fixedPoint: [-0.0267, 0.5001],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    const { points } = updateElbowArrowRoute(
      arrow,
      arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
    );

    expect(points).toHaveLength(6);
    expect(points![1][0] - points![0][0]).toBeCloseTo(40);
    expect(points![5][0] - points![4][0]).toBeCloseTo(40);
  });

  it.each([
    [609.52, 521],
    [608.24, 516.83],
    [608.24, 510],
    [608.24, 505],
  ])(
    "doesn't turn back too tightly to thread between elements with corners nearly touching (the upper one at %d, %d)",
    (upperX, upperY) => {
      // the upper element's bottom right corner is just above and left of the
      // lower one's top left corner, and the endpoints are just past the
      // padding around the other element
      const lower = API.createElement({
        type: "rectangle",
        x: 848.21,
        y: 630.52,
        width: 224.54,
        height: 112,
      });
      const upper = API.createElement({
        type: "rectangle",
        x: upperX,
        y: upperY,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: upper.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: lower.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([lower, upper]) as NonDeletedSceneElementsMap,
      );

      // wherever it turns back, with room to round both corners fully
      for (let i = 1; i + 2 < points!.length; i++) {
        const [a, b, c, d] = points!.slice(i - 1, i + 3);
        const turnsBack =
          Math.sign(b[0] - a[0]) === -Math.sign(d[0] - c[0]) &&
          Math.sign(b[1] - a[1]) === -Math.sign(d[1] - c[1]);
        if (turnsBack) {
          expect(
            Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]),
          ).toBeGreaterThanOrEqual(32);
        }
      }
      expect(points!.length).toBeLessThanOrEqual(6);
    },
  );
});

describe("elbow arrow routing between elements overlapping each other's endpoints", () => {
  it.each([664.89, 700, 740, 780])(
    "stays orthogonal, without doubling back on itself, with the start element at x=%d",
    (x) => {
      // the start on the right of the left element is inside the right one,
      // and the end on the left of the right element inside the left one
      const right = API.createElement({
        type: "rectangle",
        x: 856.95,
        y: 621.29,
        width: 224.54,
        height: 112,
      });
      const left = API.createElement({
        type: "rectangle",
        x,
        y: 622.43,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: left.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: right.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([right, left]) as NonDeletedSceneElementsMap,
      );

      // around the elements: right, down, left, up, right
      const headings = points!.slice(1).map((p, i) => {
        const dx = p[0] - points![i][0];
        const dy = p[1] - points![i][1];
        expect(dx === 0 || dy === 0).toBe(true);
        return dx > 0 ? "R" : dx < 0 ? "L" : dy > 0 ? "D" : "U";
      });
      expect(headings.join("")).toBe("RDLUR");
      // with segments far enough apart to see the way it goes
      for (let i = 1; i < points!.length - 2; i++) {
        expect(
          Math.abs(points![i + 1][0] - points![i][0]) +
            Math.abs(points![i + 1][1] - points![i][1]),
        ).toBeGreaterThan(40);
      }
    },
  );
});

describe("elbow arrow routing through a narrow gap", () => {
  it.each([752, 754, 754.94, 756, 758, 760, 765])(
    "runs through the gap between elements a little apart, rather than around them (the lower one at y = %d)",
    (lowerY) => {
      // an S from the right of the lower element to the left of the upper
      // one, with about 10px between them, the lower one a little to the
      // left: the route runs through the gap, past the corners of both
      const upper = API.createElement({
        type: "rectangle",
        x: 848.21,
        y: 630.52,
        width: 224.54,
        height: 112,
      });
      const lower = API.createElement({
        type: "rectangle",
        x: 824.23,
        y: lowerY,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: lower.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: upper.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { x, y, points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([upper, lower]) as NonDeletedSceneElementsMap,
      );

      // right, up into the gap, left through it, up and right into the end
      expect(points).toHaveLength(6);
      const middle = y! + points![2][1];
      expect(points![3][1]).toBeCloseTo(points![2][1]);
      expect(middle).toBeGreaterThan(upper.y + upper.height);
      expect(middle).toBeLessThan(lower.y);
      expect(x! + points![3][0]).toBeLessThan(upper.x);
    },
  );
});

describe("elbow arrow loops", () => {
  it.each([
    ["the right corner of a diamond", "diamond", 227, 249, [0.995, 0.5028]],
    [
      "the middle of the right of a rectangle",
      "rectangle",
      200,
      100,
      [1.03, 0.5],
    ],
    [
      "the middle of the top of a rectangle",
      "rectangle",
      200,
      100,
      [0.5, -0.06],
    ],
  ] as const)(
    "loops around the corner from %s back to the same point",
    (_, type, width, height, fixedPoint) => {
      const element = API.createElement({
        type,
        x: 0,
        y: 0,
        width,
        height,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: element.id,
          fixedPoint: fixedPoint as FixedPoint,
          mode: "orbit",
        },
        endBinding: {
          elementId: element.id,
          fixedPoint: fixedPoint as FixedPoint,
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const { points } = updateElbowArrowRoute(
        arrow,
        arrayToMap([element]) as NonDeletedSceneElementsMap,
      );

      // a padding (or so) across, turning the same way all around, back to
      // where it started
      expect(points).toHaveLength(5);
      expect(points![4][0]).toBeCloseTo(points![0][0]);
      expect(points![4][1]).toBeCloseTo(points![0][1]);
      const segments = points!
        .slice(1)
        .map(([x, y], i) => [x - points![i][0], y - points![i][1]]);
      segments.forEach(([dx, dy], i) => {
        expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThanOrEqual(39.5);
        expect(Math.abs(dx) + Math.abs(dy)).toBeLessThan(50);
        const [nx, ny] = segments[(i + 1) % 4];
        expect(dx * ny - dy * nx).toBeGreaterThan(0);
      });
    },
  );
});

describe("elbow arrow routing while dragging elements", () => {
  it.each([16, 24])(
    "doesn't jitter between routes when dragged past another element %dpx below it",
    (gap) => {
      // an arrow from the right of the lower element to the left of the
      // upper one (an S between them), with the lower one dragged sideways
      const upper = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 224,
        height: 112,
      });
      const lower = API.createElement({
        type: "rectangle",
        x: 0,
        y: 112 + gap,
        width: 224,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: lower.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: upper.id,
          fixedPoint: [-0.0267, 0.5001],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      const routeWithLowerAt = (x: number) => {
        const update = updateElbowArrowRoute(
          arrow,
          arrayToMap([upper, { ...lower, x }]) as NonDeletedSceneElementsMap,
        );
        return update.points!.map(
          ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
        );
      };

      // in half px steps, noting where the route changes more than the
      // element moves
      const routes = Array.from({ length: 1201 }, (_, step) =>
        routeWithLowerAt(-300 + step / 2),
      );
      const changes = routes
        .map((points, step) => {
          const previous = routes[step - 1];
          return previous &&
            (points.length !== previous.length ||
              points.some(
                ([px, py], i) =>
                  Math.abs(px - previous[i][0]) > 3 ||
                  Math.abs(py - previous[i][1]) > 3,
              ))
            ? step
            : null;
        })
        .filter((step): step is number => step !== null);

      // it changes where it has to, but never back and forth from one step
      // to the next
      const flickers = changes.filter((step, i) => step - changes[i - 1] <= 2);
      expect(flickers).toEqual([]);
    },
  );
});

describe("elbow arrow routing without crossing itself", () => {
  /** Whether any two of the route's segments cross each other */
  const crossesItself = (points: [number, number][]) =>
    points.slice(1).some((b, i) => {
      const a = points[i];
      return points.slice(i + 3).some((d, j) => {
        const c = points[i + j + 2];
        const [[h, hEnd], [v, vEnd]] =
          a[1] === b[1]
            ? [
                [a, b],
                [c, d],
              ]
            : [
                [c, d],
                [a, b],
              ];
        return (
          h[1] === hEnd[1] &&
          v[0] === vEnd[0] &&
          v[0] > Math.min(h[0], hEnd[0]) &&
          v[0] < Math.max(h[0], hEnd[0]) &&
          h[1] > Math.min(v[1], vEnd[1]) &&
          h[1] < Math.max(v[1], vEnd[1])
        );
      });
    });

  const route = (
    start: ExcalidrawBindableElement,
    startFixedPoint: FixedPoint,
    end: ExcalidrawBindableElement,
    endFixedPoint: FixedPoint,
  ) => {
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: start.id,
        fixedPoint: startFixedPoint,
        mode: "orbit",
      },
      endBinding: {
        elementId: end.id,
        fixedPoint: endFixedPoint,
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;
    const update = updateElbowArrowRoute(
      arrow,
      arrayToMap([start, end]) as NonDeletedSceneElementsMap,
    );
    return update.points!.map(
      ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
    );
  };

  it("goes another way rather than crossing itself", () => {
    // from the left of the lower element to the bottom of the upper one,
    // which overhangs it on the left: the cheapest route leaves to the left,
    // turns up and right under the upper one, then down and left back across
    // where it started to come up into it (the upper one 30px higher than
    // in the scene this was reported in, where the legs, at the padding,
    // would cross each other whichever way the route went)
    const lower = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 187.26,
      height: 84.07,
    }) as ExcalidrawBindableElement;
    const upper = API.createElement({
      type: "rectangle",
      x: -62.31,
      y: -145.94,
      width: 173.59,
      height: 102.93,
    }) as ExcalidrawBindableElement;

    const points = route(lower, [-0.03, 0.2383], upper, [0.3011, 1.03]);

    expect(crossesItself(points)).toBe(false);
  });

  describe("between diamonds diagonal from each other", () => {
    // an arrow from the right corner of a diamond to the left corner of
    // another one just to its right, and higher up
    const upper = API.createElement({
      type: "diamond",
      x: 859.3828125,
      y: 46.66015625,
      width: 226.953125,
      height: 248.59765625,
    }) as ExcalidrawBindableElement;
    const lower = API.createElement({
      type: "diamond",
      x: 615.19140625,
      y: 225.49609375,
      width: 226.953125,
      height: 248.59765625,
    }) as ExcalidrawBindableElement;
    const routeWithLowerAt = (dx: number, dy: number) =>
      route(
        { ...lower, x: lower.x + dx, y: lower.y + dy },
        [0.995, 0.5028],
        upper,
        [0.005, 0.5028],
      );

    it.each([
      // (once spiralling up between them, over the upper one and back down
      // across where it went up)
      ["close together", 0, 0],
      // (once zigzagging into the narrow gap between their bounds, and back
      // out of it)
      ["with their bounds nearly touching", 15.77, 45.69],
    ])("turns between them across their corners when %s", (_, dx, dy) => {
      const points = routeWithLowerAt(dx, dy);

      expect(crossesItself(points)).toBe(false);
      expect(points).toHaveLength(6);
      // the middle segment between the lower one's top and the upper
      // one's bottom
      expect(points[2][1]).toBe(points[3][1]);
      expect(points[2][1]).toBeGreaterThan(lower.y + dy - 40);
      expect(points[2][1]).toBeLessThan(upper.y + upper.height + 40);
    });

    it("keeps turning between them as one is dragged further over the other", () => {
      // from their bounds nearly touching to overlapping by 59px more
      // across (further, the legs, at the padding, don't fit between them,
      // and the route goes around them)
      const routes = Array.from({ length: 119 }, (_, step) =>
        routeWithLowerAt(22.52 + step / 2, 45.41),
      );

      expect(routes.filter((points) => points.length !== 6)).toEqual([]);
      const jumps = routes.filter((points, step) =>
        points.some(
          ([px, py], i) =>
            step > 0 &&
            (Math.abs(px - routes[step - 1][i][0]) > 3 ||
              Math.abs(py - routes[step - 1][i][1]) > 3),
        ),
      );
      expect(jumps).toEqual([]);
    });

    it.each(["x", "y"] as const)(
      "doesn't cross itself, zigzag or jitter as one is dragged along %s",
      (axis) => {
        const routes = Array.from({ length: 801 }, (_, step) =>
          axis === "x"
            ? routeWithLowerAt(-400 + step, 0)
            : routeWithLowerAt(0, -400 + step),
        );

        expect(routes.filter(crossesItself)).toEqual([]);
        expect(routes.filter((points) => points.length > 6)).toEqual([]);
        const changes = routes
          .map((points, step) => {
            const previous = routes[step - 1];
            return previous &&
              (points.length !== previous.length ||
                points.some(
                  ([px, py], i) =>
                    Math.abs(px - previous[i][0]) > 3 ||
                    Math.abs(py - previous[i][1]) > 3,
                ))
              ? step
              : null;
          })
          .filter((step): step is number => step !== null);
        expect(changes.filter((step, i) => step - changes[i - 1] <= 1)).toEqual(
          [],
        );
      },
    );
  });
});

describe("elbow arrow routing between elements facing each other", () => {
  it("turns between them without jumping as they're dragged closer", () => {
    // from the right of the left element to the left of the right one, a
    // little further apart than twice the padding: the route turns between
    // them
    const left = API.createElement({
      type: "rectangle",
      x: 424.79,
      y: 634.08,
      width: 224.54,
      height: 112,
    });
    const right = API.createElement({
      type: "rectangle",
      x: 763.73,
      y: 688.27,
      width: 224.54,
      height: 112,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      startBinding: {
        elementId: left.id,
        fixedPoint: [1.0267, 0.5001],
        mode: "orbit",
      },
      endBinding: {
        elementId: right.id,
        fixedPoint: [-0.0267, 0.5001],
        mode: "orbit",
      },
      endArrowhead: "arrow",
    }) as unknown as ExcalidrawElbowArrowElement;

    // the right one dragged left, in half px steps, on until there's no room
    // to turn between them
    const routes = Array.from({ length: 101 }, (_, step) => {
      const update = updateElbowArrowRoute(
        arrow,
        arrayToMap([
          left,
          { ...right, x: right.x - step / 2 },
        ]) as NonDeletedSceneElementsMap,
      );
      return update.points!.map(
        ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
      );
    });

    // turning between them, then looping back past them (once the legs are
    // too long to turn between them), and changing smoothly otherwise
    const loops = routes.findIndex((points) => points.length !== 4);
    expect(loops).toBeGreaterThan(40);
    expect(routes.slice(loops).filter((points) => points.length !== 6)).toEqual(
      [],
    );
    const jumps = routes.filter(
      (points, step) =>
        step > 0 &&
        step !== loops &&
        points.some(
          ([px, py], i) =>
            Math.abs(px - routes[step - 1][i][0]) > 1 ||
            Math.abs(py - routes[step - 1][i][1]) > 1,
        ),
    );
    expect(jumps).toEqual([]);
    // halfway between them, as long as that leaves the end's leg its
    // shortest
    const [start, , , end] = routes[0];
    expect(routes[0][1][0]).toBeCloseTo(
      Math.min((start[0] + end[0]) / 2, end[0] - MIN_LEG),
    );
  });
});

describe("elbow arrow routing between elements on top of each other", () => {
  it("doesn't turn back on itself between endpoints nearly in line", () => {
    // from the right corner of a diamond to the left corner of another one
    // almost exactly over it, 3px higher: in line, the route would leave the
    // start to the right, and come back to the end from the left
    const end = API.createElement({
      type: "diamond",
      x: 1050.62,
      y: 60.96,
      width: 226.95,
      height: 248.6,
    });
    const routeWithStartAt = (dx: number, dy: number) => {
      const start = API.createElement({
        type: "diamond",
        x: 1067.4 + dx,
        y: 64 + dy,
        width: 226.95,
        height: 248.6,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: start.id,
          fixedPoint: [0.995, 0.5028],
          mode: "orbit",
        },
        endBinding: {
          elementId: end.id,
          fixedPoint: [0.005, 0.5028],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;
      const update = updateElbowArrowRoute(
        arrow,
        arrayToMap([start, end]) as NonDeletedSceneElementsMap,
      );
      return update.points!.map(
        ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
      );
    };
    /** Whether the route turns back closer than it can round its corners */
    const turnsBackTightly = (points: [number, number][]) =>
      points.slice(3).some((d, i) => {
        const [a, b, c] = points.slice(i, i + 3);
        const turnsBack =
          (b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1]) < 0;
        return turnsBack && Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]) < 16;
      });

    // around them, rather than doubling back along the line between the
    // endpoints, here and as the start is dragged a little either way
    expect(routeWithStartAt(0, 0)).toHaveLength(6);
    for (let step = -20; step <= 20; step++) {
      expect(turnsBackTightly(routeWithStartAt(step, 0))).toBe(false);
      expect(turnsBackTightly(routeWithStartAt(0, step / 2))).toBe(false);
    }
  });
});

describe("elbow arrow legs as the elements get closer", () => {
  const sides = {
    right: [1.0267, 0.5001],
    left: [-0.0267, 0.5001],
    top: [0.5001, -0.0267],
    bottom: [0.5001, 1.0267],
  } as Record<string, FixedPoint>;

  it.each([
    ["right", "top", "right"],
    ["top", "left", "right"],
    ["right", "top", "below"],
    ["bottom", "left", "below"],
  ])(
    "keeps the legs' padding as the elements get closer, without jumping (from the %s to the %s of one %s)",
    (from, to, where) => {
      const start = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 224.54,
        height: 112,
      });
      const end = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: start.id,
          fixedPoint: sides[from],
          mode: "orbit",
        },
        endBinding: {
          elementId: end.id,
          fixedPoint: sides[to],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;

      // in 1px steps, from far apart until there's only just room for a leg
      // between the elements (closer, a leg runs into the other element)
      const routes = Array.from({ length: 151 }, (_, step) => {
        const apart = 200 - step;
        const update = updateElbowArrowRoute(
          arrow,
          arrayToMap([
            start,
            where === "right"
              ? { ...end, x: start.width + apart }
              : { ...end, y: start.height + apart },
          ]) as NonDeletedSceneElementsMap,
        );
        return update.points!.map(
          ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
        );
      });

      // the same route all along, moving along with the element being
      // dragged (or, here and there, a px more, where it settles on another
      // line next to the one it was on), never jumping
      routes.forEach((points, step) => {
        expect(points).toHaveLength(routes[0].length);
        if (step > 0) {
          points.forEach(([px, py], i) => {
            const [qx, qy] = routes[step - 1][i];
            expect(Math.abs(px - qx) + Math.abs(py - qy)).toBeLessThanOrEqual(
              2.5,
            );
          });
        }
      });
    },
  );
});

describe("elbow arrow routing back under the start's element", () => {
  it("turns between the elements as long as there's room, rather than along the start's element", () => {
    // from the right of one element to the top of another just below it,
    // the end behind the start: the route turns back between them
    const start = API.createElement({
      type: "rectangle",
      x: 2226.84,
      y: 371.39,
      width: 224.54,
      height: 112,
    });
    const startBottom = start.y + start.height;
    const routeWithEndAt = (y: number) => {
      const end = API.createElement({
        type: "rectangle",
        x: 2234.41,
        y,
        width: 224.54,
        height: 112,
      });
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
        startBinding: {
          elementId: start.id,
          fixedPoint: [1.0267, 0.5001],
          mode: "orbit",
        },
        endBinding: {
          elementId: end.id,
          fixedPoint: [0.5001, -0.0536],
          mode: "orbit",
        },
        endArrowhead: "arrow",
      }) as unknown as ExcalidrawElbowArrowElement;
      const update = updateElbowArrowRoute(
        arrow,
        arrayToMap([start, end]) as NonDeletedSceneElementsMap,
      );
      return update.points!.map(
        ([px, py]) => [update.x! + px, update.y! + py] as [number, number],
      );
    };

    // dragged up, in 1px steps, from 150px below the start's element until
    // there's only just room for the end's leg under it (closer, the turn
    // runs along the start's element, or into it, to keep the end's leg)
    const routes = Array.from({ length: 99 }, (_, step) =>
      routeWithEndAt(startBottom + 150 - step),
    );
    routes.forEach((points, step) => {
      expect(points).toHaveLength(5);
      const [, , [, turn], , [, endY]] = points;
      // under the start's element, clear of it, and at least as far from it
      // as from the end, where there isn't room for both the end's leg and
      // the padding (but for the end's leg's padding)
      expect(endY - turn).toBeGreaterThanOrEqual(MIN_LEG - 0.01);
      expect(turn - startBottom).toBeGreaterThanOrEqual(
        getBindingGap(start) - 0.01,
      );
      if (endY - turn > MIN_LEG + 0.01) {
        expect(turn - startBottom).toBeGreaterThanOrEqual(endY - turn - 0.01);
      }
      if (step > 0) {
        points.forEach(([px, py], i) => {
          const [qx, qy] = routes[step - 1][i];
          expect(Math.abs(px - qx) + Math.abs(py - qy)).toBeLessThanOrEqual(
            2.5,
          );
        });
      }
    });
    // (halfway between their outlines, where there's room for that)
    const [, , [, turn]] = routeWithEndAt(startBottom + 100);
    expect(turn).toBeCloseTo(startBottom + 50, 0);
  });
});
