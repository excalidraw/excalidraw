import { easeOut, THEME } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  getBoundTextElement,
  getElementBounds,
  getElementLineSegments,
  getFreedrawOutlineAsSegments,
  getFreedrawOutlinePoints,
  getBoundTextElementId,
  getElementsInGroup,
  hasBoundTextElement,
  hitElementItself,
  intersectElementWithLineSegment,
  isArrowElement,
  isFreeDrawElement,
  isLineElement,
  isBoundToContainer,
  isPointInElement,
  shouldTestInside,
} from "@excalidraw/element";
import {
  lineSegment,
  lineSegmentClosestParameter,
  lineSegmentPointAt,
  lineSegmentsDistance,
  pointFrom,
  pointDistance,
  polygon,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";

import type { GlobalPoint, LineSegment } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animatedTrail";

import type App from "../components/App";

const ERASER_CONTACT_SAMPLE_SIZE = 4;
const ERASER_CONTACT_RADIUS = 2.5;

const getEraserHitThreshold = (element: ExcalidrawElement, zoom: number) => {
  if (isFreeDrawElement(element)) {
    return Math.max(2.25, 5 / zoom);
  }
  if (isArrowElement(element) || (isLineElement(element) && !element.polygon)) {
    return Math.max(element.strokeWidth, (element.strokeWidth * 2) / zoom);
  }
  return ERASER_CONTACT_RADIUS / zoom;
};

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
    const originalPoints = super.getCurrentTrail()?.originalPoints;
    const lastPoint = originalPoints?.at(-1);
    if (!lastPoint) {
      return [];
    }

    const previousPoint = originalPoints?.at(-2) || lastPoint;
    const pathSegment = lineSegment<GlobalPoint>(
      pointFrom<GlobalPoint>(lastPoint[0], lastPoint[1]),
      pointFrom<GlobalPoint>(previousPoint[0], previousPoint[1]),
    );
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const zoom = this.app.state.zoom.value;
    const isStationary =
      pathSegment[0][0] === pathSegment[1][0] &&
      pathSegment[0][1] === pathSegment[1][1];

    // Keep scene order for hit testing; the last intersecting element is topmost.
    const candidates = this.app.visibleElements.filter(
      (element) =>
        !element.locked &&
        ((isStationary &&
          hitElementItself({
            point: pathSegment[0],
            element,
            threshold: ERASER_CONTACT_RADIUS / zoom,
            elementsMap,
          })) ||
          eraserTest(pathSegment, element, elementsMap, zoom)),
    );
    const candidateBounds = candidates.map((element) => {
      const bounds = getElementBounds(element, elementsMap);
      const margin =
        2 * (isFreeDrawElement(element) ? 15 : element.strokeWidth / 2) +
        ERASER_CONTACT_RADIUS / zoom;

      return [
        bounds[0] - margin,
        bounds[1] - margin,
        bounds[2] + margin,
        bounds[3] + margin,
      ] as Bounds;
    });

    const contactParameters = this.getContactParameters(
      pathSegment,
      candidates,
      elementsMap,
      zoom,
    );
    let previousParameter = -1;

    for (const parameter of contactParameters) {
      if (parameter - previousParameter < 1e-6) {
        continue;
      }
      previousParameter = parameter;
      const point = lineSegmentPointAt(pathSegment, parameter);

      for (let index = candidates.length - 1; index >= 0; index--) {
        const element = candidates[index];
        const bounds = candidateBounds[index];
        if (
          point[0] < bounds[0] ||
          point[1] < bounds[1] ||
          point[0] > bounds[2] ||
          point[1] > bounds[3]
        ) {
          continue;
        }
        if (this.isEraserContact(point, element, elementsMap, zoom)) {
          this.updateErasedElement(element, !!restoreToErase);
          break;
        }
      }
    }

    return Array.from(this.elementsToErase);
  }

  private getContactParameters(
    pathSegment: LineSegment<GlobalPoint>,
    candidates: readonly ExcalidrawElement[],
    elementsMap: ElementsMap,
    zoom: number,
  ) {
    const steps = Math.max(
      1,
      Math.ceil(
        (pointDistance(pathSegment[0], pathSegment[1]) * zoom) /
          ERASER_CONTACT_SAMPLE_SIZE,
      ),
    );
    const parameters = Array.from(
      { length: steps + 1 },
      (_, index) => index / steps,
    );

    for (const element of candidates) {
      for (const intersection of intersectElementWithLineSegment(
        element,
        elementsMap,
        pathSegment,
      )) {
        parameters.push(lineSegmentClosestParameter(intersection, pathSegment));
      }
    }

    return parameters.sort((a, b) => a - b);
  }

  private isEraserContact(
    point: GlobalPoint,
    element: ExcalidrawElement,
    elementsMap: ElementsMap,
    zoom: number,
  ) {
    return hitElementItself({
      point,
      element,
      threshold: getEraserHitThreshold(element, zoom),
      elementsMap,
    });
  }

  private updateErasedElement(
    element: ExcalidrawElement,
    restoreToErase: boolean,
  ) {
    const groupId = element.groupIds.at(-1);
    if (restoreToErase) {
      if (!this.elementsToErase.has(element.id)) {
        return;
      }

      if (groupId && this.groupsToErase.has(groupId)) {
        const elementsInGroup = getElementsInGroup(
          this.app.scene.getNonDeletedElementsMap(),
          groupId,
        );
        for (const elementInGroup of elementsInGroup) {
          this.elementsToErase.delete(elementInGroup.id);
        }
        this.groupsToErase.delete(groupId);
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
      return;
    }

    if (groupId && !this.groupsToErase.has(groupId)) {
      const elementsInGroup = getElementsInGroup(
        this.app.scene.getNonDeletedElementsMap(),
        groupId,
      );

      for (const elementInGroup of elementsInGroup) {
        this.elementsToErase.add(elementInGroup.id);
      }
      this.groupsToErase.add(groupId);
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
  const lastPoint = pathSegment[1];

  // PERF: Do a quick bounds intersection test first because it's cheap
  const threshold = isFreeDrawElement(element) ? 15 : element.strokeWidth / 2;
  const segmentBounds = [
    Math.min(pathSegment[0][0], pathSegment[1][0]) - threshold,
    Math.min(pathSegment[0][1], pathSegment[1][1]) - threshold,
    Math.max(pathSegment[0][0], pathSegment[1][0]) + threshold,
    Math.max(pathSegment[0][1], pathSegment[1][1]) + threshold,
  ] as Bounds;
  const origElementBounds = getElementBounds(element, elementsMap);
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
    shouldTestInside(element) &&
    isPointInElement(lastPoint, element, elementsMap)
  ) {
    return true;
  }

  // Freedraw elements are tested for erasure by measuring the distance
  // of the eraser path and the freedraw shape outline lines to a tolerance
  // which offers a good visual precision at various zoom levels
  if (isFreeDrawElement(element)) {
    const outlinePoints = getFreedrawOutlinePoints(element);
    const strokeSegments = getFreedrawOutlineAsSegments(
      element,
      outlinePoints,
      elementsMap,
    );
    const tolerance = getEraserHitThreshold(element, zoom); // NOTE: Visually fine-tuned approximation

    for (const seg of strokeSegments) {
      if (lineSegmentsDistance(seg, pathSegment) <= tolerance) {
        return true;
      }
    }

    const poly = polygon(
      ...(outlinePoints.map(([x, y]) =>
        pointFrom<GlobalPoint>(element.x + x, element.y + y),
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

  const boundTextElement = getBoundTextElement(element, elementsMap);

  if (isArrowElement(element) || (isLineElement(element) && !element.polygon)) {
    const tolerance = getEraserHitThreshold(element, zoom);

    // If the eraser movement is so fast that a large distance is covered
    // between the last two points, the distanceToElement miss, so we test
    // agaist each segment of the linear element
    const segments = getElementLineSegments(element, elementsMap);
    for (const seg of segments) {
      if (lineSegmentsDistance(seg, pathSegment) <= tolerance) {
        return true;
      }
    }

    return false;
  }

  return (
    intersectElementWithLineSegment(element, elementsMap, pathSegment, 0, true)
      .length > 0 ||
    (!!boundTextElement &&
      intersectElementWithLineSegment(
        {
          ...boundTextElement,
          ...computeBoundTextPosition(element, boundTextElement, elementsMap),
        },
        elementsMap,
        pathSegment,
        0,
        true,
      ).length > 0)
  );
};
