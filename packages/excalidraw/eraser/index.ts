import { arrayToMap, easeOut, THEME } from "@excalidraw/common";
import { getElementLineSegments } from "@excalidraw/element/bounds";
import {
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
} from "@excalidraw/math";

import { simplify } from "points-on-curve";
import { getElementsInGroup } from "@excalidraw/element/groups";

import { getElementShape } from "@excalidraw/element/shapes";
import { shouldTestInside } from "@excalidraw/element/collision";
import { isPointInShape } from "@excalidraw/utils/collision";
import {
  hasBoundTextElement,
  isBoundToContainer,
} from "@excalidraw/element/typeChecks";
import { getBoundTextElementId } from "@excalidraw/element/textElement";

import type { GeometricShape } from "@excalidraw/utils/shape";
import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
} from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animated-trail";

import type { AnimationFrameHandler } from "../animation-frame-handler";

import type App from "../components/App";

export class EraserTrail extends AnimatedTrail {
  private elementsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private groupsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private elementsSegments: Map<string, LineSegment<GlobalPoint>[]> = new Map();
  private shapesCache: Map<string, GeometricShape<GlobalPoint>> = new Map();

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
    // clear any existing trails just in case
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
    let eraserPath = super
      .getCurrentTrail()
      ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1]));

    eraserPath = eraserPath?.slice(eraserPath.length - 20);

    const visibleElementsMap = arrayToMap(this.app.visibleElements);

    if (eraserPath) {
      const simplifiedPath = simplify(
        eraserPath,
        5 / this.app.state.zoom.value,
      ) as GlobalPoint[];

      for (const element of this.app.visibleElements) {
        if (restoreToErase && this.elementsToErase.has(element.id)) {
          const intersects = eraserTest(
            simplifiedPath,
            element,
            this.elementsSegments,
            this.shapesCache,
            visibleElementsMap,
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
            simplifiedPath,
            element,
            this.elementsSegments,
            this.shapesCache,
            visibleElementsMap,
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
    }

    return Array.from(this.elementsToErase);
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.elementsToErase.clear();
    this.groupsToErase.clear();
    this.elementsSegments.clear();
  }
}

const eraserTest = (
  path: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  shapesCache = new Map<string, GeometricShape<GlobalPoint>>(),
  visibleElementsMap = new Map<string, ExcalidrawElement>(),
  app: App,
): boolean => {
  let shape = shapesCache.get(element.id);

  if (!shape) {
    shape = getElementShape<GlobalPoint>(element, visibleElementsMap);
    shapesCache.set(element.id, shape);
  }

  const lastPoint = path[path.length - 1];
  if (shouldTestInside(element) && isPointInShape(lastPoint, shape)) {
    return true;
  }

  let elementSegments = elementsSegments.get(element.id);

  if (!elementSegments) {
    elementSegments = getElementLineSegments(element, visibleElementsMap);
    elementsSegments.set(element.id, elementSegments);
  }

  const pathSegments = path.reduce((acc, point, index) => {
    if (index === 0) {
      return acc;
    }
    acc.push(lineSegment(path[index - 1], point));
    return acc;
  }, [] as LineSegment<GlobalPoint>[]);

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
