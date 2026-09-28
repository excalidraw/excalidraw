import { ARROW_TYPE, DEFAULT_ZOOM, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import { actionSelectAll } from "@excalidraw/excalidraw/actions";
import { actionDuplicateSelection } from "@excalidraw/excalidraw/actions/actionDuplicateSelection";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  queryByTestId,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";
import "@excalidraw/utils/test-utils";
import { bindBindingElement } from "@excalidraw/element";

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
      [36, 0],
      [36, 90],
      [28, 90],
      [28, 164],
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

describe("elbow arrow with malformed fixedSegments", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it.each([
    ["string", "str"],
    ["array-like object", { length: 1, 0: { index: 2 } }],
    ["array of junk", [null, 1, "x", [], {}]],
    ["missing points", [{ index: 2 }]],
    ["malformed points", [{ start: [125], end: null, index: 2 }]],
    [
      "first/last/out of range indices",
      [
        { start: [0, 0], end: [125, 0], index: 1 },
        { start: [125, 200], end: [250, 200], index: 3 },
        { start: [125, 0], end: [125, 200], index: 9 },
      ],
    ],
    [
      "unsorted duplicates",
      [
        { start: [125, 0], end: [125, 200], index: 2, extra: "x" },
        { start: [125, 0], end: [125, 200], index: 2 },
        "junk",
      ],
    ],
  ])(
    "can render and interact with a restored elbow arrow with %s fixedSegments",
    (_, fixedSegments) => {
      const arrow = {
        ...API.createElement({
          type: "arrow",
          elbowed: true,
          x: 0,
          y: 0,
          points: [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(125, 0),
            pointFrom<LocalPoint>(125, 200),
            pointFrom<LocalPoint>(250, 200),
          ],
        }),
        fixedSegments,
      } as unknown as ExcalidrawElbowArrowElement;

      API.updateScene({
        elements: restoreElements([arrow], null),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const restored = h.elements[0] as ExcalidrawElbowArrowElement;
      expect(
        restored.fixedSegments === null ||
          (Array.isArray(restored.fixedSegments) &&
            restored.fixedSegments.every(
              (segment) =>
                segment.index === 2 &&
                Object.keys(segment).sort().join() === "end,index,start",
            )),
      ).toBe(true);

      // select the arrow
      mouse.reset();
      mouse.clickAt(60, 0);
      expect(h.state.selectedLinearElement?.elementId).toBe(restored.id);

      // hover and drag the middle segment
      mouse.reset();
      mouse.moveTo(125, 100);
      mouse.down();
      mouse.moveTo(140, 100);
      mouse.up();

      expect(
        (h.elements[0] as ExcalidrawElbowArrowElement).fixedSegments,
      ).toEqual([
        {
          index: 2,
          start: pointFrom<LocalPoint>(140, 0),
          end: pointFrom<LocalPoint>(140, 200),
        },
      ]);

      // drag the end point with a fixed segment
      mouse.reset();
      mouse.moveTo(250, 200);
      mouse.down();
      mouse.moveTo(300, 250);
      mouse.up();

      expect(
        (h.elements[0] as ExcalidrawElbowArrowElement).fixedSegments,
      ).toHaveLength(1);

      // release the fixed segment
      mouse.reset();
      mouse.moveTo(140, 125);
      mouse.doubleClick();

      const updated = h.elements[0] as ExcalidrawElbowArrowElement;
      expect(updated.isDeleted).toBe(false);
      expect(updated.fixedSegments).toBe(null);
      expect(
        updated.points.every(
          (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]),
        ),
      ).toBe(true);
    },
  );
});

describe("elbow arrow with malformed bindings", () => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error ?? event.message);
    event.preventDefault();
  };

  beforeEach(async () => {
    errors.length = 0;
    window.addEventListener("error", onError);
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(() => {
    window.removeEventListener("error", onError);
  });

  const validBinding = {
    elementId: "rect",
    fixedPoint: [1, 0.5001],
    mode: "orbit",
  };

  it.each([
    ["string startBinding", "present", { startBinding: "str" }],
    ["empty object endBinding", "present", { endBinding: {} }],
    [
      "startBinding with numeric elementId",
      "present",
      {
        startBinding: { elementId: 123 },
      },
    ],
    [
      "startBinding to a missing element",
      "missing",
      {
        startBinding: validBinding,
      },
    ],
    [
      "endBinding to a deleted element",
      "deleted",
      {
        endBinding: { ...validBinding, fixedPoint: [0, 0.5001] },
      },
    ],
  ])(
    "can interact with a restored elbow arrow with %s (rect %s)",
    (_, rectState, overrides) => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: -100,
        y: -50,
        width: 100,
        height: 100,
        isDeleted: rectState === "deleted",
      });
      const arrow = {
        ...API.createElement({
          type: "arrow",
          elbowed: true,
          x: 0,
          y: 0,
          points: [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(100, 0),
            pointFrom<LocalPoint>(100, 100),
            pointFrom<LocalPoint>(200, 100),
          ],
        }),
        ...overrides,
      } as unknown as ExcalidrawArrowElement;

      API.updateScene({
        elements: restoreElements(
          rectState === "missing" ? [arrow] : [rect, arrow],
          null,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const getArrow = () =>
        h.elements.find(
          (element) => element.id === arrow.id,
        ) as ExcalidrawArrowElement;
      const at = (index: number) => {
        const { x, y, points } = getArrow();
        const [px, py] = points.at(index)!;
        return [x + px, y + py] as const;
      };
      const selectArrow = () => {
        mouse.reset();
        mouse.clickAt((at(0)[0] + at(1)[0]) / 2, (at(0)[1] + at(1)[1]) / 2);
      };

      selectArrow();
      expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);

      // drag the middle segment
      const mid = Math.floor((getArrow().points.length - 1) / 2);
      const [mx, my] = [
        (at(mid)[0] + at(mid + 1)[0]) / 2,
        (at(mid)[1] + at(mid + 1)[1]) / 2,
      ];
      mouse.reset();
      mouse.moveTo(mx, my);
      mouse.down();
      mouse.moveTo(mx + 15, my + 15);
      mouse.up();

      // drag both endpoints
      for (const index of [0, -1]) {
        selectArrow();
        const [px, py] = at(index);
        mouse.reset();
        mouse.moveTo(px, py);
        mouse.down();
        mouse.moveTo(px + 30, py + 40);
        mouse.up();
      }

      // drag the rectangle
      mouse.reset();
      mouse.clickAt(-50, -45);
      mouse.down();
      mouse.moveTo(-20, 10);
      mouse.up();

      Keyboard.keyPress(KEYS.ESCAPE);

      expect(errors).toEqual([]);
      expect(
        getArrow().points.every(
          (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]),
        ),
      ).toBe(true);
    },
  );
});
