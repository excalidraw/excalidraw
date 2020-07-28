import { getElementAtPosition } from "./comparisons";
import { NonDeletedExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import * as RenderElement from "../renderer/renderElement";
import { Drawable } from "roughjs/bin/core";
import { Random } from "roughjs/bin/math";

jest.mock("../renderer/renderElement");

/*
Refactors that come to mind:
-Change appState to selectedElementIds
-Group zoom with appState as zoom relates to app state
-group {x,y} as point coordinate


Notes: Zoom in appState seems to always be equal to zoom given as a parameter.

Missing:
Takes rotation into account
takes line trashold into acount
Linear elements
  line and draw closed and open
  arrow
*/

/*
const ellipse = makeEllipse({
        x: 0,
        y: 0,
        angle: 0,
        width: 100,
        height: 100,
        backgroundColor: "#000000",
      });
      const elements = [ellipse];
      const appState = makeAppState();
      const x = 50;
      const y = 50;
      const zoom = 1;
For some reasons, this doesn't work. but 51 or 49 in x,y does work.
*/

describe("getElementAtPosition", function () {
  describe("non element type specific behavior", function () {
    it("returns null when there aren't elements on the scene", function () {
      const elements = [] as NonDeletedExcalidrawElement[];
      const appState = makeAppState();
      const x = 0;
      const y = 0;
      const zoom = 1;
      expect(getElementAtPosition(elements, appState, x, y, zoom)).toBe(null);
    });

    it("returns null when given coordinates don't hit an existing element", function () {
      const element = makeRectangle({
        x: 200,
        y: 100,
        angle: 0,
        width: 100,
        height: 115,
      });
      const elements = [element];
      const appState = makeAppState();
      const x = 1000;
      const y = 400;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(null);
    });

    it("detects element at the front of the scene when given coordinates hit more than one element", function () {
      const rectangleCollisionProperties = {
        x: 200,
        y: 100,
        angle: 0,
      };
      const elementAtTheBack = makeRectangle(rectangleCollisionProperties);
      const elementAtTheFront = makeRectangle(rectangleCollisionProperties);
      const elementsOrderedFromBackToFront = [
        elementAtTheBack,
        elementAtTheFront,
      ];
      const appState = makeAppState();
      const x = rectangleCollisionProperties.x;
      const y = rectangleCollisionProperties.y;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elementsOrderedFromBackToFront,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(elementAtTheFront);
    });

    it("Takes into account angles when detecting collisions", function () {
      const ellipseCollisionPropertiesExceptAngle = {
        x: 530,
        y: 340,
        width: 111,
        height: 42,
        backgroundColor: "#000000",
      };
      const nonRotatedEllipse = makeEllipse({
        ...ellipseCollisionPropertiesExceptAngle,
        angle: 0,
      });
      const appState = makeAppState();
      const coordinatesThatWillHitEllipseIfRotated = { x: 581, y: 314 };
      const zoom = 1;

      const detectedElementWithoutRotation = getElementAtPosition(
        [nonRotatedEllipse],
        appState,
        coordinatesThatWillHitEllipseIfRotated.x,
        coordinatesThatWillHitEllipseIfRotated.y,
        zoom,
      );

      expect(detectedElementWithoutRotation).toBe(null);

      const rotatedEllipse = makeEllipse({
        ...ellipseCollisionPropertiesExceptAngle,
        angle: 4.72,
      });

      const detectedElementWithRotation = getElementAtPosition(
        [rotatedEllipse],
        appState,
        coordinatesThatWillHitEllipseIfRotated.x,
        coordinatesThatWillHitEllipseIfRotated.y,
        zoom,
      );

      expect(detectedElementWithRotation).toBe(rotatedEllipse);
    });
  });

  describe("rectangles detection", function () {
    it("detects non transparent rectangle when given coordinates hit rectangle's inside", function () {
      const rectangle = makeRectangle({
        x: 0,
        y: 0,
        angle: 0,
        width: 100,
        height: 100,
        backgroundColor: "#000000",
      });
      const elements = [rectangle];
      const appState = makeAppState();
      const x = 50;
      const y = 50;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(rectangle);
    });

    it("doesn't detect transparent rectangle when given coordinates hit rectangle's inside and rectangle isn't selected", function () {
      const rectangle = makeRectangle({
        x: 300,
        y: 100,
        angle: 0,
        width: 100,
        height: 115,
        backgroundColor: "transparent",
      });
      const elements = [rectangle];
      const appState = makeAppState({ selectedElementIds: [] });
      const x = 350;
      const y = 150;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(null);
    });

    it("detects transparent rectangle when given coordinates hit rectangle's inside and rectangle is selected", function () {
      const rectangle = makeRectangle({
        x: 300,
        y: 100,
        angle: 0,
        width: 100,
        height: 115,
        backgroundColor: "transparent",
      });
      const elements = [rectangle];
      const appState = makeAppState({
        selectedElementIds: [rectangle.id],
      });
      const x = 350;
      const y = 150;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(rectangle);
    });

    it("detects transparent rectangle when given coordinates hit rectangle's line", function () {
      const rectangle = makeRectangle({
        angle: 0,
        backgroundColor: "transparent",
      });
      const elements = [rectangle];
      const appState = makeAppState();
      const x = rectangle.x;
      const y = rectangle.y;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(rectangle);
    });
  });

  describe("ellipses detection", function () {
    it("detects non transparent ellipse when given coordinates hit ellipse's inside", function () {
      const ellipse = makeEllipse({
        x: 0,
        y: 0,
        angle: 0,
        width: 100,
        height: 100,
        backgroundColor: "#000000",
      });
      const elements = [ellipse];
      const appState = makeAppState();
      const x = 50;
      // 50 in x and y will cause the test to fail.
      // Which likely means there's a defect on ellipse collision detection algorithm.
      const y = 51;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(ellipse);
    });

    it("doesn't detect transparent ellipse when given coordinates hit ellipse's inside", function () {
      const ellipse = makeEllipse({
        x: 0,
        y: 0,
        angle: 0,
        width: 100,
        height: 100,
        backgroundColor: "transparent",
      });
      const elements = [ellipse];
      const appState = makeAppState();
      const x = 45;
      const y = 45;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(null);
    });

    it("detects transparent ellipse when given coordinates hit ellipse's inside and ellipse is selected", function () {
      const ellipse = makeEllipse({
        x: 100,
        y: 100,
        angle: 0,
        width: 200,
        height: 200,
        backgroundColor: "transparent",
      });
      const elements = [ellipse];
      const appState = makeAppState({
        selectedElementIds: [ellipse.id],
      });
      const x = 200;
      const y = 150;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(ellipse);
    });

    it("detects transparent ellipse when given coordinates hit ellipse's line", function () {
      const ellipse = makeEllipse({
        x: 100,
        y: 100,
        angle: 0,
        width: 200,
        height: 200,
        backgroundColor: "transparent",
      });
      const elements = [ellipse];
      const appState = makeAppState();
      const x = ellipse.x;
      const y = ellipse.y + ellipse.height / 2;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(ellipse);
    });
  });

  describe("diamond detection", function () {
    it("detects non transparent diamond when given coordinates hit diamond's inside", function () {
      const diamond = makeDiamond({
        x: 0,
        y: 0,
        angle: 0,
        width: 100,
        height: 100,
        backgroundColor: "#000000",
      });
      const elements = [diamond];
      const appState = makeAppState();
      const x = 50;
      const y = 50;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(diamond);
    });

    it("doesn't detect transparent diamond when given coordinates hit diamond's inside", function () {
      const diamond = makeDiamond({
        x: 100,
        y: 100,
        angle: 0,
        width: 100,
        height: 100,
        backgroundColor: "transparent",
      });
      const elements = [diamond];
      const appState = makeAppState();
      const x = 145;
      const y = 150;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(null);
    });

    it("detects transparent diamond when given coordinates hit diamond's inside and diamond is selected", function () {
      const diamond = makeDiamond({
        x: 100,
        y: 100,
        angle: 0,
        width: 200,
        height: 200,
        backgroundColor: "transparent",
      });
      const elements = [diamond];
      const appState = makeAppState({
        selectedElementIds: [diamond.id],
      });
      const x = 200;
      const y = 150;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(diamond);
    });

    it("detects transparent diamond when given coordinates hit diamond's line", function () {
      const diamond = makeDiamond({
        x: 100,
        y: 100,
        angle: 0,
        width: 200,
        height: 200,
        backgroundColor: "transparent",
      });
      const elements = [diamond];
      const appState = makeAppState();
      const x = diamond.x;
      const y = diamond.y + diamond.height / 2;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(diamond);
    });
  });

  describe("text detection", function () {
    it("detects text", function () {
      const text = makeText({
        x: 0,
        y: 0,
        angle: 0,
        width: 100,
        height: 100,
      });
      const elements = [text];
      const appState = makeAppState();
      const x = 50;
      const y = 50;
      const zoom = 1;

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        x,
        y,
        zoom,
      );

      expect(detectedElement).toBe(text);
    });
  });

  describe("arrow detection", function () {
    it("detects arrow", function () {
      const {
        arrow,
        arrowAsShape,
        coordinates,
        zoom,
      } = getTupleWithArrowShapeZoomAndCoordinatesThatHitArrow();
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => arrowAsShape);

      const elements = [arrow];
      const appState = makeAppState();

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinates.x,
        coordinates.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(arrow);
      expect(detectedElement).toBe(arrow);

      mockedGetShapeForElement.mockRestore();
    });
  });

  describe("line detection", function () {
    it("detects line without loop", function () {
      const {
        lineWithoutLoop,
        lineAsShape,
        coordinates,
        zoom,
      } = getTupleWithLineWithoutLoopShapeZoomAndCoordinatesThatHitLine();
      const appState = makeAppState();
      const elements = [lineWithoutLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => lineAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinates.x,
        coordinates.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(lineWithoutLoop);
      expect(detectedElement).toBe(lineWithoutLoop);

      mockedGetShapeForElement.mockRestore();
    });

    it("detects line with loop given background is not transparent and given coordinates hit the inside of the loop", function () {
      const {
        lineWithLoop,
        lineAsShape,
        coordinatesInsideLoop,
        zoom,
      } = getTupleWithLineWithLoopShapeZoomAndCoordinates({
        lineBackgroundColor: "#000000",
      });
      const appState = makeAppState();
      const elements = [lineWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => lineAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesInsideLoop.x,
        coordinatesInsideLoop.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(lineWithLoop);
      expect(detectedElement).toBe(lineWithLoop);

      mockedGetShapeForElement.mockRestore();
    });

    it("Doesn't detect line with loop given background is transparent and line is not selected", function () {
      const {
        lineWithLoop,
        lineAsShape,
        coordinatesInsideLoop,
        zoom,
      } = getTupleWithLineWithLoopShapeZoomAndCoordinates({
        lineBackgroundColor: "transparent",
      });
      const appState = makeAppState({ selectedElementIds: [] });
      const elements = [lineWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => lineAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesInsideLoop.x,
        coordinatesInsideLoop.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(lineWithLoop);
      expect(detectedElement).toBe(null);

      mockedGetShapeForElement.mockRestore();
    });

    it("Detects line with loop given background is transparent and line is selected", function () {
      const {
        lineWithLoop,
        lineAsShape,
        coordinatesInsideLoop,
        zoom,
      } = getTupleWithLineWithLoopShapeZoomAndCoordinates({
        lineBackgroundColor: "transparent",
      });
      const appState = makeAppState({ selectedElementIds: [lineWithLoop.id] });
      const elements = [lineWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => lineAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesInsideLoop.x,
        coordinatesInsideLoop.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(lineWithLoop);
      expect(detectedElement).toBe(lineWithLoop);

      mockedGetShapeForElement.mockRestore();
    });

    it("Detects line with loop given background is transparent, line is not selected and coordinates hit line outline", function () {
      const {
        lineWithLoop,
        lineAsShape,
        coordinatesThatHitLoopOutline,
        zoom,
      } = getTupleWithLineWithLoopShapeZoomAndCoordinates({
        lineBackgroundColor: "transparent",
      });
      const appState = makeAppState({ selectedElementIds: [] });
      const elements = [lineWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => lineAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesThatHitLoopOutline.x,
        coordinatesThatHitLoopOutline.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(lineWithLoop);
      expect(detectedElement).toBe(lineWithLoop);

      mockedGetShapeForElement.mockRestore();
    });
  });

  describe("draw detection", function () {
    it("detects draw without loop", function () {
      const {
        drawWithoutLoop,
        drawAsShape,
        coordinates,
        zoom,
      } = getTupleWithDrawWithoutLoopShapeZoomAndCoordinatesThatHitDraw();
      const appState = makeAppState();
      const elements = [drawWithoutLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => drawAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinates.x,
        coordinates.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(drawWithoutLoop);
      expect(detectedElement).toBe(drawWithoutLoop);

      mockedGetShapeForElement.mockRestore();
    });

    it("detects draw with loop given background is not transparent and given coordinates hit the inside of the loop", function () {
      const {
        drawWithLoop,
        drawAsShape,
        coordinatesInsideLoop,
        zoom,
      } = getTupleWithDrawWithLoopShapeZoomAndCoordinates({
        drawBackgroundColor: "#000000",
      });
      const appState = makeAppState();
      const elements = [drawWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => drawAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesInsideLoop.x,
        coordinatesInsideLoop.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(drawWithLoop);
      expect(detectedElement).toBe(drawWithLoop);

      mockedGetShapeForElement.mockRestore();
    });

    it("doesn't detect draw with loop given background is transparent and draw is not selected", function () {
      const {
        drawWithLoop,
        drawAsShape,
        coordinatesInsideLoop,
        zoom,
      } = getTupleWithDrawWithLoopShapeZoomAndCoordinates({
        drawBackgroundColor: "transparent",
      });
      const appState = makeAppState({ selectedElementIds: [] });
      const elements = [drawWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => drawAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesInsideLoop.x,
        coordinatesInsideLoop.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(drawWithLoop);
      expect(detectedElement).toBe(null);

      mockedGetShapeForElement.mockRestore();
    });

    it("detect draw with loop given background is transparent and draw is selected", function () {
      const {
        drawWithLoop,
        drawAsShape,
        coordinatesInsideLoop,
        zoom,
      } = getTupleWithDrawWithLoopShapeZoomAndCoordinates({
        drawBackgroundColor: "transparent",
      });
      const appState = makeAppState({ selectedElementIds: [drawWithLoop.id] });
      const elements = [drawWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => drawAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesInsideLoop.x,
        coordinatesInsideLoop.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(drawWithLoop);
      expect(detectedElement).toBe(drawWithLoop);

      mockedGetShapeForElement.mockRestore();
    });

    it("detect draw with loop given background is transparent, draw is not selected and coordinates hit draw outline", function () {
      const {
        drawWithLoop,
        drawAsShape,
        coordinatesThatHitDrawOutline,
        zoom,
      } = getTupleWithDrawWithLoopShapeZoomAndCoordinates({
        drawBackgroundColor: "transparent",
      });
      const appState = makeAppState({ selectedElementIds: [] });
      const elements = [drawWithLoop];
      const mockedGetShapeForElement = RenderElement.getShapeForElement as jest.Mock<
        any,
        any
      >;
      mockedGetShapeForElement.mockImplementation(() => drawAsShape);

      const detectedElement = getElementAtPosition(
        elements,
        appState,
        coordinatesThatHitDrawOutline.x,
        coordinatesThatHitDrawOutline.y,
        zoom,
      );

      expect(mockedGetShapeForElement).toHaveBeenCalledWith(drawWithLoop);
      expect(detectedElement).toBe(drawWithLoop);

      mockedGetShapeForElement.mockRestore();
    });
  });
});

interface RectangleCollisionRelatedProperties {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  backgroundColor?: string;
}

function makeRectangle({
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  angle = 0,
  backgroundColor = "transparent",
}: RectangleCollisionRelatedProperties): NonDeletedExcalidrawElement {
  return {
    type: "rectangle",
    x,
    y,
    angle,
    backgroundColor,
    width,
    height,
    version: 60,
    versionNonce: 1573266463,
    isDeleted: false,
    id: "OSW7Z215bpi_C6cs8Uw1z",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 80,
    strokeColor: "#000000",
    seed: 1062802705,
    groupIds: [],
  };
}

interface EllipseCollisionRelatedProperties {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  backgroundColor?: string;
}

function makeEllipse({
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  angle = 0,
  backgroundColor = "transparent",
}: EllipseCollisionRelatedProperties): NonDeletedExcalidrawElement {
  return {
    type: "ellipse",
    x,
    y,
    width,
    height,
    angle,
    backgroundColor,
    id: "dD0Xvvdz5PR9U8gUIBsDW",
    strokeColor: "#000000",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 80,
    groupIds: [],
    seed: 1089603187,
    version: 202,
    versionNonce: 1960865107,
    isDeleted: false,
  };
}

interface DiamondCollisionRelatedProperties {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  backgroundColor?: string;
}

function makeDiamond({
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  angle = 0,
  backgroundColor = "transparent",
}: DiamondCollisionRelatedProperties): NonDeletedExcalidrawElement {
  return {
    type: "diamond",
    x,
    y,
    width,
    height,
    angle,
    backgroundColor,
    id: "dD0Xvvdz5PR9U8gUIBsDW",
    strokeColor: "#000000",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 80,
    groupIds: [],
    seed: 1089603187,
    version: 202,
    versionNonce: 1960865107,
    isDeleted: false,
  };
}

interface TextCollisionRelatedProperties {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
}

function makeText({
  x = 0,
  y = 0,
  angle = 0,
  width = 100,
  height = 100,
}: TextCollisionRelatedProperties): NonDeletedExcalidrawElement {
  return {
    id: "7R68aE2QiCxkYiGXR2zH0",
    type: "text",
    x,
    y,
    width,
    height,
    angle,
    strokeColor: "#000000",
    backgroundColor: "#ced4da",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    seed: 651147829,
    version: 33,
    versionNonce: 1833954875,
    isDeleted: false,
    text: "text",
    fontSize: 20,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    baseline: 23,
  };
}

interface AppStateCollisionRelatedProperties {
  selectedElementIds: string[];
}

function makeAppState(
  { selectedElementIds }: AppStateCollisionRelatedProperties = {
    selectedElementIds: [],
  },
): AppState {
  return {
    selectedElementIds: getSelectedElementIdsAsObj(),
  } as AppState;

  function getSelectedElementIdsAsObj() {
    return selectedElementIds
      .map((id) => ({ [id]: true }))
      .reduce((selectedElementIdsObj, idObj) => {
        return { ...selectedElementIdsObj, ...idObj };
      }, {});
  }
}

/*
  The functions bellow return values of elements, roughjs shapes, app zoom, and
  coordinates of points that hit the element. Those values were computed at runtime
  and then copy and pasted here.

  I found this approach necessary because there's a dependency between getElementAtPosition()
  and a singleton cache of type WeakMap< ExcalidrawElement, Drawable | Drawable[] | null>.
  The problem is that the cache is not populated when we run getElementAtPosition() in isolation,
  but getElementAtPosition() needs it to be populated in other to function properly.
  In order to populate the cache it would have been necessary to invoke a function that has
  dependencies that are hard to instantiate on a unit test. Dependencies such as
  HTMLCanvasElement and a RoughCanvas. So I opted to mock the function access to the cache
  and have it return what would have been returned in production.
*/

function getTupleWithArrowShapeZoomAndCoordinatesThatHitArrow() {
  const arrow = {
    type: "arrow",
    version: 113,
    x: 530.9333496093749,
    y: 384.0000040690104,
    width: 45.33333333333337,
    height: 66.66666666666669,
    angle: 0,
    versionNonce: 1468937045,
    isDeleted: false,
    id: "BrkCWXwgAWeFr-NHl8hYD",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    strokeColor: "#000000",
    backgroundColor: "#ced4da",
    seed: 1117349621,
    groupIds: [],
    points: [
      [0, 0],
      [45.33333333333337, -66.66666666666669],
    ],
  } as NonDeletedExcalidrawElement;
  const arrowAsShape = [
    {
      shape: "curve",
      sets: [
        {
          type: "path",
          ops: [
            { op: "move", data: [-0.5402448233217001, 0.2421334382146596] },
            {
              op: "bcurveTo",
              data: [
                6.933868721831182,
                -10.956261820635865,
                37.894069366695184,
                -56.44426692496573,
                45.35652939317131,
                -67.76966222959263,
              ],
            },
            { op: "move", data: [1.3769879150949418, -0.6763504520617425] },
            {
              op: "bcurveTo",
              data: [
                8.650323115974256,
                -11.716202140274564,
                36.89150358192419,
                -55.767263605683645,
                44.42066186095902,
                -66.81130964890745,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 1117349621,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        randomizer: { seed: -2007513995 },
      },
    },
    {
      shape: "line",
      sets: [
        {
          type: "path",
          ops: [
            { op: "move", data: [37.885880876904416, -37.58601761540628] },
            {
              op: "bcurveTo",
              data: [
                38.16234430554167,
                -49.42572085001289,
                40.63883293817844,
                -58.67966589760161,
                43.73919567826518,
                -65.86541446321336,
              ],
            },
            { op: "move", data: [38.28126085327386, -38.19917828614122] },
            {
              op: "bcurveTo",
              data: [
                39.5363425810314,
                -45.72418565453518,
                41.16173238161119,
                -53.19056556005168,
                45.3505117491571,
                -66.02735643949983,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 1117349621,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        randomizer: new Random(-231978475),
      },
    },
    {
      shape: "line",
      sets: [
        {
          type: "path",
          ops: [
            { op: "move", data: [20.748337931243146, -48.87426921481064] },
            {
              op: "bcurveTo",
              data: [
                26.84255601743245,
                -56.76885386369838,
                35.191292465166285,
                -62.15483423274196,
                43.73919567826518,
                -65.86541446321336,
              ],
            },
            { op: "move", data: [21.143717907612587, -49.48742988554558] },
            {
              op: "bcurveTo",
              data: [
                26.97283576007627,
                -54.03768744377767,
                33.14525154598426,
                -58.50900711725496,
                45.3505117491571,
                -66.02735643949983,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 1117349621,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        randomizer: { seed: -231978475 },
      },
    },
  ] as Drawable[];
  const coordinates = { x: 571, y: 345.20001220703125 };
  const zoom = 1;
  return { arrow, arrowAsShape, coordinates, zoom };
}

function getTupleWithLineWithoutLoopShapeZoomAndCoordinatesThatHitLine() {
  const lineWithoutLoop = {
    type: "line",
    version: 41,
    versionNonce: 171153324,
    isDeleted: false,
    id: "bIeoqjzsN-0Xf67tbWChU",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    angle: 0,
    x: 461.3999938964844,
    y: 395.6000061035156,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    width: 50.4000244140625,
    height: 113.60000610351562,
    seed: 1740940716,
    groupIds: [],
    points: [
      [0, 0],
      [50.4000244140625, -113.60000610351562],
    ],
  } as NonDeletedExcalidrawElement;
  const lineAsShape = [
    {
      shape: "curve",
      sets: [
        {
          type: "path",
          ops: [
            { op: "move", data: [1.1084726080298422, -0.9187377914786339] },
            {
              op: "bcurveTo",
              data: [
                9.208223905662697,
                -19.75359930843115,
                41.02593556096157,
                -95.51328458636999,
                49.20809194892645,
                -114.17203068584203,
              ],
            },
            { op: "move", data: [0.2312819979060441, 1.213320922655985] },
            {
              op: "bcurveTo",
              data: [
                8.625379301753515,
                -17.36547460843809,
                43.11092218036143,
                -93.59417953570374,
                51.29428194110282,
                -112.93491834034212,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 1740940716,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        randomizer: new Random(-421630036),
      },
    },
  ] as Drawable[];
  const coordinates = { x: 495, y: 334 };
  const zoom = 1;
  return { lineWithoutLoop, lineAsShape, coordinates, zoom };
}

function getTupleWithLineWithLoopShapeZoomAndCoordinates({
  lineBackgroundColor,
}: {
  lineBackgroundColor: string;
}) {
  const lineWithLoop = {
    id: "PtqI2BaDYB6jl9A435Bev",
    type: "line",
    x: 587.7999877929688,
    y: 280.3999938964844,
    width: 48,
    height: 43.20001220703125,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: lineBackgroundColor,
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    seed: 991255563,
    version: 274,
    versionNonce: 639564069,
    isDeleted: false,
    points: [
      [0, 0],
      [16.800048828125, 43.20001220703125],
      [-31.199951171875, 24],
      [0, 0],
    ],
    lastCommittedPoint: [0.800048828125, -1.5999755859375],
  } as NonDeletedExcalidrawElement;
  const lineAsShape = [
    {
      shape: "curve",
      sets: [
        {
          type: "fillSketch",
          ops: [
            { op: "move", data: [-28.276559948349785, 17.81997723299601] },
            {
              op: "bcurveTo",
              data: [
                -28.276559948349785,
                17.81997723299601,
                -28.276559948349785,
                17.81997723299601,
                -28.276559948349785,
                17.81997723299601,
              ],
            },
            { op: "move", data: [-28.276559948349785, 17.81997723299601] },
            {
              op: "bcurveTo",
              data: [
                -28.276559948349785,
                17.81997723299601,
                -28.276559948349785,
                17.81997723299601,
                -28.276559948349785,
                17.81997723299601,
              ],
            },
            { op: "move", data: [-31.02658845990086, 25.134030400184976] },
            {
              op: "bcurveTo",
              data: [
                -26.411511044193443,
                21.83173517724322,
                -22.798186429915756,
                16.448120544684237,
                -17.974665675901417,
                10.896777217455762,
              ],
            },
            { op: "move", data: [-30.81199569109017, 25.741573660975384] },
            {
              op: "bcurveTo",
              data: [
                -24.267892309553012,
                21.007413553283158,
                -20.047494518183317,
                14.40301803656345,
                -16.31571065414006,
                10.314632659957367,
              ],
            },
            { op: "move", data: [-27.92958299625355, 27.584316520827947] },
            {
              op: "bcurveTo",
              data: [
                -16.285034492487622,
                18.899651744124824,
                -9.412374833699799,
                8.2860798177007,
                -4.6796824014175495,
                1.9926964764771142,
              ],
            },
            { op: "move", data: [-25.936635731679083, 27.141724794979332] },
            {
              op: "bcurveTo",
              data: [
                -22.342678639973276,
                21.726719854681182,
                -17.093834626221565,
                17.687080882912305,
                -5.083331479168292,
                3.4480643703890124,
              ],
            },
            { op: "move", data: [-21.164503642285226, 29.009460308241547] },
            {
              op: "bcurveTo",
              data: [
                -14.66097783969486,
                19.984356955582975,
                -8.710815395729139,
                10.456711742046245,
                2.166189152557026,
                0.43763686045751604,
              ],
            },
            { op: "move", data: [-23.0081701818127, 29.38193077745557] },
            {
              op: "bcurveTo",
              data: [
                -15.45964023279551,
                21.74586606320668,
                -8.21062042525065,
                11.619978617432785,
                0.9529791500378355,
                1.577605256621993,
              ],
            },
            { op: "move", data: [-19.711094591661624, 34.79739134235925] },
            {
              op: "bcurveTo",
              data: [
                -14.583183059691489,
                23.832503044056843,
                -9.310731915104794,
                17.682610315628605,
                1.9638731963470732,
                5.483958994107674,
              ],
            },
            { op: "move", data: [-19.96035324492239, 32.83293979185319] },
            {
              op: "bcurveTo",
              data: [
                -14.35940623187329,
                24.110644076648992,
                -6.7629070543395,
                17.466911323644382,
                4.293846371537462,
                5.61909860938264,
              ],
            },
            { op: "move", data: [-16.30886566304849, 34.689554828114524] },
            {
              op: "bcurveTo",
              data: [
                -5.729817909555882,
                23.38477467536907,
                0.8853590773582667,
                14.074770279824662,
                4.572323460229895,
                9.026491226024433,
              ],
            },
            { op: "move", data: [-16.83143131193952, 33.9231172091213] },
            {
              op: "bcurveTo",
              data: [
                -9.101043845317976,
                24.532923813095707,
                0.3656106436150459,
                16.535257371046217,
                5.646948280842266,
                10.241207005783423,
              ],
            },
            { op: "move", data: [-11.331710358092582, 37.85283075588641] },
            {
              op: "bcurveTo",
              data: [
                -8.141957208401744,
                31.828612998394277,
                -3.9343408709649434,
                26.921991471819602,
                6.529373875539747,
                11.46683501114127,
              ],
            },
            { op: "move", data: [-13.295011019276476, 37.366614748154554] },
            {
              op: "bcurveTo",
              data: [
                -8.27337425911117,
                32.06883352689711,
                -4.1287167286968405,
                27.15755892582116,
                7.491616612020877,
                13.885967691773445,
              ],
            },
            { op: "move", data: [-7.382228774450153, 38.17790516083114] },
            {
              op: "bcurveTo",
              data: [
                -2.782571173049364,
                29.571815676203276,
                2.686026946448594,
                23.103891731254663,
                10.457415661639367,
                17.011736170059983,
              ],
            },
            { op: "move", data: [-9.910632161855132, 37.61799173512481] },
            {
              op: "bcurveTo",
              data: [
                -2.3635368753515467,
                30.731403724554085,
                3.641674671137304,
                24.21495565083564,
                9.828263824670408,
                17.223413841470126,
              ],
            },
            { op: "move", data: [-4.510286634777451, 40.596479703104976] },
            {
              op: "bcurveTo",
              data: [
                -0.5433520399533389,
                34.62305836555077,
                4.919116937870417,
                27.563110377372638,
                12.437251499863008,
                20.707327407714047,
              ],
            },
            { op: "move", data: [-4.998576722097361, 40.34567468370396] },
            {
              op: "bcurveTo",
              data: [
                -0.8143037992402768,
                35.27825565586921,
                1.9993897975132722,
                32.442816422256925,
                10.895987277859488,
                22.34206707582257,
              ],
            },
            { op: "move", data: [-0.11945625774021806, 39.889062087641385] },
            {
              op: "bcurveTo",
              data: [
                0.33955791796321444,
                37.703003338406894,
                5.86304675492582,
                35.4878165043233,
                12.821359417554422,
                25.020466634259712,
              ],
            },
            { op: "move", data: [-1.2025598409345335, 41.395997714841094] },
            {
              op: "bcurveTo",
              data: [
                1.5391608885564318,
                36.79079427013088,
                4.573930862609203,
                33.542385013188614,
                12.329583114166244,
                26.48652578350265,
              ],
            },
            { op: "move", data: [2.57446985136752, 44.31572724755454] },
            {
              op: "bcurveTo",
              data: [
                6.851252362146118,
                35.760761167219854,
                12.182584467029251,
                33.600624467923545,
                16.788460145480208,
                29.799450702983496,
              ],
            },
            { op: "move", data: [2.413402917553084, 41.85376509090486] },
            {
              op: "bcurveTo",
              data: [
                5.3317828319765495,
                40.18211774448256,
                9.313976238362303,
                36.566806610438164,
                15.230923269930502,
                28.336931043229608,
              ],
            },
            { op: "move", data: [8.232693316875839, 41.75998523883468] },
            {
              op: "bcurveTo",
              data: [
                9.743384441622041,
                40.05773264884896,
                11.336119530061497,
                38.516246723528994,
                17.644725864207413,
                33.2418037282272,
              ],
            },
            { op: "move", data: [7.631953525026211, 42.54949286543711] },
            {
              op: "bcurveTo",
              data: [
                11.647681938574202,
                39.989588126384646,
                13.787697512140639,
                35.577506359095466,
                17.192254424806723,
                33.29295241762574,
              ],
            },
            { op: "move", data: [13.113515412574055, 43.26272112656679] },
            {
              op: "bcurveTo",
              data: [
                14.16970068919458,
                41.97029986399597,
                15.014453876763314,
                39.83073536996973,
                17.74133484966016,
                37.693984862020024,
              ],
            },
            { op: "move", data: [13.351242809881807, 43.40191656913902] },
            {
              op: "bcurveTo",
              data: [
                14.88994259844893,
                40.75690832840714,
                16.983381938149883,
                38.203225690181476,
                18.272763645340564,
                37.49338115078748,
              ],
            },
          ],
        },
        {
          type: "path",
          ops: [
            { op: "move", data: [-0.41737474836409094, 0.9035217169672249] },
            {
              op: "bcurveTo",
              data: [
                2.6137915865828596,
                7.940847572063405,
                22.838696668172876,
                39.16272956170141,
                17.896848553046585,
                42.819533896818754,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                12.955000437920294,
                46.4763382319361,
                -27.27051575022439,
                29.784410127376518,
                -30.068463439121842,
                22.844347727671266,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                -32.866411128019294,
                15.904285327966015,
                -4.036940871054927,
                4.834382903948426,
                1.1091624196618797,
                1.1791594985872507,
              ],
            },
            { op: "move", data: [1.5643647794052957, 0.3322666730359196] },
            {
              op: "bcurveTo",
              data: [
                4.558867878926296,
                7.488555282143254,
                22.825372187706332,
                40.28673296112567,
                17.524622945003212,
                44.157208035178485,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                12.223873702300093,
                48.0276831092313,
                -27.03242214201639,
                31.040971935776373,
                -30.240130676813422,
                23.555117117352783,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                -33.44783921161046,
                16.069262298929193,
                -6.72188760160158,
                2.8707526864483945,
                -1.7216282637789846,
                -0.757920875363052,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 991255563,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        fill: lineBackgroundColor,
        randomizer: new Random(-381382869),
      },
    },
  ] as Drawable[];
  const zoom = 1;
  const coordinatesInsideLoop = { x: 579, y: 303 };
  const coordinatesThatHitLoopOutline = { x: 595, y: 290 };
  return {
    lineWithLoop,
    lineAsShape,
    zoom,
    coordinatesInsideLoop,
    coordinatesThatHitLoopOutline,
  };
}

function getTupleWithDrawWithoutLoopShapeZoomAndCoordinatesThatHitDraw() {
  const drawWithoutLoop = {
    id: "9rHTBYGl7gvZGpgsnRc4x",
    type: "draw",
    x: 597.4000244140625,
    y: 337.1999969482422,
    width: 27.20001220703125,
    height: 33.60002136230469,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "#868e96",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    seed: 1244487349,
    version: 32,
    versionNonce: 510526587,
    isDeleted: false,
    points: [
      [0, 0],
      [16.79998779296875, 18.400009155273438],
      [18.39996337890625, 18.400009155273438],
      [27.20001220703125, 33.60002136230469],
    ],
    lastCommittedPoint: null,
  } as NonDeletedExcalidrawElement;
  const drawAsShape = [
    {
      shape: "curve",
      sets: [
        {
          type: "path",
          ops: [
            { op: "move", data: [-0.1369835671037436, -0.3337676648050546] },
            {
              op: "bcurveTo",
              data: [
                2.6437298281739148,
                2.647411576534311,
                13.471543099855381,
                15.151603551333148,
                16.701039988175033,
                18.090523957833646,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                19.930536876494685,
                21.029444364334147,
                17.62004054225981,
                14.541174562399586,
                19.239997762814163,
                17.299754774197936,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                20.859954983368514,
                20.058334985996286,
                24.9602457229048,
                31.95822779697676,
                26.420783311501147,
                34.642005228623745,
              ],
            },
            { op: "move", data: [-1.6680386691726745, -1.5545996341668071] },
            {
              op: "bcurveTo",
              data: [
                0.9445290379288294,
                1.5860656559901933,
                12.270487562672544,
                16.19976819857334,
                15.701046927031129,
                19.465469480399044,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                19.131606291389712,
                22.731170762224746,
                17.15572747355327,
                15.845035028898467,
                18.91531751697883,
                18.0396080567874,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                20.674907560404392,
                20.234181084676333,
                24.918824090417473,
                30.024606001221883,
                26.25858718758449,
                32.632907647732644,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 1244487349,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        randomizer: new Random(896930549),
      },
    },
  ] as Drawable[];
  const zoom = 1;
  const coordinates = { x: 607, y: 349.1999969482422 };
  return { drawWithoutLoop, drawAsShape, zoom, coordinates };
}

function getTupleWithDrawWithLoopShapeZoomAndCoordinates({
  drawBackgroundColor,
}: {
  drawBackgroundColor: string;
}) {
  const drawWithLoop = {
    type: "draw",
    version: 172,
    versionNonce: 1177447291,
    isDeleted: false,
    id: "zd2YiVwyGGOT-0Y5eF935",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    angle: 0,
    x: 613.4000244140625,
    y: 374.8000183105469,
    strokeColor: "#000000",
    backgroundColor: drawBackgroundColor,
    width: 27.20001220703125,
    height: 45.5999755859375,
    seed: 90106741,
    groupIds: [],
    points: [
      [0, 0],
      [8.79998779296875, 2.399993896484375],
      [16.79998779296875, 36],
      [-0.79998779296875, 45.5999755859375],
      [-10.4000244140625, 9.5999755859375],
      [0, 0],
    ],
  } as NonDeletedExcalidrawElement;
  const drawAsShape = [
    {
      shape: "curve",
      sets: [
        {
          type: "fillSketch",
          ops: [
            { op: "move", data: [-9.131064590879273, 5.312616582493414] },
            {
              op: "bcurveTo",
              data: [
                -9.131064590879273,
                5.312616582493414,
                -9.131064590879273,
                5.312616582493414,
                -9.131064590879273,
                5.312616582493414,
              ],
            },
            { op: "move", data: [-9.131064590879273, 5.312616582493414] },
            {
              op: "bcurveTo",
              data: [
                -9.131064590879273,
                5.312616582493414,
                -9.131064590879273,
                5.312616582493414,
                -9.131064590879273,
                5.312616582493414,
              ],
            },
            { op: "move", data: [-8.665851847266381, 11.79700382658612] },
            {
              op: "bcurveTo",
              data: [
                -6.761562972746045,
                9.533550157536666,
                -4.932830320152048,
                6.186581069004988,
                -0.897088517656985,
                0.050315667756025695,
              ],
            },
            { op: "move", data: [-8.71573183713255, 10.64001299682405] },
            {
              op: "bcurveTo",
              data: [
                -6.289083764968706,
                7.897064782550076,
                -3.427784050161182,
                3.345048129257472,
                1.0300316187194851,
                1.0664186963551985,
              ],
            },
            { op: "move", data: [-8.97646989848715, 13.972995674078657] },
            {
              op: "bcurveTo",
              data: [
                -5.789062188950373,
                11.418100243710956,
                0.6040449909692489,
                7.0187894121445,
                5.9591290613598265,
                -0.0917691344967948,
              ],
            },
            { op: "move", data: [-8.650527247118472, 15.550719891515865] },
            {
              op: "bcurveTo",
              data: [
                -3.862289976921245,
                11.828492028793507,
                -1.5996895163081764,
                7.534916208056292,
                5.9974963784179725,
                -0.06300742073123322,
              ],
            },
            { op: "move", data: [-5.194094833142871, 21.41971723303673] },
            {
              op: "bcurveTo",
              data: [
                -3.07260053283447,
                15.423723583179154,
                0.3207168365913784,
                13.320517444688047,
                10.12336438744391,
                1.3714026335225706,
              ],
            },
            { op: "move", data: [-6.992885957628304, 19.97334719669548] },
            {
              op: "bcurveTo",
              data: [
                -2.6092911618465338,
                15.966059443213044,
                0.16620403778419757,
                12.800327502072257,
                8.2622033500957,
                3.266968798038483,
              ],
            },
            { op: "move", data: [-6.008130519141366, 27.523060724978205] },
            {
              op: "bcurveTo",
              data: [
                -1.4358116076145109,
                21.127690467698997,
                -0.23615456820290692,
                16.54807479233062,
                11.323956158110454,
                7.556706803564627,
              ],
            },
            { op: "move", data: [-4.997625840318312, 25.594412192609962] },
            {
              op: "bcurveTo",
              data: [
                -0.9329701362608884,
                22.189000266797045,
                1.7863053104254236,
                16.711492600080778,
                9.593152058409109,
                7.912010119941731,
              ],
            },
            { op: "move", data: [-3.2534768588263834, 29.829840114746823] },
            {
              op: "bcurveTo",
              data: [
                1.1056195208331818,
                23.52232114194639,
                3.8945061076926972,
                20.962467180188604,
                11.157072182987232,
                10.940187974804811,
              ],
            },
            { op: "move", data: [-5.38645710026662, 30.740605553087427] },
            {
              op: "bcurveTo",
              data: [
                0.3245332234170428,
                25.023376216345763,
                3.4143775869371114,
                19.99634608904116,
                12.3647390727516,
                12.22862379063832,
              ],
            },
            { op: "move", data: [-5.317768129541674, 36.84585374218634] },
            {
              op: "bcurveTo",
              data: [
                1.0814763512823902,
                32.16592437533145,
                5.678094821387154,
                27.26695503755083,
                14.44835075174948,
                16.667923022532417,
              ],
            },
            { op: "move", data: [-4.120347755051354, 35.52475076445601] },
            {
              op: "bcurveTo",
              data: [
                1.6641772385241507,
                29.59127490916497,
                8.148318614524564,
                22.735746186588848,
                12.400558005064035,
                15.664247769401921,
              ],
            },
            { op: "move", data: [-0.5788729836309905, 40.473384322140504] },
            {
              op: "bcurveTo",
              data: [
                1.8296660821486594,
                32.65674920360735,
                8.78497224761118,
                26.374209323303468,
                13.71993189503446,
                22.201134876145645,
              ],
            },
            { op: "move", data: [-3.18077363475064, 40.12705412554382] },
            {
              op: "bcurveTo",
              data: [
                0.8799137586392392,
                35.897260696679034,
                6.388020806314012,
                30.9324577089647,
                15.096680770749298,
                21.24611450711511,
              ],
            },
            { op: "move", data: [-2.1863354194475697, 45.693989364230305] },
            {
              op: "bcurveTo",
              data: [
                4.435060354959698,
                35.625946709191794,
                11.791439994217486,
                29.05251023468953,
                16.50448515251741,
                23.791369160933797,
              ],
            },
            { op: "move", data: [-1.6949093529520916, 45.32164516745624] },
            {
              op: "bcurveTo",
              data: [
                2.4818443668822416,
                41.23080888942903,
                6.798828311880974,
                35.78835717804923,
                15.391935356748258,
                25.900177588051562,
              ],
            },
            { op: "move", data: [3.1890071606648327, 48.515420333299474] },
            {
              op: "bcurveTo",
              data: [
                6.713364734242151,
                40.61332218873612,
                14.016520338955493,
                33.61739110339124,
                17.156181804835597,
                28.880317556295076,
              ],
            },
            { op: "move", data: [1.971003635266161, 48.267245814021365] },
            {
              op: "bcurveTo",
              data: [
                5.68148907999897,
                43.564600842252,
                10.097616986060672,
                38.98592080950544,
                17.235128053463797,
                29.694685088093856,
              ],
            },
            { op: "move", data: [10.398900147858601, 44.67876767902886] },
            {
              op: "bcurveTo",
              data: [
                12.083273810890294,
                41.60087338386309,
                14.079305246265854,
                41.17915669124343,
                18.15994852784537,
                36.08394224815873,
              ],
            },
            { op: "move", data: [9.506629997636718, 45.5063463184542] },
            {
              op: "bcurveTo",
              data: [
                11.608885218290226,
                42.23522561596487,
                14.802391946692588,
                38.5881994068805,
                16.594307676548883,
                35.83440931555686,
              ],
            },
          ],
        },
        {
          type: "path",
          ops: [
            { op: "move", data: [0.7621899548918007, -0.3286874178797007] },
            {
              op: "bcurveTo",
              data: [
                2.3183735751857357,
                0.04238770765562855,
                6.513152840112646,
                -3.1082230214029556,
                9.129639321938157,
                3.008948778733611,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                11.746125803763668,
                9.126120578870179,
                18.06114038464924,
                29.293171262368563,
                16.461108845844866,
                36.3743433829397,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                14.861077307040492,
                43.45551550351084,
                3.8560419662545127,
                49.78094618680577,
                -0.47054991088807574,
                45.49598150216043,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                -4.797141788030665,
                41.211016817515095,
                -9.497896402701736,
                18.256333644812308,
                -9.498442417010665,
                10.664555275067688,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                -9.498988431319594,
                3.0727769053230682,
                -2.0770622547715902,
                1.6576443867137034,
                -0.4738259967416525,
                -0.05468871630728245,
              ],
            },
            { op: "move", data: [-0.2967990481294691, -1.546852257605642] },
            {
              op: "bcurveTo",
              data: [
                1.148360752121856,
                -1.5965944089057544,
                5.718944552795341,
                -4.756460115071387,
                8.354660911019892,
                1.2060753431357443,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                10.990377269244442,
                7.168610801342875,
                16.918391915814333,
                26.67183213258162,
                15.517499101217837,
                34.22836049163714,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                14.116606286621343,
                41.78488885069266,
                4.284908020949612,
                50.92427237395818,
                -0.050695976559072875,
                46.54524549746886,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                -4.386299974067758,
                42.16621862097954,
                -10.61951636845246,
                15.898966891610375,
                -10.496124883834273,
                7.954199232701212,
              ],
            },
            {
              op: "bcurveTo",
              data: [
                -10.372733399216086,
                0.009431573792050507,
                -1.1976060652174054,
                0.32737035676216086,
                0.6896529311500492,
                -1.1233604559861123,
              ],
            },
          ],
        },
      ],
      options: {
        maxRandomnessOffset: 2,
        roughness: 1,
        bowing: 1,
        stroke: "#000000",
        strokeWidth: 1,
        curveTightness: 0,
        curveFitting: 0.95,
        curveStepCount: 9,
        fillStyle: "hachure",
        fillWeight: 0.5,
        hachureAngle: -41,
        hachureGap: 4,
        dashOffset: -1,
        dashGap: -1,
        zigzagOffset: -1,
        seed: 90106741,
        combineNestedSvgPaths: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        fill: drawBackgroundColor,
        randomizer: new Random(628450517),
      },
    },
  ] as Drawable[];
  const coordinatesInsideLoop = { x: 616.6000366210938, y: 398.8000183105469 };
  const coordinatesThatHitDrawOutline = { x: 630, y: 410 };
  const zoom = 1;
  return {
    drawWithLoop,
    drawAsShape,
    coordinatesInsideLoop,
    coordinatesThatHitDrawOutline,
    zoom,
  };
}
