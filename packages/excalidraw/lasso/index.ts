import { arrayToMap, THEME } from "@excalidraw/common";

import {
  doBoundsIntersect,
  getElementBounds,
  getElementLineSegments,
  intersectElementWithLineSegment,
  isFrameLikeElement,
  getContainingFrame,
  getFrameChildren,
} from "@excalidraw/element";
import {
  lineSegment,
  pointFrom,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { getElementsInGroup } from "@excalidraw/element";

import { hasBoundTextElement, isBoundToContainer } from "@excalidraw/element";
import { getBoundTextElementId } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";

import type { GlobalPoint, LineSegment } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animated-trail";

import type { AnimationFrameHandler } from "../animation-frame-handler";

import type App from "../components/App";

export class LassoTrail extends AnimatedTrail {
  private elementsToSelect: Set<ExcalidrawElement["id"]> = new Set();
  private groupsToSelect: Set<string> = new Set();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      streamline: 0.2,
      size: 1,
      keepHead: true,
      animateTrail: true,
      fill: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(105, 101, 219, 0.05)"
          : "rgba(180, 175, 255, 0.05)",
      stroke: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(105, 101, 219, 0.8)"
          : "rgba(180, 175, 255, 0.8)",
    });
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
    this.elementsToSelect.clear();
    this.groupsToSelect.clear();
  }

  addPointToPath(x: number, y: number): string[] {
    super.addPointToPath(x, y);
    return this.updateElementsToBeSelected();
  }

  endPath(): string[] {
    const result = Array.from(this.elementsToSelect);
    super.endPath();
    super.clearTrails();
    this.elementsToSelect.clear();
    this.groupsToSelect.clear();
    return result;
  }

  private updateElementsToBeSelected(): string[] {
    const lassoPath: GlobalPoint[] =
      super
        .getCurrentTrail()
        ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1])) || [];

    if (lassoPath.length < 3) {
      return Array.from(this.elementsToSelect);
    }

    // Calculate lasso bounding box for fast rejection
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of lassoPath) {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    }
    const lassoBounds: Bounds = [minX, minY, maxX, maxY];

    // Build lasso edges for intersection tests
    const lassoEdges: LineSegment<GlobalPoint>[] = [];
    for (let i = 0; i < lassoPath.length - 1; i++) {
      lassoEdges.push(lineSegment<GlobalPoint>(lassoPath[i], lassoPath[i + 1]));
    }
    // Close the polygon
    if (lassoPath.length > 2) {
      lassoEdges.push(
        lineSegment<GlobalPoint>(
          lassoPath[lassoPath.length - 1],
          lassoPath[0],
        ),
      );
    }

    this.elementsToSelect.clear();
    this.groupsToSelect.clear();

    const candidateElements = this.app.visibleElements.filter(
      (el) => !el.locked && !isBoundToContainer(el),
    );

    const candidateElementsMap = arrayToMap(candidateElements);

    for (const element of candidateElements) {
      const elementBounds = getElementBounds(element, candidateElementsMap);

      // Fast reject: skip if element bounds don't overlap with lasso bounds
      if (!doBoundsIntersect(lassoBounds, elementBounds)) {
        continue;
      }

      const isInside = this.isElementInsideLasso(
        element,
        elementBounds,
        lassoPath,
        lassoEdges,
        candidateElementsMap,
      );

      if (isInside) {
        this.addElementToSelection(element, candidateElementsMap);
      }
    }

    return Array.from(this.elementsToSelect);
  }

  private isElementInsideLasso(
    element: ExcalidrawElement,
    elementBounds: Bounds,
    lassoPath: GlobalPoint[],
    lassoEdges: LineSegment<GlobalPoint>[],
    elementsMap: ElementsMap,
  ): boolean {
    // Test 1: Check if all corners of the element bounds are inside the lasso polygon
    const [x1, y1, x2, y2] = elementBounds;
    const corners: GlobalPoint[] = [
      pointFrom<GlobalPoint>(x1, y1),
      pointFrom<GlobalPoint>(x2, y1),
      pointFrom<GlobalPoint>(x2, y2),
      pointFrom<GlobalPoint>(x1, y2),
    ];

    const allCornersInside = corners.every((corner) =>
      polygonIncludesPointNonZero(corner, lassoPath),
    );

    if (allCornersInside) {
      return true;
    }

    // Test 2: Check if any lasso edge intersects the element's outline
    const elementSegments = getElementLineSegments(element, elementsMap);

    for (const lassoEdge of lassoEdges) {
      if (
        intersectElementWithLineSegment(element, elementsMap, lassoEdge, 0, true)
          .length > 0
      ) {
        return true;
      }
    }

    // Test 3: Check if any element segment endpoint is inside the lasso
    for (const seg of elementSegments) {
      if (polygonIncludesPointNonZero(seg[0], lassoPath)) {
        return true;
      }
    }

    return false;
  }

  private addElementToSelection(
    element: ExcalidrawElement,
    elementsMap: ElementsMap,
  ): void {
    // Handle frames: select frame as unit, not children individually
    const containingFrame = getContainingFrame(element, elementsMap);
    if (containingFrame && this.elementsToSelect.has(containingFrame.id)) {
      // Frame already selected; children will be included via frame
      return;
    }

    // If this element IS a frame, add it and skip its children
    if (isFrameLikeElement(element)) {
      this.elementsToSelect.add(element.id);
      return;
    }

    // Handle groups: select all members of the shallowest group
    const shallowestGroupId = element.groupIds.at(-1);
    if (shallowestGroupId && !this.groupsToSelect.has(shallowestGroupId)) {
      const elementsInGroup = getElementsInGroup(
        this.app.scene.getNonDeletedElementsMap(),
        shallowestGroupId,
      );
      for (const elementInGroup of elementsInGroup) {
        this.elementsToSelect.add(elementInGroup.id);
      }
      this.groupsToSelect.add(shallowestGroupId);
    }

    // Handle bound text: select container (text selects its container)
    if (isBoundToContainer(element)) {
      this.elementsToSelect.add(element.containerId);
      return;
    }

    // Handle elements with bound text: also select the text
    if (hasBoundTextElement(element)) {
      const boundTextId = getBoundTextElementId(element);
      if (boundTextId) {
        this.elementsToSelect.add(boundTextId);
      }
    }

    this.elementsToSelect.add(element.id);
  }
}
