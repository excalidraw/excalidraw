import { BBox, bbox } from "./bbox";
import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import {
  isArrowElement,
  isFreeDrawElement,
  isLinearElement,
  isTextElement,
} from "../element/typeChecks";
import { isValueInRange, rotatePoint } from "../math";
import type { Point } from "../types";

type Element = NonDeletedExcalidrawElement;
type Elements = readonly NonDeletedExcalidrawElement[];

type Points = readonly Point[];

/** @returns vertices relative to element's top-left [0,0] position  */
const getNonLinearElementRelativePoints = (
  element: Exclude<
    Element,
    ExcalidrawLinearElement | ExcalidrawFreeDrawElement
  >,
): [TopLeft: Point, TopRight: Point, BottomRight: Point, BottomLeft: Point] => {
  if (element.type === "diamond") {
    return [
      [element.width / 2, 0],
      [element.width, element.height / 2],
      [element.width / 2, element.height],
      [0, element.height / 2],
    ];
  }
  return [
    [0, 0],
    [0 + element.width, 0],
    [0 + element.width, element.height],
    [0, element.height],
  ];
};

/** @returns vertices relative to element's top-left [0,0] position  */
const getElementRelativePoints = (element: ExcalidrawElement): Points => {
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    return element.points;
  }
  return getNonLinearElementRelativePoints(element);
};

const getMinMaxPoints = (points: Points) => {
  const ret = points.reduce(
    (limits, [x, y]) => {
      limits.minY = Math.min(limits.minY, y);
      limits.minX = Math.min(limits.minX, x);

      limits.maxX = Math.max(limits.maxX, x);
      limits.maxY = Math.max(limits.maxY, y);

      return limits;
    },
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      cx: 0,
      cy: 0,
    },
  );

  ret.cx = (ret.maxX + ret.minX) / 2;
  ret.cy = (ret.maxY + ret.minY) / 2;

  return ret;
};

const getRotatedBBox = (element: Element): BBox => {
  const points = getElementRelativePoints(element);

  const { cx, cy } = getMinMaxPoints(points);
  const centerPoint: Point = [cx, cy];

  const rotatedPoints = points.map((point) =>
    rotatePoint([point[0], point[1]], centerPoint, element.angle),
  );
  const { minX, minY, maxX, maxY } = getMinMaxPoints(rotatedPoints);

  return bbox(
    [minX + element.x, minY + element.y],
    [maxX + element.x, maxY + element.y],
  );
};

export const isElementInsideBBox = (
  element: Element,
  bbox: BBox,
  eitherDirection = false,
): boolean => {
  const elementBBox = getRotatedBBox(element);

  const elementInsideBbox =
    bbox[0][0] < elementBBox[0][0] &&
    bbox[1][0] > elementBBox[1][0] &&
    bbox[0][1] < elementBBox[0][1] &&
    bbox[1][1] > elementBBox[1][1];

  if (!eitherDirection) {
    return elementInsideBbox;
  }

  if (elementInsideBbox) {
    return true;
  }

  return (
    elementBBox[0][0] < bbox[0][0] &&
    elementBBox[1][0] > bbox[1][0] &&
    elementBBox[0][1] < bbox[0][1] &&
    elementBBox[1][1] > bbox[1][1]
  );
};

export const elementPartiallyOverlapsWithOrContainsBBox = (
  element: Element,
  bbox: BBox,
): boolean => {
  const elementBBox = getRotatedBBox(element);

  return (
    (isValueInRange(elementBBox[0][0], bbox[0][0], bbox[1][0]) ||
      isValueInRange(bbox[0][0], elementBBox[0][0], elementBBox[1][0])) &&
    (isValueInRange(elementBBox[0][1], bbox[0][1], bbox[1][1]) ||
      isValueInRange(bbox[0][1], elementBBox[0][1], elementBBox[1][1]))
  );
};

export const elementsOverlappingBBox = ({
  elements,
  bounds,
  type,
  errorMargin = 0,
}: {
  elements: Elements;
  bounds: BBox;
  errorMargin: number;
  type: "overlap" | "contain";
}) => {
  const adjustedBBox = bbox(
    [bounds[0][0] - errorMargin, bounds[0][1] - errorMargin],
    [bounds[1][0] + errorMargin, bounds[1][1] + errorMargin],
  );

  const includedElementSet = new Set<string>();

  for (const element of elements) {
    if (includedElementSet.has(element.id)) {
      continue;
    }

    const isOverlaping =
      type === "overlap"
        ? elementPartiallyOverlapsWithOrContainsBBox(element, adjustedBBox)
        : isElementInsideBBox(element, adjustedBBox, true);

    if (isOverlaping) {
      includedElementSet.add(element.id);

      if (element.boundElements) {
        for (const boundElement of element.boundElements) {
          includedElementSet.add(boundElement.id);
        }
      }

      if (isTextElement(element) && element.containerId) {
        includedElementSet.add(element.containerId);
      }

      if (isArrowElement(element)) {
        if (element.startBinding) {
          includedElementSet.add(element.startBinding.elementId);
        }

        if (element.endBinding) {
          includedElementSet.add(element.endBinding?.elementId);
        }
      }
    }
  }

  return elements.filter((element) => includedElementSet.has(element.id));
};

// ### DEBUG

declare global {
  interface Window {
    debug: () => void;
  }
}

window.debug = () => {
  const boundsIndex = window.h.elements.findIndex(
    (e) => e.type === "rectangle" && e.strokeStyle === "dashed",
  );

  if (boundsIndex === -1) {
    return;
  }

  const boundsElement = window.h.elements[boundsIndex];

  const boundsBBox = bbox(
    [boundsElement.x, boundsElement.y],
    [
      boundsElement.x + boundsElement.width,
      boundsElement.y + boundsElement.height,
    ],
  );

  const allElements = [
    ...window.h.elements.slice(0, boundsIndex),
    ...window.h.elements.slice(boundsIndex + 1, window.h.elements.length),
  ];

  const boundedElements = elementsOverlappingBBox({
    elements: allElements,
    bounds: boundsBBox,
    errorMargin: 0,
  }).map((element) => element.id);

  const newElements = allElements.map((element) => {
    if (boundedElements.includes(element.id)) {
      return { ...element, strokeColor: "#ff0000" };
    }

    return { ...element, strokeColor: "#000000" };
  });

  window.h.elements = [boundsElement, ...newElements];
};
