import { BBox, bbox } from "./bbox";
import { NonDeletedExcalidrawElement } from "../element/types";
import {
  isArrowElement,
  isFreeDrawElement,
  isLinearElement,
  isTextElement,
} from "../element/typeChecks";
import { getBoundsFromPoints } from "../element/bounds";
import { rotatePoint } from "../math";
import { Point } from "../types";

type Element = NonDeletedExcalidrawElement;
type Elements = readonly NonDeletedExcalidrawElement[];

function getVertices(bbox: BBox): [Point, Point, Point, Point] {
  return [bbox[0], [bbox[1][0], bbox[0][1]], bbox[1], [bbox[0][0], bbox[1][1]]];
}

function getPrimitiveBBox(element: Element): BBox {
  if (isFreeDrawElement(element)) {
    const [minX, minY, maxX, maxY] = getBoundsFromPoints(element.points);

    return bbox(
      [minX + element.x, minY + element.y],
      [maxX + element.x, maxY + element.y],
    );
  } else if (isLinearElement(element)) {
    const { minX, minY, maxX, maxY } = element.points.reduce(
      (limits, [x, y]) => {
        limits.minY = Math.min(limits.minY, y);
        limits.minX = Math.min(limits.minX, x);

        limits.maxX = Math.max(limits.maxX, x);
        limits.maxY = Math.max(limits.maxY, y);

        return limits;
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    return bbox(
      [element.x + minX, element.y + minY],
      [element.x + maxX, element.y + maxY],
    );
  }

  return bbox(
    [element.x, element.y],
    [element.x + element.width, element.y + element.height],
  );
}

function getElementBBox(element: Element): BBox {
  const primitiveBBox = getPrimitiveBBox(element);

  const centerPoint: Point = [
    primitiveBBox[0][0] + (primitiveBBox[1][0] - primitiveBBox[0][0]) / 2,
    primitiveBBox[0][1] + (primitiveBBox[1][1] - primitiveBBox[0][1]) / 2,
  ];

  const [otl, otr, obr, obl] = getVertices(primitiveBBox);

  const rtl = rotatePoint(otl, centerPoint, element.angle);
  const rbr = rotatePoint(obr, centerPoint, element.angle);
  const rtr = rotatePoint(otr, centerPoint, element.angle);
  const rbl = rotatePoint(obl, centerPoint, element.angle);

  return bbox(
    [
      Math.min(rtl[0], rbr[0], rtr[0], rbl[0]),
      Math.min(rtl[1], rbr[1], rtr[1], rbl[1]),
    ],
    [
      Math.max(rtl[0], rbr[0], rtr[0], rbl[0]),
      Math.max(rtl[1], rbr[1], rtr[1], rbl[1]),
    ],
  );
}

function isElementInsideBBox(element: Element, bbox: BBox): boolean {
  const elementBBox = getElementBBox(element);

  return (
    bbox[0][0] < elementBBox[0][0] &&
    bbox[1][0] > elementBBox[1][0] &&
    bbox[0][1] < elementBBox[0][1] &&
    bbox[1][1] > elementBBox[1][1]
  );
}

function isValueInRange(value: number, min: number, max: number) {
  return value >= min && value <= max;
}

function isElementIntersectingBBox(element: Element, bbox: BBox): boolean {
  const elementBBox = getElementBBox(element);

  return (
    bbox[0][0] < elementBBox[0][0] &&
    bbox[1][0] > elementBBox[1][0] &&
    bbox[0][1] < elementBBox[0][1] &&
    bbox[1][1] > elementBBox[1][1]
  );
}

function isElementContainingBBox(element: Element, bbox: BBox): boolean {
  const elementBBox = getElementBBox(element);

  return (
    (isValueInRange(elementBBox[0][0], bbox[0][0], bbox[1][0]) ||
      isValueInRange(bbox[0][0], elementBBox[0][0], elementBBox[1][0])) &&
    (isValueInRange(elementBBox[0][1], bbox[0][1], bbox[1][1]) ||
      isValueInRange(bbox[0][1], elementBBox[0][1], elementBBox[1][1]))
  );
}

export function isElementOverlappingBBox(element: Element, bbox: BBox) {
  return (
    isElementInsideBBox(element, bbox) ||
    isElementIntersectingBBox(element, bbox) ||
    isElementContainingBBox(element, bbox)
  );
}

export const elementsOverlappingBBox = ({
  elements,
  bounds,
  errorMargin = 0,
}: {
  elements: Elements;
  bounds: BBox;
  errorMargin: number;
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

    const isOverlaping = isElementOverlappingBBox(element, adjustedBBox);

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
