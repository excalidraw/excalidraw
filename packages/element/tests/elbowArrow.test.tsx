import { ARROW_TYPE } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";

import { actionSelectAll } from "@excalidraw/excalidraw/actions";
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

import type { LocalPoint } from "@excalidraw/math";

import { bindLinearElement } from "../src/binding";

import Scene from "../src/Scene";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
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
      [115, 0],
      [115, 199.9],
      [195, 199.9],
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
  it("can properly generate orthogonal arrow points", () => {
    const scene = new Scene();
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
    }) as ExcalidrawElbowArrowElement;
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
    const scene = new Scene();
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: -45,
      y: -100.1,
      width: 90,
      height: 200,
      points: [pointFrom(0, 0), pointFrom(90, 200)],
    }) as ExcalidrawElbowArrowElement;
    scene.insertElement(rectangle1);
    scene.insertElement(rectangle2);
    scene.insertElement(arrow);

    bindLinearElement(arrow, rectangle1, "start", scene);
    bindLinearElement(arrow, rectangle2, "end", scene);

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);

    h.app.scene.mutateElement(arrow, {
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(90, 200)],
    });

    expect(arrow.points).toEqual([
      [0, 0],
      [45, 0],
      [45, 200],
      [90, 200],
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
    mouse.moveTo(-43, -99);
    mouse.click();
    mouse.moveTo(43, 99);
    mouse.click();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(arrow.type).toBe("arrow");
    expect(arrow.elbowed).toBe(true);
    expect(arrow.points).toEqual([
      [0, 0],
      [45, 0],
      [45, 200],
      [90, 200],
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
    mouse.moveTo(-43, -99);
    mouse.click();
    mouse.moveTo(43, 99);
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
      [35, 0],
      [35, 165],
      [103, 165],
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
    mouse.moveTo(-43, -99);
    mouse.click();
    mouse.moveTo(43, 99);
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
    expect(duplicatedArrow.points).toEqual([
      [0, 0],
      [45, 0],
      [45, 200],
      [90, 200],
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
    mouse.moveTo(-43, -99);
    mouse.click();
    mouse.moveTo(43, 99);
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
    expect(duplicatedArrow.points).toEqual([
      [0, 0],
      [0, 100],
      [90, 100],
      [90, 200],
    ]);
  });
});
