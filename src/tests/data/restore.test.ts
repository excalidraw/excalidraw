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

const mockSizeHelper = jest.spyOn(sizeHelpers, "isInvisiblySmallElement");

beforeEach(() => {
  mockSizeHelper.mockReset();
});

describe("restoreElements", () => {
  it("should return empty array when element is null", () => {
    expect(restore.restoreElements(null)).toStrictEqual([]);
  });

  it("should not call isInvisiblySmallElement when element is a selection element", () => {
    const selectionEl = { type: "selection" } as ExcalidrawElement;
    const restoreElements = restore.restoreElements([selectionEl]);
    expect(restoreElements.length).toBe(0);
    expect(sizeHelpers.isInvisiblySmallElement).toBeCalledTimes(0);
  });

  it("should return empty array when input type is not supported", () => {
    const dummyNotSupportedElement: any = API.createElement({
      type: "text",
    });

    dummyNotSupportedElement.type = "not supported";
    expect(restore.restoreElements([dummyNotSupportedElement]).length).toBe(0);
  });

  it("should return empty array when isInvisiblySmallElement is true", () => {
    const rectElement = API.createElement({ type: "rectangle" });
    mockSizeHelper.mockImplementation(() => true);

    expect(restore.restoreElements([rectElement]).length).toBe(0);
  });

  it("should restore text element correctly passing value for each attribute", () => {
    const textElement = API.createElement({
      type: "text",
      fontSize: 14,
      fontFamily: 1,
      text: "text",
      textAlign: "center",
      verticalAlign: "middle",
      id: "id-text01",
    });

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;

    expect(restoredText).toMatchSnapshot({
      seed: expect.any(Number),
    });
  });

  it("should restore text element correctly with unknown font family, null text and undefined alignment", () => {
    const textElement: any = API.createElement({
      type: "text",
      textAlign: undefined,
      verticalAlign: undefined,
      id: "id-text01",
    });

    textElement.text = null;
    textElement.font = "10 unknown";

    const restoredText = restore.restoreElements([
      textElement,
    ])[0] as ExcalidrawTextElement;
    expect(restoredText).toMatchSnapshot({
      seed: expect.any(Number),
    });
  });

  it("should restore freedraw element correctly", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      id: "id-freedraw01",
    });

    const restoredFreedraw = restore.restoreElements([
      freedrawElement,
    ])[0] as ExcalidrawFreeDrawElement;

    expect(restoredFreedraw).toMatchSnapshot({ seed: expect.any(Number) });
  });

  it("should restore line and draw elements correctly", () => {
    const lineElement = API.createElement({ type: "line", id: "id-line01" });

    const drawElement: any = API.createElement({
      type: "line",
      id: "id-draw01",
    });
    drawElement.type = "draw";

    const restoredElements = restore.restoreElements([
      lineElement,
      drawElement,
    ]);

    const restoredLine = restoredElements[0] as ExcalidrawLinearElement;
    const restoredDraw = restoredElements[1] as ExcalidrawLinearElement;

    expect(restoredLine).toMatchSnapshot({ seed: expect.any(Number) });
    expect(restoredDraw).toMatchSnapshot({ seed: expect.any(Number) });
  });

  it("should restore arrow element correctly", () => {
    const arrowElement = API.createElement({ type: "arrow", id: "id-arrow01" });

    const restoredElements = restore.restoreElements([arrowElement]);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(restoredArrow).toMatchSnapshot({ seed: expect.any(Number) });
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
    const lineElement: any = API.createElement({
      type: "line",
      width: 100,
      height: 200,
    });

    lineElement.points = "not an array";

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

  it("should restore correctly with rectangle, ellipse and diamond elements", () => {
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

    const restoredElements = restore.restoreElements(elements);

    expect(restoredElements[0]).toMatchSnapshot({ seed: expect.any(Number) });
    expect(restoredElements[1]).toMatchSnapshot({ seed: expect.any(Number) });
    expect(restoredElements[2]).toMatchSnapshot({ seed: expect.any(Number) });
  });
});

describe("restoreAppState", () => {
  it("should restore with imported data", () => {
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

  it("should restore with current app state when imported data state is undefined", () => {
    const stubImportedAppState = {
      ...getDefaultAppState(),
      cursorButton: undefined,
      name: undefined,
    };

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

  it("should return imported data when local app state is null", () => {
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

  it("should return local app state when imported data state is null", () => {
    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(null, stubLocalAppState);
    expect(restoredAppState.cursorButton).toBe(stubLocalAppState.cursorButton);
    expect(restoredAppState.name).toBe(stubLocalAppState.name);
  });

  it("should return default app state when imported data state and local app state are undefined", () => {
    const stubImportedAppState = {
      ...getDefaultAppState(),
      cursorButton: undefined,
    };

    const stubLocalAppState = {
      ...getDefaultAppState(),
      cursorButton: undefined,
    };

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

  it("when imported data state has a not allowed Excalidraw Element Types", () => {
    const stubImportedAppState: any = getDefaultAppState();

    stubImportedAppState.elementType = "not allowed Excalidraw Element Types";
    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.elementType).toBe("selection");
  });

  describe("with zoom in imported data state", () => {
    it("when imported data state has zoom as a number", () => {
      const stubImportedAppState: any = getDefaultAppState();

      stubImportedAppState.zoom = 10;

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
