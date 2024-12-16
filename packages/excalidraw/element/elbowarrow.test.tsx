import React from "react";
import Scene from "../scene/Scene";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  queryByTestId,
  render,
} from "../tests/test-utils";
import { bindLinearElement } from "./binding";
import { Excalidraw, mutateElement } from "../index";
import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
} from "./types";
import { ARROW_TYPE } from "../constants";
import type { LocalPoint } from "../../math";
import { pointFrom } from "../../math";

const { h } = window;

const mouse = new Pointer("mouse");

// const expectPointsToBeCloseTo = (
//   received: readonly LocalPoint[],
//   expected: number[][],
//   precision?: number,
// ) => {
//   expect(received.length).toBe(expected.length);
//   received.forEach((point, index) => {
//     expect(point[0]).toBeCloseTo(expected[index][0], precision);
//     expect(point[1]).toBeCloseTo(expected[index][1], precision);
//   });
// };

describe("elbow arrow routing", () => {
  it("can properly generate orthogonal arrow points", () => {
    const scene = new Scene();
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
    }) as ExcalidrawElbowArrowElement;
    scene.insertElement(arrow);
    mutateElement(arrow, {
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
    const elementsMap = scene.getNonDeletedElementsMap();
    bindLinearElement(arrow, rectangle1, "start", elementsMap);
    bindLinearElement(arrow, rectangle2, "end", elementsMap);

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);

    mutateElement(arrow, {
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
      [35, 90],
      [35, 90],
      [35, 165],
      [103, 165],
    ]);
  });
});

describe("elbow arrow segment move", () => {
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

  it("can move the second segment of an unconnected elbow arrow", () => {
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
    mouse.moveTo(105, 100);
    mouse.up();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, -2],
      [100, -2],
      [100, 200],
      [200, 200],
    ]);

    mouse.reset();
    mouse.moveTo(105, 74.275);
    mouse.doubleClick();

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [0, -2],
      [100, -2],
      [100, 200],
      [200, 200],
    ]);
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
    mouse.moveTo(105, 100);
    mouse.up();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawArrowElement;

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [100, 0],
      [100, 200],
      [190, 200],
    ]);

    mouse.reset();
    mouse.moveTo(105, 74.275);
    mouse.doubleClick();

    expect(arrow.points).toCloselyEqualPoints([
      [0, 0],
      [100, 0],
      [100, 200],
      [190, 200],
    ]);
  });
});
