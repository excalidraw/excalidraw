import { pointFrom } from "@excalidraw/math";
import { vi } from "vitest";

import { DEFAULT_SIDEBAR, FONT_FAMILY, ROUNDNESS } from "@excalidraw/common";

import { newElementWith } from "@excalidraw/element";
import * as sizeHelpers from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import { API } from "../helpers/api";
import * as restore from "../../data/restore";
import { getDefaultAppState } from "../../appState";

import type { ImportedDataState } from "../../data/types";

describe("restoreElements", () => {
  const mockSizeHelper = vi.spyOn(sizeHelpers, "isInvisiblySmallElement");

  beforeEach(() => {
    mockSizeHelper.mockReset();
  });

  afterAll(() => {
    mockSizeHelper.mockRestore();
  });

  it("should return empty array when element is null", () => {
    expect(restore.restoreElements(null, null)).toStrictEqual([]);
  });

  it("should not call isInvisiblySmallElement when element is a selection element", () => {
    const selectionEl = { type: "selection" } as ExcalidrawElement;
    const restoreElements = restore.restoreElements([selectionEl], null);
    expect(restoreElements.length).toBe(0);
    expect(sizeHelpers.isInvisiblySmallElement).toBeCalledTimes(0);
  });

  it("should return empty array when input type is not supported", () => {
    const dummyNotSupportedElement: any = API.createElement({
      type: "text",
    });

    dummyNotSupportedElement.type = "not supported";
    expect(
      restore.restoreElements([dummyNotSupportedElement], null).length,
    ).toBe(0);
  });

  it("should return empty array when isInvisiblySmallElement is true", () => {
    const rectElement = API.createElement({ type: "rectangle" });
    mockSizeHelper.mockImplementation(() => true);

    expect(
      restore.restoreElements([rectElement], null, {
        deleteInvisibleElements: true,
      }),
    ).toEqual([expect.objectContaining({ isDeleted: true })]);
  });

  it("should restore text element correctly passing value for each attribute", () => {
    const textElement = API.createElement({
      type: "text",
      fontSize: 14,
      fontFamily: FONT_FAMILY.Virgil,
      text: "text",
      textAlign: "center",
      verticalAlign: "middle",
      id: "id-text01",
    });

    const restoredText = restore.restoreElements(
      [textElement],
      null,
    )[0] as ExcalidrawTextElement;

    expect(restoredText).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should not delete empty text element when opts.deleteInvisibleElements is not defined", () => {
    const textElement = API.createElement({
      type: "text",
      text: "",
      isDeleted: false,
    });

    const restoredElements = restore.restoreElements([textElement], null);

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: textElement.id,
        isDeleted: false,
      }),
    ]);
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

    expect(textElement.isDeleted).toBe(false);
    const restoredText = restore.restoreElements([textElement], null, {
      deleteInvisibleElements: true,
    })[0] as ExcalidrawTextElement;
    expect(restoredText.isDeleted).toBe(true);
    expect(restoredText).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should restore freedraw element correctly", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      id: "id-freedraw01",
      points: [pointFrom(0, 0), pointFrom(10, 10)],
    });

    const restoredFreedraw = restore.restoreElements(
      [freedrawElement],
      null,
    )[0] as ExcalidrawFreeDrawElement;

    expect(restoredFreedraw).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should restore line and draw elements correctly", () => {
    const lineElement = API.createElement({ type: "line", id: "id-line01" });

    const drawElement: any = API.createElement({
      type: "line",
      id: "id-draw01",
    });
    drawElement.type = "draw";

    const restoredElements = restore.restoreElements(
      [lineElement, drawElement],
      null,
    );

    const restoredLine = restoredElements[0] as ExcalidrawLinearElement;
    const restoredDraw = restoredElements[1] as ExcalidrawLinearElement;

    expect(restoredLine).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(restoredDraw).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should restore arrow element correctly", () => {
    const arrowElement = API.createElement({ type: "arrow", id: "id-arrow01" });

    const restoredElements = restore.restoreElements([arrowElement], null);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(restoredArrow).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should remove imperceptibly small elements", () => {
    const arrowElement = API.createElement({
      type: "arrow",
      points: [
        [0, 0],
        [0.02, 0.05],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });

    const restoredElements = restore.restoreElements([arrowElement], null, {
      deleteInvisibleElements: true,
    });

    const restoredArrow = restoredElements[0] as
      | ExcalidrawArrowElement
      | undefined;

    expect(restoredArrow).not.toBeUndefined();
    expect(restoredArrow?.isDeleted).toBe(true);
  });

  it("should keep 'imperceptibly' small freedraw/line elements", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      points: [
        [0, 0],
        [0.0001, 0.0001],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });
    const lineElement = API.createElement({
      type: "line",
      points: [
        [0, 0],
        [0.0001, 0.0001],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });

    const restoredElements = restore.restoreElements(
      [freedrawElement, lineElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({ id: freedrawElement.id }),
      expect.objectContaining({ id: lineElement.id }),
    ]);
  });

  it("should restore loop linears correctly", () => {
    const linearElement = API.createElement({
      type: "line",
      points: [
        [0, 0],
        [100, 100],
        [100, 200],
        [0, 0],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });
    const arrowElement = API.createElement({
      type: "arrow",
      points: [
        [0, 0],
        [100, 100],
        [100, 200],
        [0, 0],
      ] as LocalPoint[],
      x: 500,
      y: 500,
    });

    const restoredElements = restore.restoreElements(
      [linearElement, arrowElement],
      null,
    );

    const restoredLinear = restoredElements[0] as
      | ExcalidrawLinearElement
      | undefined;
    const restoredArrow = restoredElements[1] as
      | ExcalidrawArrowElement
      | undefined;

    expect(restoredLinear?.type).toBe("line");
    expect(restoredLinear?.points).toEqual([
      [0, 0],
      [100, 100],
      [100, 200],
      [0, 0],
    ] as LocalPoint[]);
    expect(restoredArrow?.type).toBe("arrow");
    expect(restoredArrow?.points).toEqual([
      [0, 0],
      [100, 100],
      [100, 200],
      [0, 0],
    ] as LocalPoint[]);
  });

  it('should set arrow element endArrowHead as "arrow" when arrow element endArrowHead is null', () => {
    const arrowElement = API.createElement({ type: "arrow" });
    const restoredElements = restore.restoreElements([arrowElement], null);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(arrowElement.endArrowhead).toBe(restoredArrow.endArrowhead);
  });

  it('should set arrow element endArrowHead as "arrow" when arrow element endArrowHead is undefined', () => {
    const arrowElement = API.createElement({ type: "arrow" });
    Object.defineProperty(arrowElement, "endArrowhead", {
      get: vi.fn(() => undefined),
    });

    const restoredElements = restore.restoreElements([arrowElement], null);

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

    const restoredLine = restore.restoreElements(
      [lineElement],
      null,
    )[0] as ExcalidrawLinearElement;

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
      get: vi.fn(() => pointsEl_0),
    });

    const pointsEl_1 = [
      [3, 4],
      [5, 6],
    ];
    Object.defineProperty(lineElement_1, "points", {
      get: vi.fn(() => pointsEl_1),
    });

    const restoredElements = restore.restoreElements(
      [lineElement_0, lineElement_1],
      null,
    );

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
        type: elType as "rectangle" | "ellipse" | "diamond" | "embeddable",
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
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      });

      elements.push(element);
    });

    const restoredElements = restore.restoreElements(elements, null);

    expect(restoredElements[0]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(restoredElements[1]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(restoredElements[2]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("bump versions of local duplicate elements when supplied", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const ellipse = API.createElement({ type: "ellipse" });
    const rectangle_modified = newElementWith(rectangle, { isDeleted: true });

    const restoredElements = restore.restoreElements(
      [rectangle, ellipse],
      [rectangle_modified],
    );

    expect(restoredElements[0].id).toBe(rectangle.id);
    expect(restoredElements[0].versionNonce).not.toBe(rectangle.versionNonce);
    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: rectangle.id,
        version: rectangle_modified.version + 2,
      }),
      expect.objectContaining({
        id: ellipse.id,
        version: ellipse.version + 1,
      }),
    ]);
  });
});

describe("restoreAppState", () => {
  it("should restore with imported data", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.activeTool.type = "selection";
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.activeTool.type = "rectangle";
    stubLocalAppState.cursorButton = "up";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.activeTool).toEqual(
      stubImportedAppState.activeTool,
    );
    expect(restoredAppState.cursorButton).toBe("up");
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
    expect(restoredAppState.cursorButton).toBe("up");
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

    stubImportedAppState.activeTool = "not allowed Excalidraw Element Types";
    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.activeTool.type).toBe("selection");
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
    });

    it("when the zoom of imported data state is not a number", () => {
      const stubImportedAppState = getDefaultAppState();
      stubImportedAppState.zoom = {
        value: 10 as NormalizedZoomValue,
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
        get: vi.fn(() => null),
      });

      const stubLocalAppState = getDefaultAppState();

      const restoredAppState = restore.restoreAppState(
        stubImportedAppState,
        stubLocalAppState,
      );

      expect(restoredAppState.zoom).toMatchObject(getDefaultAppState().zoom);
    });
  });

  it("should handle appState.openSidebar legacy values", () => {
    expect(restore.restoreAppState({}, null).openSidebar).toBe(null);
    expect(
      restore.restoreAppState({ openSidebar: "library" } as any, null)
        .openSidebar,
    ).toEqual({ name: DEFAULT_SIDEBAR.name });
    expect(
      restore.restoreAppState({ openSidebar: "xxx" } as any, null).openSidebar,
    ).toEqual({ name: DEFAULT_SIDEBAR.name });
    // while "library" was our legacy sidebar name, we can't assume it's legacy
    // value as it may be some host app's custom sidebar name ¯\_(ツ)_/¯
    expect(
      restore.restoreAppState({ openSidebar: { name: "library" } } as any, null)
        .openSidebar,
    ).toEqual({ name: "library" });
    expect(
      restore.restoreAppState(
        { openSidebar: { name: DEFAULT_SIDEBAR.name, tab: "ola" } } as any,
        null,
      ).openSidebar,
    ).toEqual({ name: DEFAULT_SIDEBAR.name, tab: "ola" });
  });
});

describe("restore", () => {
  it("when imported data state is null it should return an empty array of elements", () => {
    const stubLocalAppState = getDefaultAppState();

    const restoredData = restore.restore(null, stubLocalAppState, null);
    expect(restoredData.elements.length).toBe(0);
  });

  it("when imported data state is null it should return the local app state property", () => {
    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredData = restore.restore(null, stubLocalAppState, null);
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

    const restoredData = restore.restore(
      importedDataState,
      stubLocalAppState,
      null,
    );
    expect(restoredData.elements.length).toBe(elements.length);
  });

  it("when local app state is null but imported app state is supplied", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const importedDataState = {} as ImportedDataState;
    importedDataState.appState = stubImportedAppState;

    const restoredData = restore.restore(importedDataState, null, null);
    expect(restoredData.appState.cursorButton).toBe("up");
    expect(restoredData.appState.name).toBe(stubImportedAppState.name);
  });

  it("bump versions of local duplicate elements when supplied", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const ellipse = API.createElement({ type: "ellipse" });

    const rectangle_modified = newElementWith(rectangle, { isDeleted: true });

    const restoredData = restore.restore(
      { elements: [rectangle, ellipse] },
      null,
      [rectangle_modified],
    );

    expect(restoredData.elements[0].id).toBe(rectangle.id);
    expect(restoredData.elements[0].versionNonce).not.toBe(
      rectangle.versionNonce,
    );
    expect(restoredData.elements).toEqual([
      expect.objectContaining({ version: rectangle_modified.version + 2 }),
      expect.objectContaining({
        id: ellipse.id,
        version: ellipse.version + 1,
      }),
    ]);
  });
});

describe("repairing bindings", () => {
  it("should repair container boundElements when repair is true", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
    });

    expect(container.boundElements).toEqual([]);

    let restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);

    restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
      { repairBindings: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should repair containerId of boundElements when repair is true", () => {
    const boundElement = API.createElement({
      type: "text",
      containerId: null,
    });
    const container = API.createElement({
      type: "rectangle",
      boundElements: [{ type: boundElement.type, id: boundElement.id }],
    });

    let restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: null,
      }),
    ]);

    restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
      { repairBindings: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should ignore bound element if deleted", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
      isDeleted: true,
    });

    expect(container.boundElements).toEqual([]);

    const restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should remove bindings of deleted elements from boundElements when repair is true", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
      isDeleted: true,
    });
    const invisibleBoundElement = API.createElement({
      type: "text",
      containerId: container.id,
      width: 0,
      height: 0,
    });

    const obsoleteBinding = { type: boundElement.type, id: boundElement.id };
    const invisibleBinding = {
      type: invisibleBoundElement.type,
      id: invisibleBoundElement.id,
    };
    expect(container.boundElements).toEqual([]);

    const nonExistentBinding = { type: "text", id: "non-existent" };
    // @ts-ignore
    container.boundElements = [
      obsoleteBinding,
      invisibleBinding,
      nonExistentBinding,
    ];

    let restoredElements = restore.restoreElements(
      [container, invisibleBoundElement, boundElement],
      null,
      { deleteInvisibleElements: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [obsoleteBinding, invisibleBinding, nonExistentBinding],
      }),
      expect.objectContaining({
        id: invisibleBoundElement.id,
        containerId: container.id,
        isDeleted: true,
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);

    restoredElements = restore.restoreElements(
      [container, invisibleBoundElement, boundElement],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: invisibleBoundElement.id,
        containerId: container.id,
        isDeleted: true,
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should remove containerId if container not exists when repair is true", () => {
    const boundElement = API.createElement({
      type: "text",
      containerId: "non-existent",
    });
    const boundElementDeleted = API.createElement({
      type: "text",
      containerId: "non-existent",
      isDeleted: true,
    });

    let restoredElements = restore.restoreElements(
      [boundElement, boundElementDeleted],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: boundElement.id,
        containerId: "non-existent",
      }),
      expect.objectContaining({
        id: boundElementDeleted.id,
        containerId: "non-existent",
      }),
    ]);

    restoredElements = restore.restoreElements(
      [boundElement, boundElementDeleted],
      null,
      { repairBindings: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: boundElement.id,
        containerId: null,
      }),
      expect.objectContaining({
        id: boundElementDeleted.id,
        containerId: null,
      }),
    ]);
  });
});
