import { arrayToMap } from "@excalidraw/common";
import { getElementBounds } from "@excalidraw/element";
import {
  isArrowElement,
  isExcalidrawElement,
  isFreeDrawElement,
  isLinearElement,
  isTextElement,
} from "@excalidraw/element";
import {
  rangeIncludesValue,
  pointFrom,
  pointRotateRads,
  rangeInclusive,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

type Element = NonDeletedExcalidrawElement;
type Elements = readonly NonDeletedExcalidrawElement[];

type Points = readonly LocalPoint[];

/** @returns vertices relative to element's top-left [0,0] position  */
const getNonLinearElementRelativePoints = (
  element: Exclude<
    Element,
    ExcalidrawLinearElement | ExcalidrawFreeDrawElement
  >,
): [
  TopLeft: LocalPoint,
  TopRight: LocalPoint,
  BottomRight: LocalPoint,
  BottomLeft: LocalPoint,
] => {
  if (element.type === "diamond") {
    return [
      pointFrom(element.width / 2, 0),
      pointFrom(element.width, element.height / 2),
      pointFrom(element.width / 2, element.height),
      pointFrom(0, element.height / 2),
    ];
  }
  return [
    pointFrom(0, 0),
    pointFrom(0 + element.width, 0),
    pointFrom(0 + element.width, element.height),
    pointFrom(0, element.height),
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

const getRotatedBBox = (element: Element): Bounds => {
  const points = getElementRelativePoints(element);

  const { cx, cy } = getMinMaxPoints(points);
  const centerPoint = pointFrom<LocalPoint>(cx, cy);

  const rotatedPoints = points.map((p) =>
    pointRotateRads(p, centerPoint, element.angle),
  );
  const { minX, minY, maxX, maxY } = getMinMaxPoints(rotatedPoints);

  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

export const isElementInsideBBox = (
  element: Element,
  bbox: Bounds,
  eitherDirection = false,
): boolean => {
  const elementBBox = getRotatedBBox(element);

  const elementInsideBbox =
    bbox[0] <= elementBBox[0] &&
    bbox[2] >= elementBBox[2] &&
    bbox[1] <= elementBBox[1] &&
    bbox[3] >= elementBBox[3];

  if (!eitherDirection) {
    return elementInsideBbox;
  }

  if (elementInsideBbox) {
    return true;
  }

  return (
    elementBBox[0] <= bbox[0] &&
    elementBBox[2] >= bbox[2] &&
    elementBBox[1] <= bbox[1] &&
    elementBBox[3] >= bbox[3]
  );
};

export const elementPartiallyOverlapsWithOrContainsBBox = (
  element: Element,
  bbox: Bounds,
): boolean => {
  const elementBBox = getRotatedBBox(element);

  return (
    (rangeIncludesValue(elementBBox[0], rangeInclusive(bbox[0], bbox[2])) ||
      rangeIncludesValue(
        bbox[0],
        rangeInclusive(elementBBox[0], elementBBox[2]),
      )) &&
    (rangeIncludesValue(elementBBox[1], rangeInclusive(bbox[1], bbox[3])) ||
      rangeIncludesValue(
        bbox[1],
        rangeInclusive(elementBBox[1], elementBBox[3]),
      ))
  );
};

export const elementsOverlappingBBox = ({
  elements,
  bounds,
  type,
  errorMargin = 0,
}: {
  elements: Elements;
  bounds: Bounds | ExcalidrawElement;
  /** safety offset. Defaults to 0. */
  errorMargin?: number;
  /**
   * - overlap: elements overlapping or inside bounds
   * - contain: elements inside bounds or bounds inside elements
   * - inside: elements inside bounds
   **/
  type: "overlap" | "contain" | "inside";
}) => {
  if (isExcalidrawElement(bounds)) {
    bounds = getElementBounds(bounds, arrayToMap(elements));
  }
  const adjustedBBox: Bounds = [
    bounds[0] - errorMargin,
    bounds[1] - errorMargin,
    bounds[2] + errorMargin,
    bounds[3] + errorMargin,
  ];

  const includedElementSet = new Set<string>();

  for (const element of elements) {
    if (includedElementSet.has(element.id)) {
      continue;
    }

    const isOverlaping =
      type === "overlap"
        ? elementPartiallyOverlapsWithOrContainsBBox(element, adjustedBBox)
        : type === "inside"
        ? isElementInsideBBox(element, adjustedBBox)
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
