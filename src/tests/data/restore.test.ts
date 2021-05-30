import * as restore from "../../data/restore";
import {
  ExcalidrawTextElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawElement,
} from "../../element/types";
import * as sizeHelpers from "../../element/sizeHelpers";
import { API } from "../helpers/api";
import { getDefaultAppState } from "../../appState";
import { ImportedDataState } from "../../data/types";
import { NormalizedZoomValue } from "../../types";
import {
  FONT_FAMILY,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
} from "../../constants";

const mockSizeHelper = jest.spyOn(sizeHelpers, "isInvisiblySmallElement");

beforeEach(() => {
  mockSizeHelper.mockReset();
});

describe("restoreElements", () => {
  it("with null array of elements", () => {
    expect(restore.restoreElements(null)).toStrictEqual([]);
  });

  it("should not call isInvisiblySmallElement when input element is a selection element", () => {
    const selectionEl = { type: "selection" } as ExcalidrawElement;
    const restoreElements = restore.restoreElements([selectionEl]);
    expect(restoreElements.length).toBe(0);
    expect(sizeHelpers.isInvisiblySmallElement).toBeCalledTimes(0);
  });

  it("when input element type is not supported", () => {
    const dummyNotSupportedElement = API.createElement({ type: "text" });

    Object.defineProperty(dummyNotSupportedElement, "type", {
      get: jest.fn(() => "not supported element type"),
    });

    expect(restore.restoreElements([dummyNotSupportedElement]).length).toBe(0);
  });

  it("when isInvisiblySmallElement is true", () => {
    const rectElement = API.createElement({ type: "rectangle" });
    mockSizeHelper.mockImplementation(() => true);

    expect(restore.restoreElements([rectElement]).length).toBe(0);
  });

  it("with text element type", () => {
    const textElement = API.createElement({
      type: "text",
      fontSize: 14,
      fontFamily: 1,
      text: "text",
      textAlign: "center",
      verticalAlign: "middle",
    });

    const expectedTextElement = {
      type: textElement.type,
      fontSize: textElement.fontSize,
      fontFamily: textElement.fontFamily,
      text: textElement.text,
      baseline: textElement.baseline,
      textAlign: textElement.textAlign,
      verticalAlign: textElement.verticalAlign,
    };

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;

    const gotRestoredTextElement = {
      type: restoredText.type,
      fontSize: restoredText.fontSize,
      fontFamily: restoredText.fontFamily,
      text: restoredText.text,
      baseline: restoredText.baseline,
      textAlign: restoredText.textAlign,
      verticalAlign: restoredText.verticalAlign,
    };

    expect(gotRestoredTextElement).toMatchObject(expectedTextElement);
  });

  it("when text element has null text", () => {
    const textElement = API.createElement({ type: "text" });

    Object.defineProperty(textElement, "text", {
      get: jest.fn(() => null),
    });

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;
    expect(restoredText.text).toBe("");
  });

  it("when text element has undefined alignment", () => {
    const textElement = API.createElement({
      type: "text",
      textAlign: undefined,
      verticalAlign: undefined,
    });

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;

    expect(restoredText.textAlign).toBe(DEFAULT_TEXT_ALIGN);
    expect(restoredText.verticalAlign).toBe(DEFAULT_VERTICAL_ALIGN);
  });

  it("when text element has font property", () => {
    const textElement = API.createElement({
      type: "text",
      fontSize: 14,
      fontFamily: 1,
    });

    const fontPx = 10;
    const fontFamilyName = FONT_FAMILY[3];

    Object.defineProperty(textElement, "font", {
      get: jest.fn(() => `${fontPx} ${fontFamilyName}`),
    });

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;
    expect(restoredText.fontSize).toBe(fontPx);
    expect(restoredText.fontFamily).toBe(3);
  });

  it("when text element has font property but unknown font family name", () => {
    const textElement = API.createElement({
      type: "text",
      fontSize: 14,
      fontFamily: 1,
    });

    const fontPx = 10;
    const fontFamilyName = "unknown font family name";

    Object.defineProperty(textElement, "font", {
      get: jest.fn(() => `${fontPx} ${fontFamilyName}`),
    });

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;
    expect(restoredText.fontSize).toBe(fontPx);
    expect(restoredText.fontFamily).toBe(DEFAULT_FONT_FAMILY);
  });

  it("with freedraw element", () => {
    const freedrawElement = API.createElement({ type: "freedraw" });

    const expectedFreedrawElement = {
      type: freedrawElement.type,
      points: freedrawElement.points,
      lastCommittedPoint: null,
      simulatePressure: freedrawElement.simulatePressure,
      pressures: freedrawElement.pressures,
    };

    const restoredFreedraw = restore.restoreElements([
      freedrawElement,
    ])[0] as ExcalidrawFreeDrawElement;

    const gotRestoredFreedrawElement = {
      type: restoredFreedraw.type,
      points: restoredFreedraw.points,
      lastCommittedPoint: null,
      simulatePressure: restoredFreedraw.simulatePressure,
      pressures: restoredFreedraw.pressures,
    };

    expect(gotRestoredFreedrawElement).toMatchObject(expectedFreedrawElement);
  });

  it("with line and draw elements", () => {
    const lineElement = API.createElement({ type: "line" });

    const drawElement = API.createElement({ type: "line" });
    Object.defineProperty(drawElement, "type", {
      get: jest.fn(() => "draw"),
    });

    const expectedRestoredLineElement = {
      type: lineElement.type,
      startBinding: lineElement.startBinding,
      endBinding: lineElement.endBinding,
      lastCommittedPoint: null,
      startArrowhead: null,
      endArrowhead: null,
    };

    const expectedRestoredDrawElement = expectedRestoredLineElement;

    const restoredElements = restore.restoreElements([
      lineElement,
      drawElement,
    ]);

    const restoredLine = restoredElements[0] as ExcalidrawLinearElement;
    const restoredDraw = restoredElements[1] as ExcalidrawLinearElement;

    const gotRestoredLineElement = {
      type: restoredLine.type,
      startBinding: restoredLine.startBinding,
      endBinding: restoredLine.endBinding,
      lastCommittedPoint: restoredLine.lastCommittedPoint,
      startArrowhead: restoredLine.startArrowhead,
      endArrowhead: restoredLine.endArrowhead,
    };

    const gotRestoredDrawElement = {
      type: restoredDraw.type,
      startBinding: restoredDraw.startBinding,
      endBinding: restoredDraw.endBinding,
      lastCommittedPoint: restoredDraw.lastCommittedPoint,
      startArrowhead: restoredDraw.startArrowhead,
      endArrowhead: restoredDraw.endArrowhead,
    };

    expect(gotRestoredLineElement).toMatchObject(expectedRestoredLineElement);
    expect(gotRestoredDrawElement).toMatchObject(expectedRestoredDrawElement);
  });

  it("with arrow element", () => {
    const arrowElement = API.createElement({ type: "arrow" });

    const expectedRestoredArrowElement = {
      type: arrowElement.type,
      startBinding: arrowElement.startBinding,
      endBinding: arrowElement.endBinding,
      lastCommittedPoint: null,
      startArrowhead: null,
    };

    const restoredElements = restore.restoreElements([arrowElement]);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    const gotRestoredArrowElement = {
      type: restoredArrow.type,
      startBinding: restoredArrow.startBinding,
      endBinding: restoredArrow.endBinding,
      lastCommittedPoint: restoredArrow.lastCommittedPoint,
      startArrowhead: restoredArrow.startArrowhead,
    };

    expect(gotRestoredArrowElement).toMatchObject(expectedRestoredArrowElement);
  });

  it("when arrow element has defined endArrowHead", () => {
    const arrowElement = API.createElement({ type: "arrow" });

    const restoredElements = restore.restoreElements([arrowElement]);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(arrowElement.endArrowhead).toBe(restoredArrow.endArrowhead);
  });

  it("when arrow element has undefined endArrowHead", () => {
    const arrowElement = API.createElement({ type: "arrow" });
    Object.defineProperty(arrowElement, "endArrowhead", {
      get: jest.fn(() => undefined),
    });

    const restoredElements = restore.restoreElements([arrowElement]);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(restoredArrow.endArrowhead).toBe("arrow");
  });

  it("when element.points of a line element is not an array", () => {
    const lineElement = API.createElement({
      type: "line",
      width: 100,
      height: 200,
    });

    Object.defineProperty(lineElement, "points", {
      get: jest.fn(() => "not an array"),
    });

    const expectedLinePoints = [
      [0, 0],
      [lineElement.width, lineElement.height],
    ];

    const restoredLine = restore.restoreElements([
      lineElement,
    ])[0] as ExcalidrawLinearElement;

    expect(restoredLine.points).toMatchObject(expectedLinePoints);
  });

  it("when the number of points of a line is greater or equal 2", () => {
    const lineElement_0 = API.createElement({
      type: "line",
      width: 100,
      height: 200,
      x: 10,
      y: 20,
    });
    const lineElement_1 = API.createElement({
      type: "line",
      width: 200,
      height: 400,
      x: 30,
      y: 40,
    });

    const pointsEl_0 = [
      [0, 0],
      [1, 1],
    ];
    Object.defineProperty(lineElement_0, "points", {
      get: jest.fn(() => pointsEl_0),
    });

    const pointsEl_1 = [
      [3, 4],
      [5, 6],
    ];
    Object.defineProperty(lineElement_1, "points", {
      get: jest.fn(() => pointsEl_1),
    });

    const restoredElements = restore.restoreElements([
      lineElement_0,
      lineElement_1,
    ]);

    const restoredLine_0 = restoredElements[0] as ExcalidrawLinearElement;
    const restoredLine_1 = restoredElements[1] as ExcalidrawLinearElement;

    expect(restoredLine_0.points).toMatchObject(pointsEl_0);

    const offsetX = pointsEl_1[0][0];
    const offsetY = pointsEl_1[0][1];
    const restoredPointsEl1 = [
      [pointsEl_1[0][0] - offsetX, pointsEl_1[0][1] - offsetY],
      [pointsEl_1[1][0] - offsetX, pointsEl_1[1][1] - offsetY],
    ];
    expect(restoredLine_1.points).toMatchObject(restoredPointsEl1);
    expect(restoredLine_1.x).toBe(lineElement_1.x + offsetX);
    expect(restoredLine_1.y).toBe(lineElement_1.y + offsetY);
  });

  it("with rectangle, ellipse and diamond elements", () => {
    const types = ["rectangle", "ellipse", "diamond"];

    const elements: ExcalidrawElement[] = [];
    let idCount = 0;
    types.forEach((elType) => {
      idCount += 1;
      const element = API.createElement({
        type: elType as "rectangle" | "ellipse" | "diamond",
        id: idCount.toString(),
        fillStyle: "cross-hatch",
        strokeWidth: 2,
        strokeStyle: "dashed",
        roughness: 2,
        opacity: 10,
        x: 10,
        y: 20,
        strokeColor: "red",
        backgroundColor: "blue",
        width: 100,
        height: 200,
        groupIds: ["1", "2", "3"],
        strokeSharpness: "round",
      });

      elements.push(element);
    });

    const expectedRestoredElement = {
      type: "",
      id: "",
      fillStyle: "cross-hatch",
      strokeWidth: 2,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 10,
      angle: 0,
      x: 10,
      y: 20,
      strokeColor: "red",
      backgroundColor: "blue",
      width: 100,
      height: 200,
      seed: 0,
      groupIds: ["1", "2", "3"],
      strokeSharpness: "round",
      version: 1,
      versionNonce: 0,
      isDeleted: false,
    };

    const expectedRestoredRect = Object.assign({}, expectedRestoredElement);
    expectedRestoredRect.type = elements[0].type;
    expectedRestoredRect.id = elements[0].id;
    expectedRestoredRect.seed = elements[0].seed;

    const expectedRestoredEllipse = Object.assign({}, expectedRestoredElement);
    expectedRestoredEllipse.type = elements[1].type;
    expectedRestoredEllipse.id = elements[1].id;
    expectedRestoredEllipse.seed = elements[1].seed;

    const expectedRestoredDiamond = Object.assign({}, expectedRestoredElement);
    expectedRestoredDiamond.type = elements[2].type;
    expectedRestoredDiamond.id = elements[2].id;
    expectedRestoredDiamond.seed = elements[2].seed;

    const restoredElements = restore.restoreElements(elements);

    expect(restoredElements[0]).toMatchObject(expectedRestoredRect);
    expect(restoredElements[1]).toMatchObject(expectedRestoredEllipse);
    expect(restoredElements[2]).toMatchObject(expectedRestoredDiamond);
  });

  it("with rectangle element", () => {
    const rectElement = API.createElement({
      type: "rectangle",
      id: "1",
      fillStyle: "cross-hatch",
      strokeWidth: 2,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 10,
      x: 10,
      y: 20,
      strokeColor: "red",
      backgroundColor: "blue",
      width: 100,
      height: 200,
      groupIds: ["1", "2", "3"],
      strokeSharpness: "round",
    });

    const restoredRect = restore.restoreElements([rectElement])[0];

    const expectedRestoredRect = {
      type: "rectangle",
      id: "1",
      fillStyle: "cross-hatch",
      strokeWidth: 2,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 10,
      angle: 0,
      x: 10,
      y: 20,
      strokeColor: "red",
      backgroundColor: "blue",
      width: 100,
      height: 200,
      seed: rectElement.seed,
      groupIds: ["1", "2", "3"],
      strokeSharpness: "round",
      version: 1,
      versionNonce: 0,
      isDeleted: false,
    };

    expect(restoredRect.x).toBe(10);
    expect(restoredRect).toMatchObject(expectedRestoredRect);
  });
});

describe("restoreAppState", () => {
  it("with imported data", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.elementType = "selection";
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.elementType = "rectangle";
    stubLocalAppState.cursorButton = "up";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.elementType).toBe(stubImportedAppState.elementType);
    expect(restoredAppState.cursorButton).toBe(
      stubImportedAppState.cursorButton,
    );
    expect(restoredAppState.name).toBe(stubImportedAppState.name);
  });

  it("should return current app state when imported data state is undefined", () => {
    const stubImportedAppState = getDefaultAppState();

    Object.defineProperty(stubImportedAppState, "cursorButton", {
      get: jest.fn(() => undefined),
    });

    Object.defineProperty(stubImportedAppState, "name", {
      get: jest.fn(() => undefined),
    });

    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.cursorButton).toBe(stubLocalAppState.cursorButton);
    expect(restoredAppState.name).toBe(stubLocalAppState.name);
  });

  it("when imported data is supplied but local app state is null", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      null,
    );
    expect(restoredAppState.cursorButton).toBe(
      stubImportedAppState.cursorButton,
    );
    expect(restoredAppState.name).toBe(stubImportedAppState.name);
  });

  it("when imported data state is null", () => {
    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(null, stubLocalAppState);
    expect(restoredAppState.cursorButton).toBe(stubLocalAppState.cursorButton);
    expect(restoredAppState.name).toBe(stubLocalAppState.name);
  });

  it("should return default app state when imported data state and local app state are undefined", () => {
    const stubImportedAppState = getDefaultAppState();

    Object.defineProperty(stubImportedAppState, "cursorButton", {
      get: jest.fn(() => undefined),
    });

    const stubLocalAppState = getDefaultAppState();
    Object.defineProperty(stubLocalAppState, "cursorButton", {
      get: jest.fn(() => undefined),
    });

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.cursorButton).toBe(
      getDefaultAppState().cursorButton,
    );
  });

  it("should return default app state when imported data state and local app state are null", () => {
    const restoredAppState = restore.restoreAppState(null, null);
    expect(restoredAppState.cursorButton).toBe(
      getDefaultAppState().cursorButton,
    );
  });

  it("when imported data state has a not AllowedExcalidrawElementTypes", () => {
    const stubImportedAppState = getDefaultAppState();

    Object.defineProperty(stubImportedAppState, "elementType", {
      get: jest.fn(() => "not Allowed element"),
    });

    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.elementType).toBe("selection");
  });

  it("when imported data state has zoom as a number", () => {
    const stubImportedAppState = getDefaultAppState();

    Object.defineProperty(stubImportedAppState, "zoom", {
      get: jest.fn(() => 10),
    });

    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );

    expect(restoredAppState.zoom.value).toBe(10);
    expect(restoredAppState.zoom.translation).toMatchObject(
      getDefaultAppState().zoom.translation,
    );
  });

  it("when the zoom of imported data state is not a number", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.zoom = {
      value: 10 as NormalizedZoomValue,
      translation: { x: 5, y: 3 },
    };

    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );

    expect(restoredAppState.zoom.value).toBe(10);
    expect(restoredAppState.zoom).toMatchObject(stubImportedAppState.zoom);
  });

  it("when the zoom of imported data state zoom is null", () => {
    const stubImportedAppState = getDefaultAppState();

    Object.defineProperty(stubImportedAppState, "zoom", {
      get: jest.fn(() => null),
    });

    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );

    expect(restoredAppState.zoom).toMatchObject(getDefaultAppState().zoom);
  });
});

describe("restore", () => {
  it("when imported data state is null it should return an empty array of elements", () => {
    const stubLocalAppState = getDefaultAppState();

    const restoredData = restore.restore(null, stubLocalAppState);
    expect(restoredData.elements.length).toBe(0);
  });

  it("when imported data state is null it should return the local app state property", () => {
    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredData = restore.restore(null, stubLocalAppState);
    expect(restoredData.appState.cursorButton).toBe(
      stubLocalAppState.cursorButton,
    );
    expect(restoredData.appState.name).toBe(stubLocalAppState.name);
  });

  it("when imported data state has elements", () => {
    const stubLocalAppState = getDefaultAppState();

    const textElement = API.createElement({ type: "text" });
    const rectElement = API.createElement({ type: "rectangle" });
    const elements = [textElement, rectElement];

    const importedDataState = {} as ImportedDataState;
    importedDataState.elements = elements;

    const restoredData = restore.restore(importedDataState, stubLocalAppState);
    expect(restoredData.elements.length).toBe(elements.length);
  });

  it("when local app state is null but imported app state is supplied", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const importedDataState = {} as ImportedDataState;
    importedDataState.appState = stubImportedAppState;

    const restoredData = restore.restore(importedDataState, null);
    expect(restoredData.appState.cursorButton).toBe(
      stubImportedAppState.cursorButton,
    );
    expect(restoredData.appState.name).toBe(stubImportedAppState.name);
  });
});
