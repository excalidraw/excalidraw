import React from "react";
import { vi } from "vitest";

import { KEYS, ROUNDNESS, arrayToMap, reseed } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getElementBounds,
  getElementLineSegments,
  getElementsWithinSelection,
} from "@excalidraw/element";
import { pointFrom, pointRotateRads, type LocalPoint } from "@excalidraw/math";

import { TOOLS } from "../components/Tools";

import { Excalidraw } from "../index";
import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  render,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  assertSelectedElements,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const renderInteractiveScene = vi.spyOn(
  InteractiveCanvas,
  "renderInteractiveScene",
);
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

beforeEach(() => {
  localStorage.clear();
  renderInteractiveScene.mockClear();
  renderStaticScene.mockClear();
  reseed(7);
});

const { h } = window;

const mouse = new Pointer("mouse");

const getOutlineBounds = (element: ReturnType<typeof API.createElement>) => {
  const sceneElement = API.getElement(element);
  const elementsMap = h.scene.getNonDeletedElementsMap();
  const points = getElementLineSegments(sceneElement, elementsMap).flat();

  return [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1])),
  ] as const;
};

describe("box-selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("should allow adding to selection via box-select when holding shift", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
    });

    API.setElements([rect1, rect2]);

    mouse.downAt(175, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(85, 70);
    mouse.up();

    assertSelectedElements([rect2.id]);

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.downAt(75, -20);
      mouse.move(-1000, -1000);
      mouse.moveTo(-15, 70);
      mouse.up();
    });

    assertSelectedElements([rect2.id, rect1.id]);
  });

  it("should (de)select element when box-selecting over and out while not holding shift", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    mouse.downAt(75, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(-15, 70);

    assertSelectedElements([rect1.id]);

    mouse.moveTo(100, -100);

    assertSelectedElements([]);

    mouse.up();

    assertSelectedElements([]);
  });

  it("should not select an element when the selection box only partially overlaps it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    mouse.downAt(25, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(75, 70);
    mouse.up();

    assertSelectedElements([]);
  });
});

describe("lasso reselection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("should allow ctrl+alt lasso reselection when starting inside the active common bounds", () => {
    const rectA = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rectB = API.createElement({
      type: "rectangle",
      x: 220,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
    });

    API.setElements([rectA, rectB]);
    mouse.select([rectA, rectB]);
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    // NOTE: the lasso starts inside the common bounds of the selection, and
    // encloses rectA only (the default box selection mode being "contain")
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      mouse.downAt(110, 50);
      mouse.moveTo(110, -50);

      expect(h.app.lassoTrail.hasCurrentTrail).toBe(true);

      mouse.moveTo(-50, -50);
      mouse.moveTo(-50, 150);
      mouse.moveTo(110, 150);
      mouse.moveTo(110, 50);
      mouse.up();
    });

    assertSelectedElements([rectA.id]);
  });
});

describe("lasso on touch devices", () => {
  it("a tap selects the element", async () => {
    await render(<Excalidraw UIOptions={{ getFormFactor: () => "tablet" }} />);
    fireEvent.resize(window);
    await waitFor(() =>
      expect(h.app.editorInterface.formFactor).toBe("tablet"),
    );
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    API.setElements([rectangle]);
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    mouse.clickAt(50, 50);

    assertSelectedElements([rectangle.id]);
  });
});

describe("alt-click cycling", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  // bottom to top, all three overlapping at (50, 50)
  const createStack = (groupIds: { bottom?: string[]; middle?: string[] }) => {
    const [bottom, middle, top] = (["bottom", "middle", "top"] as const).map(
      (name, index) =>
        API.createElement({
          type: "rectangle",
          x: index * 10,
          y: index * 10,
          width: 100,
          height: 100,
          backgroundColor: "red",
          fillStyle: "solid",
          groupIds: name === "top" ? [] : groupIds[name] ?? [],
        }),
    );
    API.setElements([bottom, middle, top]);
    return { bottom, middle, top };
  };

  it("selects the element below the selected one, wrapping around to the topmost", () => {
    const { bottom, middle, top } = createStack({});

    mouse.clickAt(50, 50);
    assertSelectedElements([top.id]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.clickAt(50, 50);
      assertSelectedElements([middle.id]);
      mouse.clickAt(50, 50);
      assertSelectedElements([bottom.id]);
      mouse.clickAt(50, 50);
      assertSelectedElements([top.id]);
    });
  });

  it("cycles through the edited group's elements only", () => {
    const { bottom, middle } = createStack({
      bottom: ["group"],
      middle: ["group"],
    });

    // deep select the middle one where the top one isn't
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.clickAt(15, 15);
    });
    assertSelectedElements([middle.id]);
    expect(h.state.editingGroupId).toBe("group");

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.clickAt(50, 50);
      assertSelectedElements([bottom.id]);
      mouse.clickAt(50, 50);
      assertSelectedElements([middle.id]);
    });
    expect(h.state.editingGroupId).toBe("group");
  });

  it("cycles on the selected element's resize handle, alt-resizing only past the drag threshold", () => {
    const { middle, top } = createStack({});

    // the middle one's right resize handle, over the top one (a bit of a
    // drag still being a click)
    API.setSelectedElements([middle]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(113, 60);
      mouse.moveTo(118, 60);
      mouse.upAt();
    });
    assertSelectedElements([top.id]);
    expect(API.getElement(middle).width).toBe(100);

    API.setSelectedElements([middle]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(113, 60);
      mouse.moveTo(153, 60);
      mouse.upAt();
    });
    assertSelectedElements([middle.id]);
    // (resized from its center)
    expect(API.getElement(middle)).toMatchObject({ x: -30, width: 180 });
  });

  it("sets up the line editor of an arrow it selects", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 20,
      y: 50,
      width: 60,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(60, 0)],
    });
    API.setElements([rectangle, arrow]);

    // (off the arrow's midpoint knob)
    mouse.clickAt(35, 50);
    assertSelectedElements([arrow.id]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.clickAt(35, 50);
      assertSelectedElements([rectangle.id]);
      mouse.clickAt(35, 50);
    });
    assertSelectedElements([arrow.id]);
    expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);
  });

  it("alt+double-click doesn't create or edit text", () => {
    createStack({});
    mouse.clickAt(50, 50);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.doubleClickAt(50, 50);
    });

    expect(h.state.editingTextElement).toBe(null);
    expect(h.elements.length).toBe(3);
  });

  it("hints at cycling while Alt is held over a single selection", () => {
    const { middle, top } = createStack({});
    const hint = () =>
      h.app.ownerDocument.querySelector(".HintViewer")?.textContent ?? "";
    const cycleHint = "to cycle selection";
    const press = (modifiers: { alt?: boolean; ctrl?: boolean }) =>
      Keyboard.withModifierKeys(modifiers, () => {
        Keyboard.keyDown(KEYS.ALT, GlobalTestState.interactiveCanvas);
      });
    const release = () =>
      Keyboard.keyUp(KEYS.ALT, GlobalTestState.interactiveCanvas);

    mouse.clickAt(50, 50);
    expect(hint()).not.toContain(cycleHint);
    press({ alt: true });
    expect(hint()).toContain(cycleHint);
    // (the hover refresh after the click doesn't release Alt)
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.clickAt(50, 50);
    });
    assertSelectedElements([middle.id]);
    expect(hint()).toContain(cycleHint);
    release();
    expect(hint()).not.toContain(cycleHint);

    // Alt+Tab never delivers the keyup
    press({ alt: true });
    fireEvent.blur(window);
    expect(hint()).not.toContain(cycleHint);

    // (AltGr on Windows) alt-clicks with Ctrl don't cycle
    press({ alt: true, ctrl: true });
    expect(hint()).not.toContain(cycleHint);
    release();

    API.setSelectedElements([middle, top]);
    press({ alt: true });
    expect(hint()).not.toContain(cycleHint);
    release();
  });

  it("alt-drag duplicates only past the drag threshold", () => {
    const { top } = createStack({});
    mouse.clickAt(50, 50);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(50, 50);
      mouse.moveTo(55, 55);
      mouse.upAt();
    });

    expect(h.elements.length).toBe(3);
    expect(API.getElement(top)).toMatchObject({ x: top.x, y: top.y });
  });
});

describe("box-selection overlap mode", () => {
  const boxSelect = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    mouse.downAt(startX, startY);
    mouse.move(-1000, -1000);
    mouse.moveTo(endX, endY);
    mouse.up();
  };

  const boxSelectTopLeftAabbCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneElement, elementsMap);

    boxSelect(x1 + 2, y1 + 2, x1 + 12, y1 + 12);
  };

  const boxSelectTopRightAabbCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [, y1, x2] = getElementBounds(sceneElement, elementsMap);

    boxSelect(x2 - 12, y1 + 2, x2 - 2, y1 + 12);
  };

  const boxSelectTopLeftRotatedLocalBoundsCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1, x2, y2] = getElementBounds(sceneElement, elementsMap, true);
    const center = pointFrom((x1 + x2) / 2, (y1 + y2) / 2);
    const [cornerX, cornerY] = pointRotateRads(
      pointFrom(x1, y1),
      center,
      sceneElement.angle,
    );

    boxSelect(cornerX - 4, cornerY - 4, cornerX + 4, cornerY + 4);
  };

  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{ appState: { boxSelectionMode: "overlap" } }}
      />,
    );
  });

  it("should select an element when the selection box partially overlaps it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, -20, 75, 70);

    assertSelectedElements([rect1.id]);
  });

  it("should select the whole group when overlapping one group member", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });

    API.setElements([rect1, rect2]);

    boxSelect(25, -20, 75, 70);

    assertSelectedElements([rect1.id, rect2.id]);
    expect(h.state.selectedGroupIds).toEqual({ A: true });
  });

  it("should return all group elements when overlapping one group member", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      id: "rect1",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      id: "rect2",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      id: "rect3",
      x: 200,
      y: 0,
      width: 50,
      height: 50,
    });
    const selection = API.createElement({
      type: "rectangle",
      x: 125,
      y: -10,
      width: 10,
      height: 70,
    });
    const elements = [rect1, rect2, rect3];

    expect(
      getElementsWithinSelection(
        elements,
        selection,
        arrayToMap([...elements, selection]),
        false,
        "overlap",
      ).map((element) => element.id),
    ).toEqual([rect1.id, rect2.id]);
  });

  it("should retain nested and interleaved group element order", () => {
    const outerNested1 = API.createElement({
      type: "rectangle",
      id: "outerNested1",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const other1 = API.createElement({
      type: "rectangle",
      id: "other1",
      x: 70,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["other"],
    });
    const outerOnly = API.createElement({
      type: "rectangle",
      id: "outerOnly",
      x: 140,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["outer"],
    });
    const other2 = API.createElement({
      type: "rectangle",
      id: "other2",
      x: 210,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["other"],
    });
    const outerNested2 = API.createElement({
      type: "rectangle",
      id: "outerNested2",
      x: 280,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const selection = API.createElement({
      type: "rectangle",
      x: 295,
      y: -10,
      width: 10,
      height: 70,
    });
    const elements = [outerNested1, other1, outerOnly, other2, outerNested2];

    expect(
      getElementsWithinSelection(
        elements,
        selection,
        arrayToMap([...elements, selection]),
        false,
        "overlap",
      ).map((element) => element.id),
    ).toEqual([outerNested1.id, outerOnly.id, outerNested2.id]);
  });

  it("should not select a transparent rectangle when the selection box stays inside it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, 25, 75, 75);

    assertSelectedElements([]);
  });

  it("should select a transparent rectangle when the selection box crosses its outline", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, 25, 125, 75);

    assertSelectedElements([rect1.id]);
  });

  it("should not select a rotated transparent rectangle when the selection box stays inside it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(40, 40, 60, 60);

    assertSelectedElements([]);
  });

  it("should select a rotated rounded rectangle when the selection box contains its outline but not its bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 180,
      angle: Math.PI / 6,
      backgroundColor: "transparent",
      fillStyle: "solid",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      roughness: 0,
    });

    API.setElements([rect]);

    const sceneRect = API.getElement(rect);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [boundsX1, boundsY1, boundsX2, boundsY2] = getElementBounds(
      sceneRect,
      elementsMap,
    );
    const [outlineX1, outlineY1, outlineX2, outlineY2] = getOutlineBounds(rect);

    expect(outlineX1).toBeGreaterThan(boundsX1 - 1);
    expect(outlineY1).toBeGreaterThan(boundsY1 - 1);
    expect(outlineX2).toBeLessThan(boundsX2 + 1);
    expect(outlineY2).toBeLessThan(boundsY2 + 1);

    boxSelect(
      outlineX1 - (outlineX1 - boundsX1) / 2,
      outlineY1 - (outlineY1 - boundsY1) / 2,
      outlineX2 + (boundsX2 - outlineX2) / 2,
      outlineY2 + (boundsY2 - outlineY2) / 2,
    );

    assertSelectedElements([rect.id]);
  });

  it("should not select a filled rotated rectangle when the selection box only overlaps its axis-aligned bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    boxSelectTopLeftAabbCorner(rect);

    assertSelectedElements([]);
  });

  it("should not select a filled ellipse when the selection box only overlaps its bounds corner", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([ellipse]);

    boxSelectTopRightAabbCorner(ellipse);

    assertSelectedElements([]);
  });

  it("should not select a filled diamond when the selection box only overlaps its bounds corner", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([diamond]);

    boxSelectTopRightAabbCorner(diamond);

    assertSelectedElements([]);
  });

  it("should not select a filled rotated ellipse when the selection box only overlaps its axis-aligned bounds", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([ellipse]);

    boxSelectTopLeftRotatedLocalBoundsCorner(ellipse);

    assertSelectedElements([]);
  });

  it("should not select a filled rotated diamond when the selection box only overlaps its rotated local bounds", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([diamond]);

    boxSelectTopLeftRotatedLocalBoundsCorner(diamond);

    assertSelectedElements([]);
  });

  it("should not select rotated text when the selection box only overlaps its axis-aligned bounds", () => {
    const text = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      text: "test",
    });

    API.setElements([text]);

    boxSelect(-18, -18, -8, -8);

    assertSelectedElements([]);
  });

  it("should not select rotated image when the selection box only overlaps its axis-aligned bounds", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      fileId: "file_A",
      status: "saved",
    });

    API.setElements([image]);

    boxSelect(-18, -18, -8, -8);

    assertSelectedElements([]);
  });

  it("should deselect a selected rotated rectangle when clicking in the empty corner of its axis-aligned bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    mouse.clickAt(50, 50);
    assertSelectedElements([rect.id]);

    const sceneRect = API.getElement(rect);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneRect, elementsMap);

    mouse.clickAt(x1 + 2, y1 + 2);

    assertSelectedElements([]);
  });

  it("should not select a line when the selection box only overlaps its bounds", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
    });

    API.setElements([line]);

    boxSelect(20, 50, 30, 60);

    assertSelectedElements([]);
  });

  it("should not click-select rotated freedraw in the corner of its axis-aligned bounds", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "transparent",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
    });

    API.setElements([freedraw]);

    const sceneFreedraw = API.getElement(freedraw);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneFreedraw, elementsMap);

    mouse.clickAt(x1 + 2, y1 + 2);

    assertSelectedElements([]);
  });

  it.each(["variable", "constant"] as const)(
    "should select and drag a filled %s freedraw loop from its interior",
    (variability) => {
      const freedraw = API.createElement({
        type: "freedraw",
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        backgroundColor: "#ffc9c9",
        fillStyle: "solid",
        strokeOptions: { variability, streamline: 0.5 },
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(200, 0),
          pointFrom<LocalPoint>(200, 100),
          pointFrom<LocalPoint>(0, 100),
          pointFrom<LocalPoint>(0, 0),
        ],
      });

      API.setElements([freedraw]);

      mouse.clickAt(203, 152);
      assertSelectedElements([freedraw.id]);

      mouse.downAt(203, 152);
      mouse.moveTo(233, 172);
      mouse.up();

      expect(API.getElement(freedraw)).toMatchObject({ x: 130, y: 120 });
      assertSelectedElements([freedraw.id]);
    },
  );

  it("should not select a freedraw when the selection box only overlaps its bounds", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 50),
        pointFrom<LocalPoint>(100, 100),
      ],
    });

    API.setElements([freedraw]);

    boxSelect(20, 50, 30, 60);

    assertSelectedElements([]);
  });

  it("should not select a transparent framed element when the selection box stays inside its clipped bounds", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 10,
      width: 100,
      height: 80,
      frameId: frame.id,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([frame, rect1]);

    boxSelect(60, 20, 90, 60);

    assertSelectedElements([]);
  });

  it("should not select a framed element when selection only overlaps its clipped-out outline", () => {
    const frame = API.createElement({
      type: "frame",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      frameId: frame.id,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([frame, rect1]);

    boxSelect(40, 170, 70, 220);

    assertSelectedElements([]);
  });
});

describe("inner box-selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });
  it("selecting elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    });
    API.setElements([rect1, rect2, rect3]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.move(-1000, -1000);
      mouse.moveTo(290, 290);
      mouse.up();

      assertSelectedElements([rect2.id, rect3.id]);
    });
  });

  it("selecting grouped elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    API.setElements([rect1, rect2, rect3]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.move(-1000, -1000);
      mouse.moveTo(rect2.x + rect2.width + 10, rect2.y + rect2.height + 10);
      mouse.up();

      assertSelectedElements([rect1.id]);
      expect(h.state.selectedGroupIds).toEqual({});
    });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.move(-1000, -1000);
      mouse.moveTo(rect3.x + rect3.width + 10, rect3.y + rect3.height + 10);
      mouse.up();

      assertSelectedElements([rect2.id, rect3.id]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
    });
  });

  it("does not select a nested outer group until all members are contained", async () => {
    const innerRect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const innerRect2 = API.createElement({
      type: "rectangle",
      x: 120,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const outerRect = API.createElement({
      type: "rectangle",
      x: 190,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["outer"],
    });
    API.setElements([innerRect1, innerRect2, outerRect]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(0, 0);
      mouse.move(-1000, -1000);
      mouse.moveTo(
        innerRect2.x + innerRect2.width + 10,
        innerRect2.y + innerRect2.height + 10,
      );
      mouse.up();

      assertSelectedElements([]);
      expect(h.state.selectedGroupIds).toEqual({});
    });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(0, 0);
      mouse.move(-1000, -1000);
      mouse.moveTo(
        outerRect.x + outerRect.width + 10,
        outerRect.y + outerRect.height + 10,
      );
      mouse.up();

      assertSelectedElements([innerRect1.id, innerRect2.id, outerRect.id]);
      expect(h.state.selectedGroupIds).toEqual({ outer: true });
    });
  });

  it.skip("checks nested containment against the current editing depth", async () => {
    const innerRect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const innerRect2 = API.createElement({
      type: "rectangle",
      x: 120,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const outerRect = API.createElement({
      type: "rectangle",
      x: 190,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["outer"],
    });
    const selection = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 140,
      height: 70,
    });
    const elements = [innerRect1, innerRect2, outerRect];
    const elementsMap = arrayToMap([...elements, selection]);

    expect(
      getElementsWithinSelection(
        elements,
        selection,
        elementsMap,
        false,
        "contain",
      ).map((element) => element.id),
    ).toEqual([]);

    expect(
      getElementsWithinSelection(
        elements,
        selection,
        elementsMap,
        false,
        "contain",
        // "outer", /* editingGroupId - add as param once we implement nested group handling */
      ).map((element) => element.id),
    ).toEqual([innerRect1.id, innerRect2.id]);
  });

  it("ignores grouped bound text when checking box-selection containment", async () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
      boundElements: [{ type: "text", id: "bound-text" }],
    });
    const boundText = API.createElement({
      type: "text",
      id: "bound-text",
      x: 50,
      y: 50,
      width: 50,
      height: 20,
      containerId: container.id,
      groupIds: ["A"],
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    API.setElements([container, boundText, rect]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.move(-1000, -1000);
      mouse.moveTo(rect.x + rect.width + 10, rect.y + rect.height + 10);
      mouse.up();

      expect(h.state.selectedElementIds[container.id]).toBe(true);
      expect(h.state.selectedElementIds[rect.id]).toBe(true);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
    });
  });

  it("selecting & deselecting grouped elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    API.setElements([rect1, rect2, rect3]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(rect2.x - 20, rect2.y - 20);
      mouse.move(-1000, -1000);
      mouse.moveTo(rect3.x + rect3.width + 10, rect3.y + rect3.height + 10);
      assertSelectedElements([rect2.id, rect3.id]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
      mouse.moveTo(rect2.x - 10, rect2.y - 10);
      assertSelectedElements([rect1.id]);
      expect(h.state.selectedGroupIds).toEqual({});
      mouse.up();
    });
  });
});

describe("app.selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  const createFrame = (groupIds: string[] = []) => {
    const frame = API.createElement({
      type: "frame",
      width: 200,
      height: 200,
      groupIds,
    });
    const child = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      frameId: frame.id,
    });
    return { frame, child };
  };

  it("add() of a frame deselects its children", () => {
    const { frame, child } = createFrame();
    const other = API.createElement({ type: "rectangle", x: 300 });
    API.setElements([child, frame, other]);
    API.setSelectedElements([child, other]);

    act(() => h.app.selection.add(frame));

    assertSelectedElements([other.id, frame.id]);
  });

  it("add() doesn't add a child of a selected frame", () => {
    const { frame, child } = createFrame();
    API.setElements([child, frame]);
    API.setSelectedElements([frame]);

    act(() => h.app.selection.add(child));

    assertSelectedElements([frame.id]);
  });

  it("add() of an element grouped with a frame deselects that frame's children", () => {
    const { frame, child } = createFrame(["group"]);
    const grouped = API.createElement({
      type: "rectangle",
      x: 300,
      groupIds: ["group"],
    });
    API.setElements([child, frame, grouped]);
    API.setSelectedElements([child]);

    act(() => h.app.selection.add(grouped));

    assertSelectedElements([frame.id, grouped.id]);
  });

  it("add() replaces the selection in the element link selector", () => {
    const source = API.createElement({ type: "rectangle" });
    const target = API.createElement({ type: "rectangle", x: 300 });
    const linked = API.createElement({ type: "rectangle", x: 600 });
    API.setElements([source, target, linked]);
    API.setAppState({
      openDialog: { name: "elementLinkSelector", sourceElementId: source.id },
    });
    // (opening the selector clears the selection)
    API.setSelectedElements([linked]);
    assertSelectedElements([linked.id]);

    act(() => h.app.selection.add(target));

    assertSelectedElements([target.id]);
  });

  it("select() sets up the line editor of an arrow, and drops it for other elements", () => {
    const arrow = API.createElement({
      type: "arrow",
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });
    const rectangle = API.createElement({ type: "rectangle", x: 300 });
    API.setElements([arrow, rectangle]);

    act(() => h.app.selection.select(arrow));
    assertSelectedElements([arrow.id]);
    expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);

    act(() => h.app.selection.select(rectangle));
    assertSelectedElements([rectangle.id]);
    expect(h.state.selectedLinearElement).toBe(null);
  });

  it("takes elements or ids, one or many, skipping missing ones", () => {
    const [a, b, c] = [0, 100, 200].map((x) =>
      API.createElement({ type: "rectangle", x }),
    );
    API.setElements([a, b, c]);

    act(() => h.app.selection.select([a.id, "missing", b, a]));
    assertSelectedElements([a.id, b.id]);

    act(() => h.app.selection.add(c.id));
    assertSelectedElements([a.id, b.id, c.id]);

    act(() => h.app.selection.remove([a, b.id]));
    assertSelectedElements([c.id]);
  });

  it("add() of a frame along with its child selects the frame, in either order", () => {
    const { frame, child } = createFrame();
    API.setElements([child, frame]);

    act(() => h.app.selection.add([child, frame]));
    assertSelectedElements([frame.id]);

    act(() => h.app.selection.clear());
    act(() => h.app.selection.add([frame, child]));
    assertSelectedElements([frame.id]);
  });

  it("remove() of an element selected via its group keeps the other selected groups", () => {
    const [a1, a2, b1, b2] = ["a", "a", "b", "b"].map((groupId, index) =>
      API.createElement({
        type: "rectangle",
        x: index * 100,
        groupIds: [groupId],
      }),
    );
    API.setElements([a1, a2, b1, b2]);
    API.setSelectedElements([a1, a2, b1, b2]);

    act(() => h.app.selection.remove(a1));

    assertSelectedElements([b1.id, b2.id]);
    expect(h.state.selectedGroupIds).toEqual({ b: true });
  });

  it("shows the link popup of a lone selected element with a link, whatever was selected before", () => {
    const linked = API.createElement({ type: "rectangle" });
    const other = API.createElement({ type: "rectangle", x: 300 });
    API.setElements([linked, other]);
    API.updateElement(linked, { link: "https://excalidraw.com" });

    act(() => h.app.selection.select(linked.id));
    expect(h.state.showHyperlinkPopup).toBe("info");

    act(() => h.app.selection.select(other));
    expect(h.state.showHyperlinkPopup).toBe(false);

    act(() => h.app.selection.select(linked));
    expect(h.state.showHyperlinkPopup).toBe("info");

    act(() => h.app.selection.add(other));
    expect(h.state.showHyperlinkPopup).toBe(false);

    act(() => h.app.selection.remove(other));
    expect(h.state.showHyperlinkPopup).toBe("info");

    act(() => h.app.selection.clear());
    expect(h.state.showHyperlinkPopup).toBe(false);
  });

  it("skips locked elements, unless includeLocked", () => {
    const locked = API.createElement({ type: "rectangle", locked: true });
    const other = API.createElement({ type: "rectangle", x: 300 });
    API.setElements([locked, other]);

    act(() => h.app.selection.select([locked, other]));
    assertSelectedElements([other.id]);

    act(() => h.app.selection.add(locked, { includeLocked: true }));
    assertSelectedElements([locked.id, other.id]);
  });

  it("ends the cropping and deactivates the embed of what it deselects", () => {
    const image = API.createElement({ type: "image" });
    const embed = API.createElement({ type: "embeddable", x: 300 });
    const other = API.createElement({ type: "rectangle", x: 600 });
    API.setElements([image, embed, other]);

    API.setSelectedElements([image]);
    API.setAppState({ croppingElementId: image.id });
    act(() => h.app.selection.select(image));
    expect(h.state.croppingElementId).toBe(image.id);
    act(() => h.app.selection.select(other));
    expect(h.state.croppingElementId).toBe(null);

    API.setSelectedElements([embed]);
    API.setAppState({ activeEmbeddable: { element: embed, state: "active" } });
    act(() => h.app.selection.add(other));
    expect(h.state.activeEmbeddable?.element.id).toBe(embed.id);
    act(() => h.app.selection.remove(embed));
    expect(h.state.activeEmbeddable).toBe(null);
  });

  it("records the change for undo with captureUpdate", () => {
    const [a, b] = [0, 300].map((x) =>
      API.createElement({ type: "rectangle", x }),
    );
    API.setElements([a, b]);
    const { IMMEDIATELY } = CaptureUpdateAction;

    act(() => h.app.selection.select(a, { captureUpdate: IMMEDIATELY }));
    act(() => h.app.selection.select(b, { captureUpdate: IMMEDIATELY }));
    act(() => {
      h.app.actionManager.executeAction(h.app.actionManager.actions.undo);
    });

    assertSelectedElements([a.id]);
  });

  it("deep-selects the elements themselves, editing their shared group", () => {
    const [a, b, c] = [0, 100, 200].map((x) =>
      API.createElement({ type: "rectangle", x, groupIds: ["group"] }),
    );
    API.setElements([a, b, c]);

    act(() => h.app.selection.select([a, b], { deep: true }));

    assertSelectedElements([a.id, b.id]);
    expect(h.state.editingGroupId).toBe("group");
  });

  it("remove() leaving an arrow alone sets up its line editor", () => {
    const arrow = API.createElement({
      type: "arrow",
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });
    const rectangle = API.createElement({ type: "rectangle", x: 300 });
    API.setElements([arrow, rectangle]);
    API.setSelectedElements([arrow, rectangle]);

    act(() => h.app.selection.remove(rectangle));

    assertSelectedElements([arrow.id]);
    expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);
  });
});

describe("transform handles", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("show the resize cursor over the selection's handles", () => {
    const [a, b] = [0, 200].map((x) =>
      API.createElement({ type: "rectangle", x, width: 100, height: 100 }),
    );
    API.setElements([a, b]);
    const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

    // a lone element's right edge
    API.setSelectedElements([a]);
    mouse.moveTo(103, 50);
    expect(cursor()).toBe("ew-resize");

    // the selection's right edge
    API.setSelectedElements([a, b]);
    mouse.moveTo(303, 50);
    expect(cursor()).toBe("ew-resize");
    mouse.moveTo(150, 50);
    expect(cursor()).not.toBe("ew-resize");
  });
});

describe("selection element", () => {
  it("create selection element on pointer down", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });

    expect(renderInteractiveScene).toHaveBeenCalledTimes(3);
    expect(renderStaticScene).toHaveBeenCalledTimes(3);
    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 100]);
    expect([selectionElement.width, selectionElement.height]).toEqual([0, 0]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("resize selection element on pointer move", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });

    expect(renderInteractiveScene).toHaveBeenCalledTimes(5);
    expect(renderStaticScene).toHaveBeenCalledTimes(3);
    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 30]);
    expect([selectionElement.width, selectionElement.height]).toEqual([90, 70]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("remove selection element on pointer up", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(6);
    expect(renderStaticScene).toHaveBeenCalledTimes(3);
    expect(h.state.selectionElement).toBeNull();
  });
});

describe("select single element on the scene", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("rectangle", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(8);
    expect(renderStaticScene).toHaveBeenCalledTimes(7);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("diamond", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("diamond");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(8);
    expect(renderStaticScene).toHaveBeenCalledTimes(7);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("ellipse", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(8);
    expect(renderStaticScene).toHaveBeenCalledTimes(7);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("arrow", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("arrow");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    /*
        1 2 3 4 5 6 7 8 9
      1
      2     x
      3
      4       .
      5
      6
      7           x
      8
      9
    */

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the arrow
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(11);
    expect(renderStaticScene).toHaveBeenCalledTimes(9);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("arrow escape", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("line");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    /*
        1 2 3 4 5 6 7 8 9
      1
      2     x
      3
      4       .
      5
      6
      7           x
      8
      9
    */

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the arrow
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(11);
    expect(renderStaticScene).toHaveBeenCalledTimes(9);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});

describe("tool locking & selection", () => {
  it("should not select newly created element while tool is locked", async () => {
    await render(<Excalidraw />);

    UI.clickTool("lock");
    expect(h.state.activeTool.locked).toBe(true);

    for (const value of Object.keys(TOOLS) as (keyof typeof TOOLS)[]) {
      if (
        value !== "image" &&
        value !== "selection" &&
        value !== "lasso" &&
        value !== "eraser" &&
        value !== "arrow" &&
        value !== "hand" &&
        value !== "laser" &&
        // no top-level toolbar button (rendered in the extra-tools dropdown)
        value !== "frame" &&
        value !== "embeddable" &&
        value !== "autoshape" &&
        value !== "bucketfill"
      ) {
        const element = UI.createElement(value);
        expect(h.state.selectedElementIds[element.id]).not.toBe(true);
      }
    }
  });
});

describe("selectedElementIds stability", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("box-selection should be stable when not changing selection", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    API.setElements([rectangle]);

    const selectedElementIds_1 = h.state.selectedElementIds;

    mouse.downAt(-100, -100);
    mouse.moveTo(-50, -50);
    mouse.up();

    expect(h.state.selectedElementIds).toBe(selectedElementIds_1);

    mouse.downAt(-50, -50);
    mouse.move(-1000, -1000);
    mouse.moveTo(50, 50);

    const selectedElementIds_2 = h.state.selectedElementIds;

    expect(selectedElementIds_2).toEqual({ [rectangle.id]: true });

    mouse.moveTo(60, 60);

    // box-selecting further without changing selection should keep
    // selectedElementIds stable (the same object)
    expect(h.state.selectedElementIds).toBe(selectedElementIds_2);

    mouse.up();

    expect(h.state.selectedElementIds).toBe(selectedElementIds_2);
  });
});

describe("deselecting", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("esc unwinds nested group editing before deselecting", () => {
    const rectA = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      groupIds: ["inner", "outer"],
    });
    const rectB = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      groupIds: ["outer"],
    });
    const rectC = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      groupIds: ["inner", "outer"],
    });

    API.setElements([rectA, rectB, rectC]);

    mouse.select(rectA);
    assertSelectedElements(rectA, rectB, rectC);
    expect(h.state.editingGroupId).toBeNull();

    mouse.doubleClickOn(rectA);
    assertSelectedElements(rectA, rectC);
    expect(h.state.editingGroupId).toBe("outer");

    mouse.doubleClickOn(rectA);
    assertSelectedElements(rectA);
    expect(h.state.editingGroupId).toBe("inner");

    Keyboard.keyPress(KEYS.ESCAPE);
    assertSelectedElements(rectA, rectC);
    expect(h.state.editingGroupId).toBe("outer");

    Keyboard.keyPress(KEYS.ESCAPE);
    assertSelectedElements(rectA, rectB, rectC);
    expect(h.state.editingGroupId).toBeNull();
    expect(h.state.selectedGroupIds).toEqual({ outer: true });

    Keyboard.keyPress(KEYS.ESCAPE);
    expect(API.getSelectedElements()).toEqual([]);
    expect(h.state.editingGroupId).toBeNull();
    expect(h.state.selectedGroupIds).toEqual({});
  });
});
