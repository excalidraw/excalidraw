import { arrayToMap, type Bounds } from "@excalidraw/common";
import {
  boundsContainBounds,
  doBoundsIntersect,
  elementCenterPoint,
  getBoundTextElement,
  getElementBounds,
  intersectElementWithLineSegment,
  isArrowElement,
  isFreeDrawElement,
  isLinearElement,
  LinearElementEditor,
  pointInsideBounds,
} from "@excalidraw/element";
import { isExcalidrawElement } from "@excalidraw/element";
import {
  type GlobalPoint,
  lineSegment,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

/**
 * High level helper to get elements overlapping a bounding box.
 * It can be used to get elements overlapping a selection box, for example.
 *
 */
export const elementsOverlappingBBox = ({
  elements,
  elementsMap,
  bounds,
  type,
  errorMargin = 0,
}: {
  elements: NonDeletedExcalidrawElement[];
  elementsMap?: ElementsMap;
  bounds: Bounds | ExcalidrawElement;
  errorMargin?: number;
  /**
   * - overlap: elements overlapping or inside bounds
   * - contain: elements inside bounds
   **/
  type: "contain" | "overlap";
}) => {
  if (!elementsMap) {
    elementsMap = arrayToMap(elements);
  }

  const selectionBounds = isExcalidrawElement(bounds)
    ? getElementBounds(bounds, elementsMap)
    : bounds;
  const [selectionX1, selectionY1, selectionX2, selectionY2] = selectionBounds;
  const selectionEdges = [
    lineSegment<GlobalPoint>(
      pointFrom(selectionX1, selectionY1),
      pointFrom(selectionX2, selectionY1),
    ),
    lineSegment<GlobalPoint>(
      pointFrom(selectionX2, selectionY1),
      pointFrom(selectionX2, selectionY2),
    ),
    lineSegment<GlobalPoint>(
      pointFrom(selectionX2, selectionY2),
      pointFrom(selectionX1, selectionY2),
    ),
    lineSegment<GlobalPoint>(
      pointFrom(selectionX1, selectionY2),
      pointFrom(selectionX1, selectionY1),
    ),
  ];

  const elementsInSelection: Set<NonDeletedExcalidrawElement> = new Set();

  for (const element of elements) {
    const strokeWidth = element.strokeWidth;
    let labelAABB: Bounds | null = null;
    let elementAABB = getElementBounds(element, elementsMap);

    elementAABB = [
      elementAABB[0] - strokeWidth / 2,
      elementAABB[1] - strokeWidth / 2,
      elementAABB[2] + strokeWidth / 2,
      elementAABB[3] + strokeWidth / 2,
    ] as Bounds;

    // Whether the element bounds should include the bound text element bounds
    const boundTextElement =
      isArrowElement(element) && getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      const { x, y } = LinearElementEditor.getBoundTextElementPosition(
        element,
        boundTextElement,
        elementsMap,
      );
      labelAABB = [
        x,
        y,
        x + boundTextElement.width,
        y + boundTextElement.height,
      ] as Bounds;
    }

    const commonAABB = labelAABB
      ? ([
          Math.min(labelAABB[0], elementAABB[0]),
          Math.min(labelAABB[1], elementAABB[1]),
          Math.max(labelAABB[2], elementAABB[2]),
          Math.max(labelAABB[3], elementAABB[3]),
        ] as Bounds)
      : elementAABB;

    // ============== Evaluation ==============

    // 1. If the selection box WRAPs the element's AABB, then add it to the
    //    selection and move on, regardless of the selection mode.
    //
    //    PERF: This trick only works with axis-aligned box selection and the
    //          current convex element shapes!
    if (boundsContainBounds(selectionBounds, commonAABB)) {
      elementsInSelection.add(element);
      continue;
    }

    // 2. Handle the case where the label is overlapped by the selection box
    if (
      type === "overlap" &&
      labelAABB &&
      doBoundsIntersect(selectionBounds, labelAABB)
    ) {
      elementsInSelection.add(element);
      continue;
    }

    // 3. Handle the case where the selection is not wrapping the element, but
    //    it does intersect the element's outline (non-AABB).
    if (type === "overlap" && doBoundsIntersect(selectionBounds, elementAABB)) {
      let hasIntersection = false;

      // Preliminary check potential intersection imprecision
      if (isLinearElement(element) || isFreeDrawElement(element)) {
        const center = elementCenterPoint(element, elementsMap);
        hasIntersection = element.points.some((point) => {
          const rotatedPoint = pointRotateRads(
            pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
            center,
            element.angle,
          );

          return pointInsideBounds(rotatedPoint, selectionBounds);
        });
      } else {
        const nonRotatedElementBounds = getElementBounds(
          element,
          elementsMap,
          true,
        );
        const center = elementCenterPoint(element, elementsMap);
        hasIntersection = [
          pointRotateRads(
            pointFrom<GlobalPoint>(
              (nonRotatedElementBounds[0] + nonRotatedElementBounds[2]) / 2,
              nonRotatedElementBounds[1],
            ),
            center,
            element.angle,
          ),
          pointRotateRads(
            pointFrom<GlobalPoint>(
              nonRotatedElementBounds[2],
              (nonRotatedElementBounds[1] + nonRotatedElementBounds[3]) / 2,
            ),
            center,
            element.angle,
          ),
          pointRotateRads(
            pointFrom<GlobalPoint>(
              (nonRotatedElementBounds[0] + nonRotatedElementBounds[2]) / 2,
              nonRotatedElementBounds[3],
            ),
            center,
            element.angle,
          ),
          pointRotateRads(
            pointFrom<GlobalPoint>(
              nonRotatedElementBounds[0],
              (nonRotatedElementBounds[1] + nonRotatedElementBounds[3]) / 2,
            ),
            center,
            element.angle,
          ),
        ].some((point) => {
          return pointInsideBounds(
            pointRotateRads(point, center, element.angle),
            selectionBounds,
          );
        });
      }

      if (!hasIntersection) {
        hasIntersection = selectionEdges.some(
          (selectionEdge) =>
            intersectElementWithLineSegment(
              element,
              elementsMap,
              selectionEdge,
              strokeWidth / 2,
              true, // Stop at first hit for better performance
            ).length > 0,
        );
      }

      if (hasIntersection) {
        elementsInSelection.add(element);
        continue;
      }
    }

    // 4. We don't need to handle when the selection is inside the element
    //    as it is separately handled in App.
  }

  return Array.from(elementsInSelection);
};
