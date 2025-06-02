import React from "react";
import { vi } from "vitest";

import { ROUNDNESS, KEYS, arrayToMap, cloneJSON } from "@excalidraw/common";

import { pointFrom, type Radians } from "@excalidraw/math";

import { getBoundTextElementPosition } from "@excalidraw/element";
import { getElementAbsoluteCoords } from "@excalidraw/element";
import { newLinearElement } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  FileId,
} from "@excalidraw/element/types";

import { actionFlipHorizontal, actionFlipVertical } from "../actions";
import { createPasteEvent } from "../clipboard";
import { Excalidraw } from "../index";

// Importing to spy on it and mock the implementation (mocking does not work with simple vi.mock for some reason)
import * as blobModule from "../data/blob";

import { API } from "./helpers/api";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(() => {
  const generateIdSpy = vi.spyOn(blobModule, "generateIdFromFile");
  const resizeFileSpy = vi.spyOn(blobModule, "resizeImageFile");

  generateIdSpy.mockImplementation(() => Promise.resolve("fileId" as FileId));
  resizeFileSpy.mockImplementation((file: File) => Promise.resolve(file));
});

beforeEach(async () => {
  unmountComponent();

  mouse.reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();

  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
  await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
  API.setAppState({
    zoom: {
      value: 1 as NormalizedZoomValue,
    },
  });
});

const createAndSelectOneRectangle = (angle: number = 0) => {
  UI.createElement("rectangle", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneDiamond = (angle: number = 0) => {
  UI.createElement("diamond", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneEllipse = (angle: number = 0) => {
  UI.createElement("ellipse", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneArrow = (angle: number = 0) => {
  UI.createElement("arrow", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneLine = (angle: number = 0) => {
  UI.createElement("line", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndReturnOneDraw = (angle: number = 0) => {
  return UI.createElement("freedraw", {
    x: 0,
    y: 0,
    width: 50,
    height: 100,
    angle,
  });
};

const createLinearElementWithCurveInsideMinMaxPoints = (
  type: "line" | "arrow",
  extraProps: any = {},
) => {
  return newLinearElement({
    type,
    x: 2256.910668124894,
    y: -2412.5069664197654,
    width: 1750.4888916015625,
    height: 410.51605224609375,
    angle: 0 as Radians,
    strokeColor: "#000000",
    backgroundColor: "#fa5252",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    boundElements: null,
    link: null,
    locked: false,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(-922.4761962890625, 300.3277587890625),
      pointFrom<LocalPoint>(828.0126953125, 410.51605224609375),
    ],
  });
};

const createLinearElementsWithCurveOutsideMinMaxPoints = (
  type: "line" | "arrow",
  extraProps: any = {},
) => {
  return newLinearElement({
    type,
    x: -1388.6555370382996,
    y: 1037.698247710191,
    width: 591.2804897585779,
    height: 69.32871961377737,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    boundElements: null,
    link: null,
    locked: false,
    points: [
      [0, 0],
      [-584.1485186423079, -15.365636022723947],
      [-591.2804897585779, 36.09360810181511],
      [-148.56510566829502, 53.96308359105342],
    ],
    ...extraProps,
  });
};

const checkElementsBoundingBox = async (
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  toleranceInPx: number = 0,
) => {
  const elementsMap = arrayToMap([element1, element2]);
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element1, elementsMap);

  const [x12, y12, x22, y22] = getElementAbsoluteCoords(element2, elementsMap);

  await waitFor(() => {
    // Check if width and height did not change
    expect(x2 - x1).toBeCloseTo(x22 - x12, -1);
    expect(y2 - y1).toBeCloseTo(y22 - y12, -1);
  });
};

const checkHorizontalFlip = async (toleranceInPx: number = 0.00001) => {
  const originalElement = cloneJSON(h.elements[0]);
  API.executeAction(actionFlipHorizontal);
  const newElement = h.elements[0];
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkTwoPointsLineHorizontalFlip = async () => {
  const originalElement = cloneJSON(h.elements[0]) as ExcalidrawLinearElement;
  API.executeAction(actionFlipHorizontal);
  const newElement = h.elements[0] as ExcalidrawLinearElement;
  await waitFor(() => {
    expect(originalElement.points[0][0]).toBeCloseTo(
      -newElement.points[0][0],
      5,
    );
    expect(originalElement.points[0][1]).toBeCloseTo(
      newElement.points[0][1],
      5,
    );
    expect(originalElement.points[1][0]).toBeCloseTo(
      -newElement.points[1][0],
      5,
    );
    expect(originalElement.points[1][1]).toBeCloseTo(
      newElement.points[1][1],
      5,
    );
  });
};

const checkTwoPointsLineVerticalFlip = async () => {
  const originalElement = cloneJSON(h.elements[0]) as ExcalidrawLinearElement;
  API.executeAction(actionFlipVertical);
  const newElement = h.elements[0] as ExcalidrawLinearElement;
  await waitFor(() => {
    expect(originalElement.points[0][0]).toBeCloseTo(
      newElement.points[0][0],
      5,
    );
    expect(originalElement.points[0][1]).toBeCloseTo(
      -newElement.points[0][1],
      5,
    );
    expect(originalElement.points[1][0]).toBeCloseTo(
      newElement.points[1][0],
      5,
    );
    expect(originalElement.points[1][1]).toBeCloseTo(
      -newElement.points[1][1],
      5,
    );
  });
};

const checkRotatedHorizontalFlip = async (
  expectedAngle: number,
  toleranceInPx: number = 0.00001,
) => {
  const originalElement = cloneJSON(h.elements[0]);
  API.executeAction(actionFlipHorizontal);
  const newElement = h.elements[0];
  await waitFor(() => {
    expect(newElement.angle).toBeCloseTo(expectedAngle);
  });
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkRotatedVerticalFlip = async (
  expectedAngle: number,
  toleranceInPx: number = 0.00001,
) => {
  const originalElement = cloneJSON(h.elements[0]);
  API.executeAction(actionFlipVertical);
  const newElement = h.elements[0];
  await waitFor(() => {
    expect(newElement.angle).toBeCloseTo(expectedAngle);
  });
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkVerticalFlip = async (toleranceInPx: number = 0.00001) => {
  const originalElement = cloneJSON(h.elements[0]);

  API.executeAction(actionFlipVertical);

  const newElement = h.elements[0];
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkVerticalHorizontalFlip = async (toleranceInPx: number = 0.00001) => {
  const originalElement = cloneJSON(h.elements[0]);

  API.executeAction(actionFlipHorizontal);
  API.executeAction(actionFlipVertical);

  const newElement = h.elements[0];
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const TWO_POINTS_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS = 5;
const MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS = 20;

// Rectangle element
describe("rectangle", () => {
  it("flips an unrotated rectangle horizontally correctly", async () => {
    createAndSelectOneRectangle();
    await checkHorizontalFlip();
  });

  it("flips an unrotated rectangle vertically correctly", async () => {
    createAndSelectOneRectangle();

    await checkVerticalFlip();
  });

  it("flips a rotated rectangle horizontally correctly", async () => {
    const originalAngle = (3 * Math.PI) / 4;
    const expectedAngle = (5 * Math.PI) / 4;

    createAndSelectOneRectangle(originalAngle);

    await checkRotatedHorizontalFlip(expectedAngle);
  });

  it("flips a rotated rectangle vertically correctly", async () => {
    const originalAngle = (3 * Math.PI) / 4;
    const expectedAgnle = (5 * Math.PI) / 4;

    createAndSelectOneRectangle(originalAngle);

    await checkRotatedVerticalFlip(expectedAgnle);
  });
});

// Diamond element
describe("diamond", () => {
  it("flips an unrotated diamond horizontally correctly", async () => {
    createAndSelectOneDiamond();

    await checkHorizontalFlip();
  });

  it("flips an unrotated diamond vertically correctly", async () => {
    createAndSelectOneDiamond();

    await checkVerticalFlip();
  });

  it("flips a rotated diamond horizontally correctly", async () => {
    const originalAngle = (5 * Math.PI) / 4;
    const expectedAngle = (3 * Math.PI) / 4;

    createAndSelectOneDiamond(originalAngle);

    await checkRotatedHorizontalFlip(expectedAngle);
  });

  it("flips a rotated diamond vertically correctly", async () => {
    const originalAngle = (5 * Math.PI) / 4;
    const expectedAngle = (3 * Math.PI) / 4;

    createAndSelectOneDiamond(originalAngle);

    await checkRotatedVerticalFlip(expectedAngle);
  });
});

// Ellipse element
describe("ellipse", () => {
  it("flips an unrotated ellipse horizontally correctly", async () => {
    createAndSelectOneEllipse();

    await checkHorizontalFlip();
  });

  it("flips an unrotated ellipse vertically correctly", async () => {
    createAndSelectOneEllipse();

    await checkVerticalFlip();
  });

  it("flips a rotated ellipse horizontally correctly", async () => {
    const originalAngle = (7 * Math.PI) / 4;
    const expectedAngle = Math.PI / 4;

    createAndSelectOneEllipse(originalAngle);

    await checkRotatedHorizontalFlip(expectedAngle);
  });

  it("flips a rotated ellipse vertically correctly", async () => {
    const originalAngle = (7 * Math.PI) / 4;
    const expectedAngle = Math.PI / 4;

    createAndSelectOneEllipse(originalAngle);

    await checkRotatedVerticalFlip(expectedAngle);
  });
});

// Arrow element
describe("arrow", () => {
  it("flips an unrotated arrow horizontally with line inside min/max points bounds", async () => {
    const arrow = createLinearElementWithCurveInsideMinMaxPoints("arrow");
    API.setElements([arrow]);
    API.setAppState({ selectedElementIds: { [arrow.id]: true } });
    await checkHorizontalFlip(
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips an unrotated arrow vertically with line inside min/max points bounds", async () => {
    const arrow = createLinearElementWithCurveInsideMinMaxPoints("arrow");
    API.setElements([arrow]);
    API.setAppState({ selectedElementIds: { [arrow.id]: true } });

    await checkVerticalFlip(50);
  });

  it("flips a rotated arrow horizontally with line inside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementWithCurveInsideMinMaxPoints("arrow");
    API.setElements([line]);
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [line.id]: true,
      },
    });
    API.updateElement(line, {
      angle: originalAngle,
    });

    await checkRotatedHorizontalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips a rotated arrow vertically with line inside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementWithCurveInsideMinMaxPoints("arrow");
    API.setElements([line]);
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [line.id]: true,
      },
    });
    API.updateElement(line, {
      angle: originalAngle,
    });

    await checkRotatedVerticalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box!!!
  it.skip("flips an unrotated arrow horizontally with line outside min/max points bounds", async () => {
    const arrow = createLinearElementsWithCurveOutsideMinMaxPoints("arrow");
    API.setElements([arrow]);
    API.setAppState({ selectedElementIds: { [arrow.id]: true } });

    await checkHorizontalFlip(
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box!!!
  it.skip("flips a rotated arrow horizontally with line outside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementsWithCurveOutsideMinMaxPoints("arrow");
    API.updateElement(line, { angle: originalAngle });
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkRotatedVerticalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box!!!
  it.skip("flips an unrotated arrow vertically with line outside min/max points bounds", async () => {
    const arrow = createLinearElementsWithCurveOutsideMinMaxPoints("arrow");
    API.setElements([arrow]);
    API.setAppState({ selectedElementIds: { [arrow.id]: true } });

    await checkVerticalFlip(MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box!!!
  it.skip("flips a rotated arrow vertically with line outside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementsWithCurveOutsideMinMaxPoints("arrow");
    API.updateElement(line, { angle: originalAngle });
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkRotatedVerticalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips an unrotated arrow horizontally correctly", async () => {
    createAndSelectOneArrow();
    await checkHorizontalFlip(
      TWO_POINTS_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips an unrotated arrow vertically correctly", async () => {
    createAndSelectOneArrow();
    await checkVerticalFlip(TWO_POINTS_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
  });

  it("flips a two points arrow horizontally correctly", async () => {
    createAndSelectOneArrow();
    await checkTwoPointsLineHorizontalFlip();
  });

  it("flips a two points arrow vertically correctly", async () => {
    createAndSelectOneArrow();
    await checkTwoPointsLineVerticalFlip();
  });
});

// Line element
describe("line", () => {
  it("flips an unrotated line horizontally with line inside min/max points bounds", async () => {
    const line = createLinearElementWithCurveInsideMinMaxPoints("line");
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkHorizontalFlip(
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips an unrotated line vertically with line inside min/max points bounds", async () => {
    const line = createLinearElementWithCurveInsideMinMaxPoints("line");
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkVerticalFlip(MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
  });

  it("flips an unrotated line horizontally correctly", async () => {
    createAndSelectOneLine();
    await checkHorizontalFlip(
      TWO_POINTS_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });
  //TODO: elements with curve outside minMax points have a wrong bounding box
  it.skip("flips an unrotated line horizontally with line outside min/max points bounds", async () => {
    const line = createLinearElementsWithCurveOutsideMinMaxPoints("line");
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkHorizontalFlip(
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box
  it.skip("flips an unrotated line vertically with line outside min/max points bounds", async () => {
    const line = createLinearElementsWithCurveOutsideMinMaxPoints("line");
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkVerticalFlip(MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box
  it.skip("flips a rotated line horizontally with line outside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementsWithCurveOutsideMinMaxPoints("line");
    API.updateElement(line, { angle: originalAngle });
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkRotatedHorizontalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  //TODO: elements with curve outside minMax points have a wrong bounding box
  it.skip("flips a rotated line vertically with line outside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementsWithCurveOutsideMinMaxPoints("line");
    API.updateElement(line, { angle: originalAngle });
    API.setElements([line]);
    API.setAppState({ selectedElementIds: { [line.id]: true } });

    await checkRotatedVerticalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips an unrotated line vertically correctly", async () => {
    createAndSelectOneLine();
    await checkVerticalFlip(TWO_POINTS_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
  });

  it("flips a rotated line horizontally with line inside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementWithCurveInsideMinMaxPoints("line");
    API.setElements([line]);
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [line.id]: true,
      },
    });
    API.updateElement(line, {
      angle: originalAngle,
    });

    await checkRotatedHorizontalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips a rotated line vertically with line inside min/max points bounds", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    const line = createLinearElementWithCurveInsideMinMaxPoints("line");
    API.setElements([line]);
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [line.id]: true,
      },
    });
    API.updateElement(line, {
      angle: originalAngle,
    });

    await checkRotatedVerticalFlip(
      expectedAngle,
      MULTIPOINT_LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
    );
  });

  it("flips a two points line horizontally correctly", async () => {
    createAndSelectOneLine();
    await checkTwoPointsLineHorizontalFlip();
  });

  it("flips a two points line vertically correctly", async () => {
    createAndSelectOneLine();
    await checkTwoPointsLineVerticalFlip();
  });
});

// Draw element
describe("freedraw", () => {
  it("flips an unrotated drawing horizontally correctly", async () => {
    const draw = createAndReturnOneDraw();
    // select draw, since not done automatically
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [draw.id]: true,
      },
    });
    await checkHorizontalFlip();
  });

  it("flips an unrotated drawing vertically correctly", async () => {
    const draw = createAndReturnOneDraw();
    // select draw, since not done automatically
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [draw.id]: true,
      },
    });
    await checkVerticalFlip();
  });

  it("flips a rotated drawing horizontally correctly", async () => {
    const originalAngle = Math.PI / 4;
    const expectedAngle = (7 * Math.PI) / 4;

    const draw = createAndReturnOneDraw(originalAngle);
    // select draw, since not done automatically
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [draw.id]: true,
      },
    });

    await checkRotatedHorizontalFlip(expectedAngle);
  });

  it("flips a rotated drawing vertically correctly", async () => {
    const originalAngle = Math.PI / 4;
    const expectedAngle = (7 * Math.PI) / 4;

    const draw = createAndReturnOneDraw(originalAngle);
    // select draw, since not done automatically
    API.setAppState({
      selectedElementIds: {
        ...h.state.selectedElementIds,
        [draw.id]: true,
      },
    });

    await checkRotatedVerticalFlip(expectedAngle);
  });
});

//image
//TODO: currently there is no test for pixel colors at flipped positions.
describe("image", () => {
  const createImage = async () => {
    const sendPasteEvent = (file?: File) => {
      const clipboardEvent = createPasteEvent({ files: file ? [file] : [] });
      document.dispatchEvent(clipboardEvent);
    };

    sendPasteEvent(await API.loadFile("./fixtures/smiley_embedded_v2.png"));
  };

  it("flips an unrotated image horizontally correctly", async () => {
    //paste image
    await createImage();
    await waitFor(() => {
      expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, 1]);
      expect(API.getSelectedElements().length).toBeGreaterThan(0);
      expect(API.getSelectedElements()[0].type).toEqual("image");
      expect(h.app.files.fileId).toBeDefined();
    });
    await checkHorizontalFlip();
    expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([-1, 1]);
    expect(h.elements[0].angle).toBeCloseTo(0);
  });

  it("flips an unrotated image vertically correctly", async () => {
    //paste image
    await createImage();
    await waitFor(() => {
      expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, 1]);
      expect(API.getSelectedElements().length).toBeGreaterThan(0);
      expect(API.getSelectedElements()[0].type).toEqual("image");
      expect(h.app.files.fileId).toBeDefined();
    });

    await checkVerticalFlip();
    expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, -1]);
    expect(h.elements[0].angle).toBeCloseTo(0);
  });

  it("flips an rotated image horizontally correctly", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    //paste image
    await createImage();
    await waitFor(() => {
      expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, 1]);
      expect(API.getSelectedElements().length).toBeGreaterThan(0);
      expect(API.getSelectedElements()[0].type).toEqual("image");
      expect(h.app.files.fileId).toBeDefined();
    });
    API.updateElement(h.elements[0], {
      angle: originalAngle,
    });
    await checkRotatedHorizontalFlip(expectedAngle);
    expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([-1, 1]);
  });

  it("flips an rotated image vertically correctly", async () => {
    const originalAngle = (Math.PI / 4) as Radians;
    const expectedAngle = ((7 * Math.PI) / 4) as Radians;
    //paste image
    await createImage();
    await waitFor(() => {
      expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, 1]);
      expect(h.elements[0].angle).toEqual(0);
      expect(API.getSelectedElements().length).toBeGreaterThan(0);
      expect(API.getSelectedElements()[0].type).toEqual("image");
      expect(h.app.files.fileId).toBeDefined();
    });
    API.updateElement(h.elements[0], {
      angle: originalAngle,
    });

    await checkRotatedVerticalFlip(expectedAngle);
    expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, -1]);
    expect(h.elements[0].angle).toBeCloseTo(expectedAngle);
  });

  it("flips an image both vertically & horizontally", async () => {
    //paste image
    await createImage();
    await waitFor(() => {
      expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([1, 1]);
      expect(API.getSelectedElements().length).toBeGreaterThan(0);
      expect(API.getSelectedElements()[0].type).toEqual("image");
      expect(h.app.files.fileId).toBeDefined();
    });

    await checkVerticalHorizontalFlip();
    expect((h.elements[0] as ExcalidrawImageElement).scale).toEqual([-1, -1]);
    expect(h.elements[0].angle).toBeCloseTo(0);
  });
});

describe("mutliple elements", () => {
  it("with bound text flip correctly", async () => {
    UI.clickTool("arrow");
    fireEvent.click(screen.getByTitle("Architect"));
    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    });

    Keyboard.keyPress(KEYS.ENTER);
    let editor = document.querySelector<HTMLTextAreaElement>(
      ".excalidraw-textEditorContainer > textarea",
    )!;
    fireEvent.input(editor, { target: { value: "arrow" } });
    Keyboard.exitTextEditor(editor);

    const rectangle = UI.createElement("rectangle", {
      x: 0,
      y: 100,
      width: 100,
      height: 100,
    });

    Keyboard.keyPress(KEYS.ENTER);
    editor = document.querySelector<HTMLTextAreaElement>(
      ".excalidraw-textEditorContainer > textarea",
    )!;
    fireEvent.input(editor, { target: { value: "rect\ntext" } });
    Keyboard.exitTextEditor(editor);

    mouse.select([arrow, rectangle]);
    API.executeAction(actionFlipHorizontal);
    API.executeAction(actionFlipVertical);

    const arrowText = h.elements[1] as ExcalidrawTextElementWithContainer;
    const arrowTextPos = getBoundTextElementPosition(
      arrow.get(),
      arrowText,
      arrayToMap(h.elements),
    )!;
    const rectText = h.elements[3] as ExcalidrawTextElementWithContainer;

    expect(arrow.x).toBeCloseTo(180);
    expect(arrow.y).toBeCloseTo(200);
    expect(arrow.points[1][0]).toBeCloseTo(-180);
    expect(arrow.points[1][1]).toBeCloseTo(-80);

    expect(arrowTextPos.x - (arrow.x - arrow.width)).toBeCloseTo(
      arrow.x - (arrowTextPos.x + arrowText.width),
    );
    expect(arrowTextPos.y - (arrow.y - arrow.height)).toBeCloseTo(
      arrow.y - (arrowTextPos.y + arrowText.height),
    );

    expect(rectangle.x).toBeCloseTo(80);
    expect(rectangle.y).toBeCloseTo(0);

    expect(rectText.x - rectangle.x).toBeCloseTo(
      rectangle.x + rectangle.width - (rectText.x + rectText.width),
    );
    expect(rectText.y - rectangle.y).toBeCloseTo(
      rectangle.y + rectangle.height - (rectText.y + rectText.height),
    );
  });
});
