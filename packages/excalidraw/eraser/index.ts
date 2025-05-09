import { arrayToMap, easeOut, THEME } from "@excalidraw/common";
import { getElementLineSegments } from "@excalidraw/element";
import {
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
} from "@excalidraw/math";

import { getElementsInGroup } from "@excalidraw/element";

import { getElementShape } from "@excalidraw/element";
import { shouldTestInside } from "@excalidraw/element";
import { isPointInShape } from "@excalidraw/utils/collision";
import { hasBoundTextElement, isBoundToContainer } from "@excalidraw/element";
import { getBoundTextElementId } from "@excalidraw/element";

import type { GeometricShape } from "@excalidraw/utils/shape";
import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
} from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animated-trail";

import type { AnimationFrameHandler } from "../animation-frame-handler";

import type App from "../components/App";

// just enough to form a segment; this is sufficient for eraser
const POINTS_ON_TRAIL = 2;

export class EraserTrail extends AnimatedTrail {
  private elementsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private groupsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private segmentsCache: Map<string, LineSegment<GlobalPoint>[]> = new Map();
  private geometricShapesCache: Map<string, GeometricShape<GlobalPoint>> =
    new Map();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
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
    let eraserPath: GlobalPoint[] =
      super
        .getCurrentTrail()
        ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1])) || [];

    // for efficiency and avoid unnecessary calculations,
    // take only POINTS_ON_TRAIL points to form some number of segments
    eraserPath = eraserPath?.slice(eraserPath.length - POINTS_ON_TRAIL);

    const candidateElements = this.app.visibleElements.filter(
      (el) => !el.locked,
    );

    const candidateElementsMap = arrayToMap(candidateElements);

    const pathSegments = eraserPath.reduce((acc, point, index) => {
      if (index === 0) {
        return acc;
      }
      acc.push(lineSegment(eraserPath[index - 1], point));
      return acc;
    }, [] as LineSegment<GlobalPoint>[]);

    if (pathSegments.length === 0) {
      return [];
    }

    for (const element of candidateElements) {
      // restore only if already added to the to-be-erased set
      if (restoreToErase && this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegments,
          element,
          this.segmentsCache,
          this.geometricShapesCache,
          candidateElementsMap,
          this.app,
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
          pathSegments,
          element,
          this.segmentsCache,
          this.geometricShapesCache,
          candidateElementsMap,
          this.app,
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
    this.segmentsCache.clear();
  }
}

const eraserTest = (
  pathSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  shapesCache: Map<string, GeometricShape<GlobalPoint>>,
  elementsMap: ElementsMap,
  app: App,
): boolean => {
  let shape = shapesCache.get(element.id);

  if (!shape) {
    shape = getElementShape<GlobalPoint>(element, elementsMap);
    shapesCache.set(element.id, shape);
  }

  const lastPoint = pathSegments[pathSegments.length - 1][1];
  if (shouldTestInside(element) && isPointInShape(lastPoint, shape)) {
    return true;
  }

  let elementSegments = elementsSegments.get(element.id);

  if (!elementSegments) {
    elementSegments = getElementLineSegments(element, elementsMap);
    elementsSegments.set(element.id, elementSegments);
  }

  return pathSegments.some((pathSegment) =>
    elementSegments?.some(
      (elementSegment) =>
        lineSegmentIntersectionPoints(
          pathSegment,
          elementSegment,
          app.getElementHitThreshold(),
        ) !== null,
    ),
  );
};
