import {
  getCommonBounds,
  getElementAbsoluteCoords,
  getElementBounds,
} from "./element";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";
import { getBoundTextElement } from "./element/textElement";
import { arrayToMap } from "./utils";
import { mutateElement } from "./element/mutateElement";
import { AppState } from "./types";
import { getElementsWithinSelection, getSelectedElements } from "./scene";
import { isFrameElement } from "./element";

export const getElementsInFrame = (
  elements: readonly ExcalidrawElement[],
  frameId: string,
) => elements.filter((element) => element.frameId === frameId);

// TODO: include rotation when rotation is enabled
export const isCursorInFrame = (
  cursorCoords: {
    x: number;
    y: number;
  },
  frame: NonDeleted<ExcalidrawFrameElement>,
) => {
  const [fx1, fy1, fx2, fy2] = getElementAbsoluteCoords(frame);

  return isPointWithinBounds(
    [fx1, fy1],
    [cursorCoords.x, cursorCoords.y],
    [fx2, fy2],
  );
};

export const getElementsToUpdateForFrame = (
  selectedElements: NonDeletedExcalidrawElement[],
  predicate: (element: NonDeletedExcalidrawElement) => boolean,
): NonDeletedExcalidrawElement[] => {
  const elementsToUpdate: NonDeletedExcalidrawElement[] = [];

  selectedElements.forEach((element) => {
    if (predicate(element)) {
      elementsToUpdate.push(element);
      // since adding elements to a frame will alter the z-indexes
      // we have to add bound text element to the update array as well
      // to keep the text right next to its container
      const textElement = getBoundTextElement(element);
      if (textElement) {
        elementsToUpdate.push(textElement);
      }
    }
  });

  return elementsToUpdate;
};

export const bindElementsToFramesAfterDuplication = (
  nextElements: ExcalidrawElement[],
  oldElements: readonly ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
) => {
  const nextElementMap = arrayToMap(nextElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;

  oldElements.forEach((element) => {
    if (element.frameId) {
      // use its frameId to get the new frameId
      const nextElementId = oldIdToDuplicatedId.get(element.id);
      const nextFrameId = oldIdToDuplicatedId.get(element.frameId);
      if (nextElementId) {
        const nextElement = nextElementMap.get(nextElementId);
        if (nextElement) {
          mutateElement(nextElement, {
            frameId: nextFrameId ?? null,
          });
        }
      }
    }
  });
};

export const getFramesCountInElements = (
  elements: readonly ExcalidrawElement[],
) => {
  return elements.filter(
    (element) => element.type === "frame" && !element.isDeleted,
  ).length;
};

export const getFrameElementsMap = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const frameElementsMap = new Map<
    ExcalidrawElement["id"],
    {
      frameSelected: boolean;
      elements: ExcalidrawElement[];
    }
  >();

  const selectedElements = arrayToMap(getSelectedElements(elements, appState));

  elements.forEach((element) => {
    if (isFrameElement(element)) {
      frameElementsMap.set(element.id, {
        frameSelected: selectedElements.has(element.id),
        elements: frameElementsMap.has(element.id)
          ? frameElementsMap.get(element.id)?.elements ??
            getElementsInFrame(elements, element.id)
          : getElementsInFrame(elements, element.id),
      });
    } else if (element.frameId) {
      frameElementsMap.set(element.frameId, {
        frameSelected: false,
        elements: frameElementsMap.has(element.frameId)
          ? frameElementsMap.get(element.id)?.elements ??
            getElementsInFrame(elements, element.frameId)
          : getElementsInFrame(elements, element.frameId),
      });
    }
  });

  return frameElementsMap;
};

export const getElementsCompletelyInFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) =>
  getElementsWithinSelection(elements, frame, false).filter(
    (element) =>
      element.type !== "frame" &&
      (!element.frameId || element.frameId === frame.id),
  );

export const getElementsIntersectingFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) =>
  elements.filter((element) =>
    FrameGeometry.isElementIntersectingFrame(element, frame),
  );

export const elementsAreInFrameBounds = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(frame);

  const [elementX1, elementY1, elementX2, elementY2] =
    getCommonBounds(elements);

  return (
    selectionX1 <= elementX1 &&
    selectionY1 <= elementY1 &&
    selectionX2 >= elementX2 &&
    selectionY2 >= elementY2
  );
};

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class LineSegment {
  first: Point;
  second: Point;

  constructor(pointA: Point, pointB: Point) {
    this.first = pointA;
    this.second = pointB;
  }

  public getBoundingBox(): [Point, Point] {
    return [
      new Point(
        Math.min(this.first.x, this.second.x),
        Math.min(this.first.y, this.second.y),
      ),
      new Point(
        Math.max(this.first.x, this.second.x),
        Math.max(this.first.y, this.second.y),
      ),
    ];
  }
}

// https://martin-thoma.com/how-to-check-if-two-line-segments-intersect/
export class FrameGeometry {
  private static EPSILON = 0.000001;

  private static crossProduct(a: Point, b: Point) {
    return a.x * b.y - b.x * a.y;
  }

  private static doBoundingBoxesIntersect(
    a: [Point, Point],
    b: [Point, Point],
  ) {
    return (
      a[0].x <= b[1].x &&
      a[1].x >= b[0].x &&
      a[0].y <= b[1].y &&
      a[1].y >= b[0].y
    );
  }

  private static isPointOnLine(a: LineSegment, b: Point) {
    const aTmp = new LineSegment(
      new Point(0, 0),
      new Point(a.second.x - a.first.x, a.second.y - a.first.y),
    );
    const bTmp = new Point(b.x - a.first.x, b.y - a.first.y);
    const r = this.crossProduct(aTmp.second, bTmp);
    return Math.abs(r) < this.EPSILON;
  }

  private static isPointRightOfLine(a: LineSegment, b: Point) {
    const aTmp = new LineSegment(
      new Point(0, 0),
      new Point(a.second.x - a.first.x, a.second.y - a.first.y),
    );
    const bTmp = new Point(b.x - a.first.x, b.y - a.first.y);
    return this.crossProduct(aTmp.second, bTmp) < 0;
  }

  private static lineSegmentTouchesOrCrossesLine(
    a: LineSegment,
    b: LineSegment,
  ) {
    return (
      this.isPointOnLine(a, b.first) ||
      this.isPointOnLine(a, b.second) ||
      (this.isPointRightOfLine(a, b.first)
        ? !this.isPointRightOfLine(a, b.second)
        : this.isPointRightOfLine(a, b.second))
    );
  }

  private static doLineSegmentsIntersect(
    a: [readonly [number, number], readonly [number, number]],
    b: [readonly [number, number], readonly [number, number]],
  ) {
    const aSegment = new LineSegment(
      new Point(a[0][0], a[0][1]),
      new Point(a[1][0], a[1][1]),
    );
    const bSegment = new LineSegment(
      new Point(b[0][0], b[0][1]),
      new Point(b[1][0], b[1][1]),
    );

    const box1 = aSegment.getBoundingBox();
    const box2 = bSegment.getBoundingBox();
    return (
      this.doBoundingBoxesIntersect(box1, box2) &&
      this.lineSegmentTouchesOrCrossesLine(aSegment, bSegment) &&
      this.lineSegmentTouchesOrCrossesLine(bSegment, aSegment)
    );
  }

  public static isElementIntersectingFrame(
    element: ExcalidrawElement,
    frame: ExcalidrawFrameElement,
  ) {
    const [fx1, fy1, fx2, fy2] = getElementBounds(frame);
    const frameSegments: [[number, number], [number, number]][] = [
      [
        [fx1, fy1],
        [fx2, fy1],
      ],
      [
        [fx1, fy1],
        [fx1, fy2],
      ],
      [
        [fx1, fy2],
        [fx2, fy2],
      ],
      [
        [fx2, fy1],
        [fx2, fy2],
      ],
    ];

    const [x1, y1, x2, y2] = getElementBounds(element);
    const elementSegments: [[number, number], [number, number]][] = [
      [
        [x1, y1],
        [x2, y1],
      ],
      [
        [x1, y1],
        [x1, y2],
      ],
      [
        [x1, y2],
        [x2, y2],
      ],
      [
        [x2, y1],
        [x2, y2],
      ],
    ];

    const intersections = frameSegments.map((frameSegment) =>
      elementSegments.map((lineSegment) =>
        this.doLineSegmentsIntersect(frameSegment, lineSegment),
      ),
    );

    return intersections.flat().some((intersection) => intersection);
  }
}
