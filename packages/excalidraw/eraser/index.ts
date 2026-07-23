import { arrayToMap, easeOut, THEME } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  getBoundTextElement,
  getElementBounds,
  getElementLineSegments,
  getFreedrawOutlineAsSegments,
  getFreedrawOutlinePoints,
  intersectElementWithLineSegment,
  isArrowElement,
  isFreeDrawElement,
  isLineElement,
  isPointInElement,
  isTextElement,
} from "@excalidraw/element";
import {
  lineSegment,
  lineSegmentsDistance,
  pointFrom,
  polygon,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { getElementsInGroup } from "@excalidraw/element";

import { shouldTestInside } from "@excalidraw/element";
import { hasBoundTextElement, isBoundToContainer } from "@excalidraw/element";
import { getBoundTextElementId } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";

import type { GlobalPoint, LineSegment } from "@excalidraw/math/types";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";

import { AnimatedTrail } from "../animatedTrail";

import type App from "../components/App";

export class EraserTrail extends AnimatedTrail {
  private elementsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private groupsToErase: Set<ExcalidrawElement["id"]> = new Set();

  constructor(app: App) {
    super(app, {
      streamline: 0.2,
      size: 5,
      keepHead: true,
      sizeMapping: (c) => {
        const DECAY_TIME = 200;
        const DECAY_LENGTH = 10;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
      fill: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(0, 0, 0, 0.2)"
          : "rgba(255, 255, 255, 0.2)",
    });
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
    this.elementsToErase.clear();
  }

  addPointToPath(x: number, y: number, restore = false) {
    super.addPointToPath(x, y);

    const elementsToEraser = this.updateElementsToBeErased(restore);

    return elementsToEraser;
  }

  private updateElementsToBeErased(restoreToErase?: boolean) {
    const eraserPath: GlobalPoint[] =
      super
        .getCurrentTrail()
        ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1])) || [];

    if (eraserPath.length < 2) {
      return [];
    }

    // for efficiency and avoid unnecessary calculations,
    // take only POINTS_ON_TRAIL points to form some number of segments
    const pathSegment = lineSegment<GlobalPoint>(
      eraserPath[eraserPath.length - 1],
      eraserPath[eraserPath.length - 2],
    );

    const candidateElements = this.app.visibleElements.filter(
      (el) => !el.locked,
    );

    const candidateElementsMap = arrayToMap(candidateElements);

    for (const element of candidateElements) {
      // restore only if already added to the to-be-erased set
      if (restoreToErase && this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegment,
          element,
          candidateElementsMap,
          this.app.state.zoom.value,
        );

        if (intersects) {
          const shallowestGroupId = element.groupIds.at(-1)!;

          if (this.groupsToErase.has(shallowestGroupId)) {
            const elementsInGroup = getElementsInGroup(
              this.app.scene.getNonDeletedElementsMap(),
              shallowestGroupId,
            );
            for (const elementInGroup of elementsInGroup) {
              this.elementsToErase.delete(elementInGroup.id);
            }
            this.groupsToErase.delete(shallowestGroupId);
          }

          if (isBoundToContainer(element)) {
            this.elementsToErase.delete(element.containerId);
          }

          if (hasBoundTextElement(element)) {
            const boundText = getBoundTextElementId(element);

            if (boundText) {
              this.elementsToErase.delete(boundText);
            }
          }

          this.elementsToErase.delete(element.id);
        }
      } else if (!restoreToErase && !this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegment,
          element,
          candidateElementsMap,
          this.app.state.zoom.value,
        );

        if (intersects) {
          const shallowestGroupId = element.groupIds.at(-1)!;

          if (!this.groupsToErase.has(shallowestGroupId)) {
            const elementsInGroup = getElementsInGroup(
              this.app.scene.getNonDeletedElementsMap(),
              shallowestGroupId,
            );

            for (const elementInGroup of elementsInGroup) {
              this.elementsToErase.add(elementInGroup.id);
            }
            this.groupsToErase.add(shallowestGroupId);
          }

          if (hasBoundTextElement(element)) {
            const boundText = getBoundTextElementId(element);

            if (boundText) {
              this.elementsToErase.add(boundText);
            }
          }

          if (isBoundToContainer(element)) {
            this.elementsToErase.add(element.containerId);
          }

          this.elementsToErase.add(element.id);
        }
      }
    }

    return Array.from(this.elementsToErase);
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.elementsToErase.clear();
    this.groupsToErase.clear();
  }
}

const eraserTest = (
  pathSegment: LineSegment<GlobalPoint>,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  zoom: number,
): boolean => {
  let targetElement = element;

  if (isTextElement(targetElement) && isBoundToContainer(targetElement)) {
    const container = elementsMap.get(targetElement.containerId);
    if (container) {
      targetElement = {
        ...targetElement,
        ...computeBoundTextPosition(
          container,
          targetElement as ExcalidrawTextElementWithContainer,
          elementsMap,
        ),
      };
    }
  }

  const lastPoint = pathSegment[1];

  // PERF: Do a quick bounds intersection test first because it's cheap
  const threshold = isFreeDrawElement(targetElement) ? 15 : targetElement.strokeWidth / 2;
  const segmentBounds = [
    Math.min(pathSegment[0][0], pathSegment[1][0]) - threshold,
    Math.min(pathSegment[0][1], pathSegment[1][1]) - threshold,
    Math.max(pathSegment[0][0], pathSegment[1][0]) + threshold,
    Math.max(pathSegment[0][1], pathSegment[1][1]) + threshold,
  ] as Bounds;
  const origElementBounds = getElementBounds(targetElement, elementsMap);
  const elementBounds: Bounds = [
    origElementBounds[0] - threshold,
    origElementBounds[1] - threshold,
    origElementBounds[2] + threshold,
    origElementBounds[3] + threshold,
  ];

  if (!doBoundsIntersect(segmentBounds, elementBounds)) {
    return false;
  }

  // There are shapes where the inner area should trigger erasing
  // even though the eraser path segment doesn't intersect with or
  // get close to the shape's stroke
  if (
    shouldTestInside(targetElement) &&
    isPointInElement(lastPoint, targetElement, elementsMap)
  ) {
    return true;
  }

  // Freedraw elements are tested for erasure by measuring the distance
  // of the eraser path and the freedraw shape outline lines to a tolerance
  // which offers a good visual precision at various zoom levels
  if (isFreeDrawElement(targetElement)) {
    const outlinePoints = getFreedrawOutlinePoints(targetElement);
    const strokeSegments = getFreedrawOutlineAsSegments(
      targetElement,
      outlinePoints,
      elementsMap,
    );
    const tolerance = Math.max(2.25, 5 / zoom); // NOTE: Visually fine-tuned approximation

    for (const seg of strokeSegments) {
      if (lineSegmentsDistance(seg, pathSegment) <= tolerance) {
        return true;
      }
    }

    const poly = polygon(
      ...(outlinePoints.map(([x, y]) =>
        pointFrom<GlobalPoint>(targetElement.x + x, targetElement.y + y),
      ) as GlobalPoint[]),
    );

    // PERF: Check only one point of the eraser segment. If the eraser segment
    // start is inside the closed freedraw shape, the other point is either also
    // inside or the eraser segment will intersect the shape outline anyway
    if (polygonIncludesPointNonZero(pathSegment[0], poly)) {
      return true;
    }

    return false;
  }

  const boundTextElement = getBoundTextElement(targetElement, elementsMap);

  if (isArrowElement(targetElement) || (isLineElement(targetElement) && !targetElement.polygon)) {
    const tolerance = Math.max(
      targetElement.strokeWidth,
      (targetElement.strokeWidth * 2) / zoom,
    );

    // If the eraser movement is so fast that a large distance is covered
    // between the last two points, the distanceToElement miss, so we test
    // agaist each segment of the linear element
    const segments = getElementLineSegments(targetElement, elementsMap);
    for (const seg of segments) {
      if (lineSegmentsDistance(seg, pathSegment) <= tolerance) {
        return true;
      }
    }

    return false;
  }

  return (
    intersectElementWithLineSegment(targetElement, elementsMap, pathSegment, 0, true)
      .length > 0 ||
    (!!boundTextElement &&
      intersectElementWithLineSegment(
        {
          ...boundTextElement,
          ...computeBoundTextPosition(targetElement, boundTextElement, elementsMap),
        },
        elementsMap,
        pathSegment,
        0,
        true,
      ).length > 0)
  );
};
