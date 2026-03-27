import { arrayToMap, isShallowEqual, type Bounds } from "@excalidraw/common";
import {
  lineSegment,
  pointFrom,
  type GlobalPoint,
  type LineSegment,
} from "@excalidraw/math";

import type {
  AppState,
  BoxSelectionMode,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import {
  getElementAbsoluteCoords,
  getElementBounds,
  getElementLineSegments,
} from "./bounds";
import {
  doBoundsIntersectElementBoundingBox,
  intersectElementWithLineSegment,
  shouldTestInside,
} from "./collision";
import { isElementInViewport } from "./sizeHelpers";
import {
  isBoundToContainer,
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import {
  elementOverlapsWithFrame,
  getContainingFrame,
  getFrameChildren,
} from "./frame";

import { LinearElementEditor } from "./linearElementEditor";
import { selectGroupsForSelectedElements } from "./groups";

import type {
  ElementsMap,
  ElementsMapOrArray,
  ExcalidrawElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./types";

// Broad-phase only for overlap mode. This decides whether plain AABB overlap
// should be refined via the element's rotated local bounds. Elements that fail
// `shouldTestInside()` still go through the outline-specific path below, so
// this is intentionally not the whole overlap-selection policy.
const shouldUseRotatedOverlapBroadPhase = (
  element: NonDeletedExcalidrawElement,
) =>
  element.angle !== 0 &&
  (isTextElement(element) ||
    element.type === "freedraw" ||
    element.type === "image");

const clipLineSegmentToBounds = (
  segment: LineSegment<GlobalPoint>,
  bounds: Bounds,
): LineSegment<GlobalPoint> | null => {
  const [minX, minY, maxX, maxY] = bounds;
  const [[x1, y1], [x2, y2]] = segment;
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  let tMin = 0;
  let tMax = 1;

  const clip = (p: number, q: number) => {
    if (p === 0) {
      return q >= 0;
    }

    const ratio = q / p;

    if (p < 0) {
      if (ratio > tMax) {
        return false;
      }
      tMin = Math.max(tMin, ratio);
      return true;
    }

    if (ratio < tMin) {
      return false;
    }
    tMax = Math.min(tMax, ratio);
    return true;
  };

  if (
    !clip(-deltaX, x1 - minX) ||
    !clip(deltaX, maxX - x1) ||
    !clip(-deltaY, y1 - minY) ||
    !clip(deltaY, maxY - y1)
  ) {
    return null;
  }

  return lineSegment(
    pointFrom<GlobalPoint>(x1 + tMin * deltaX, y1 + tMin * deltaY),
    pointFrom<GlobalPoint>(x1 + tMax * deltaX, y1 + tMax * deltaY),
  );
};

const isPointWithinAabb = (point: GlobalPoint, bounds: Bounds) =>
  point[0] >= bounds[0] &&
  point[0] <= bounds[2] &&
  point[1] >= bounds[1] &&
  point[1] <= bounds[3];

const shouldSkipElementFromSelection = (element: NonDeletedExcalidrawElement) =>
  element.locked || element.type === "selection" || isBoundToContainer(element);

const getFrameBoundsForSelection = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
): Bounds | null => {
  if (!element.frameId) {
    return null;
  }

  const containingFrame = getContainingFrame(element, elementsMap);
  return containingFrame
    ? (getElementBounds(containingFrame, elementsMap) as Bounds)
    : null;
};

const finalizeElementsInSelection = (
  elementsInSelection: NonDeletedExcalidrawElement[],
  excludeElementsInFrames: boolean,
  elementsMap: ElementsMap,
): NonDeletedExcalidrawElement[] => {
  elementsInSelection = excludeElementsInFrames
    ? excludeElementsInFramesFromSelection(elementsInSelection)
    : elementsInSelection;

  return elementsInSelection.filter((element) => {
    const containingFrame = getContainingFrame(element, elementsMap);

    if (containingFrame) {
      return elementOverlapsWithFrame(element, containingFrame, elementsMap);
    }

    return true;
  });
};

const getSelectionEdges = (
  selectionBounds: Bounds,
): readonly LineSegment<GlobalPoint>[] => {
  const selectionTopLeft = pointFrom<GlobalPoint>(
    selectionBounds[0],
    selectionBounds[1],
  );
  const selectionBottomRight = pointFrom<GlobalPoint>(
    selectionBounds[2],
    selectionBounds[3],
  );

  return [
    lineSegment(
      selectionTopLeft,
      pointFrom<GlobalPoint>(selectionBounds[2], selectionBounds[1]),
    ),
    lineSegment(
      pointFrom<GlobalPoint>(selectionBounds[2], selectionBounds[1]),
      selectionBottomRight,
    ),
    lineSegment(
      selectionBottomRight,
      pointFrom<GlobalPoint>(selectionBounds[0], selectionBounds[3]),
    ),
    lineSegment(
      pointFrom<GlobalPoint>(selectionBounds[0], selectionBounds[3]),
      selectionTopLeft,
    ),
  ];
};

const getVisibleElementOutlineSegments = (
  element: NonDeletedExcalidrawElement,
  frameBounds: Bounds | null,
  elementsMap: ElementsMap,
) =>
  frameBounds
    ? getElementLineSegments(element, elementsMap).flatMap((segment) => {
        const clippedSegment = clipLineSegmentToBounds(segment, frameBounds);
        return clippedSegment ? [clippedSegment] : [];
      })
    : getElementLineSegments(element, elementsMap);

const doesSelectionIntersectElementOutline = (
  element: NonDeletedExcalidrawElement,
  frameBounds: Bounds | null,
  selectionEdges: readonly LineSegment<GlobalPoint>[],
  elementsMap: ElementsMap,
) =>
  selectionEdges.some((selectionEdge) =>
    intersectElementWithLineSegment(
      element,
      elementsMap,
      selectionEdge,
      0,
      true,
    ).some((point) => !frameBounds || isPointWithinAabb(point, frameBounds)),
  );

const doesSelectionContainElementOutline = (
  outlineSegments: readonly LineSegment<GlobalPoint>[],
  selectionBounds: Bounds,
) =>
  outlineSegments.length > 0 &&
  outlineSegments.every(
    (outlineSegment) =>
      isPointWithinAabb(outlineSegment[0], selectionBounds) &&
      isPointWithinAabb(outlineSegment[1], selectionBounds),
  );

/**
 * Frames and their containing elements are not to be selected at the same time.
 * Given an array of selected elements, if there are frames and their containing elements
 * we only keep the frames.
 * @param selectedElements
 */
export const excludeElementsInFramesFromSelection = <
  T extends ExcalidrawElement,
>(
  selectedElements: readonly T[],
) => {
  const framesInSelection = new Set<T["id"]>();

  selectedElements.forEach((element) => {
    if (isFrameLikeElement(element)) {
      framesInSelection.add(element.id);
    }
  });

  return selectedElements.filter((element) => {
    if (element.frameId && framesInSelection.has(element.frameId)) {
      return false;
    }
    return true;
  });
};

export const getElementsWithinSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  excludeElementsInFrames: boolean = true,
  boxSelectionMode: BoxSelectionMode = "contain",
): NonDeletedExcalidrawElement[] => {
  const [selectionStartX, selectionStartY, selectionEndX, selectionEndY] =
    getElementAbsoluteCoords(selection, elementsMap);
  const selectionX1 = Math.min(selectionStartX, selectionEndX);
  const selectionY1 = Math.min(selectionStartY, selectionEndY);
  const selectionX2 = Math.max(selectionStartX, selectionEndX);
  const selectionY2 = Math.max(selectionStartY, selectionEndY);
  const selectionBounds = [
    selectionX1,
    selectionY1,
    selectionX2,
    selectionY2,
  ] as Bounds;

  if (boxSelectionMode !== "overlap") {
    const elementsInSelection: NonDeletedExcalidrawElement[] = [];

    for (const element of elements) {
      if (shouldSkipElementFromSelection(element)) {
        continue;
      }

      const elementBounds = getElementBounds(element, elementsMap) as Bounds;
      const frameBounds = getFrameBoundsForSelection(element, elementsMap);
      let elementX1 = elementBounds[0];
      let elementY1 = elementBounds[1];
      let elementX2 = elementBounds[2];
      let elementY2 = elementBounds[3];

      if (frameBounds) {
        elementX1 = Math.max(frameBounds[0], elementX1);
        elementY1 = Math.max(frameBounds[1], elementY1);
        elementX2 = Math.min(frameBounds[2], elementX2);
        elementY2 = Math.min(frameBounds[3], elementY2);
      }

      if (
        selectionX1 <= elementX1 &&
        selectionY1 <= elementY1 &&
        selectionX2 >= elementX2 &&
        selectionY2 >= elementY2
      ) {
        elementsInSelection.push(element);
      }
    }

    return finalizeElementsInSelection(
      elementsInSelection,
      excludeElementsInFrames,
      elementsMap,
    );
  }

  const selectionEdges = getSelectionEdges(selectionBounds);
  const elementsInSelection: NonDeletedExcalidrawElement[] = [];

  for (const element of elements) {
    if (shouldSkipElementFromSelection(element)) {
      continue;
    }

    const elementBounds = getElementBounds(element, elementsMap) as Bounds;
    const frameBounds = getFrameBoundsForSelection(element, elementsMap);
    let elementX1 = elementBounds[0];
    let elementY1 = elementBounds[1];
    let elementX2 = elementBounds[2];
    let elementY2 = elementBounds[3];

    if (frameBounds) {
      elementX1 = Math.max(frameBounds[0], elementX1);
      elementY1 = Math.max(frameBounds[1], elementY1);
      elementX2 = Math.min(frameBounds[2], elementX2);
      elementY2 = Math.min(frameBounds[3], elementY2);
    }

    const isSelectionContainingElement =
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2;

    const isSelectionOverlappingElementAabb =
      selectionX1 <= elementX2 &&
      selectionY1 <= elementY2 &&
      selectionX2 >= elementX1 &&
      selectionY2 >= elementY1;
    const isSelectionOverlappingElement = shouldUseRotatedOverlapBroadPhase(
      element,
    )
      ? isSelectionOverlappingElementAabb &&
        doBoundsIntersectElementBoundingBox(
          selectionBounds,
          element,
          elementsMap,
        )
      : isSelectionOverlappingElementAabb;

    const shouldSelectFromInside = shouldTestInside(element);

    if (shouldSelectFromInside) {
      if (isSelectionOverlappingElement) {
        elementsInSelection.push(element);
      }
      continue;
    }

    if (!isSelectionOverlappingElement) {
      continue;
    }

    if (isSelectionContainingElement) {
      elementsInSelection.push(element);
      continue;
    }

    if (
      doesSelectionIntersectElementOutline(
        element,
        frameBounds,
        selectionEdges,
        elementsMap,
      )
    ) {
      elementsInSelection.push(element);
      continue;
    }

    const outlineSegments = getVisibleElementOutlineSegments(
      element,
      frameBounds,
      elementsMap,
    );

    if (
      outlineSegments.length > 0 &&
      doesSelectionContainElementOutline(outlineSegments, selectionBounds)
    ) {
      elementsInSelection.push(element);
    }
  }

  return finalizeElementsInSelection(
    elementsInSelection,
    excludeElementsInFrames,
    elementsMap,
  );
};

export const getVisibleAndNonSelectedElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  const selectedElementsSet = new Set(
    selectedElements.map((element) => element.id),
  );
  return elements.filter((element) => {
    const isVisible = isElementInViewport(
      element,
      appState.width,
      appState.height,
      appState,
      elementsMap,
    );

    return !selectedElementsSet.has(element.id) && isVisible;
  });
};

// FIXME move this into the editor instance to keep utility methods stateless
export const isSomeElementSelected = (function () {
  let lastElements: readonly NonDeletedExcalidrawElement[] | null = null;
  let lastSelectedElementIds: AppState["selectedElementIds"] | null = null;
  let isSelected: boolean | null = null;

  const ret = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: Pick<AppState, "selectedElementIds">,
  ): boolean => {
    if (
      isSelected != null &&
      elements === lastElements &&
      appState.selectedElementIds === lastSelectedElementIds
    ) {
      return isSelected;
    }

    isSelected = elements.some(
      (element) => appState.selectedElementIds[element.id],
    );
    lastElements = elements;
    lastSelectedElementIds = appState.selectedElementIds;

    return isSelected;
  };

  ret.clearCache = () => {
    lastElements = null;
    lastSelectedElementIds = null;
    isSelected = null;
  };

  return ret;
})();

export const getSelectedElements = (
  elements: ElementsMapOrArray,
  appState: Pick<InteractiveCanvasAppState, "selectedElementIds">,
  opts?: {
    includeBoundTextElement?: boolean;
    includeElementsInFrames?: boolean;
  },
) => {
  const addedElements = new Set<ExcalidrawElement["id"]>();
  const selectedElements: ExcalidrawElement[] = [];
  for (const element of elements.values()) {
    if (appState.selectedElementIds[element.id]) {
      selectedElements.push(element);
      addedElements.add(element.id);
      continue;
    }
    if (
      opts?.includeBoundTextElement &&
      isBoundToContainer(element) &&
      appState.selectedElementIds[element?.containerId]
    ) {
      selectedElements.push(element);
      addedElements.add(element.id);
      continue;
    }
  }

  if (opts?.includeElementsInFrames) {
    const elementsToInclude: ExcalidrawElement[] = [];
    selectedElements.forEach((element) => {
      if (isFrameLikeElement(element)) {
        getFrameChildren(elements, element.id).forEach(
          (e) => !addedElements.has(e.id) && elementsToInclude.push(e),
        );
      }
      elementsToInclude.push(element);
    });

    return elementsToInclude;
  }

  return selectedElements;
};

export const getTargetElements = (
  elements: ElementsMapOrArray,
  appState: Pick<
    AppState,
    "selectedElementIds" | "editingTextElement" | "newElement"
  >,
) =>
  appState.editingTextElement
    ? [appState.editingTextElement]
    : appState.newElement
    ? [appState.newElement]
    : getSelectedElements(elements, appState, {
        includeBoundTextElement: true,
      });

/**
 * returns prevState's selectedElementids if no change from previous, so as to
 * retain reference identity for memoization
 */
export const makeNextSelectedElementIds = (
  nextSelectedElementIds: AppState["selectedElementIds"],
  prevState: Pick<AppState, "selectedElementIds">,
) => {
  if (isShallowEqual(prevState.selectedElementIds, nextSelectedElementIds)) {
    return prevState.selectedElementIds;
  }

  return nextSelectedElementIds;
};

const _getLinearElementEditor = (
  targetElements: readonly ExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
) => {
  const linears = targetElements.filter(isLinearElement);
  if (linears.length === 1) {
    const linear = linears[0];
    const boundElements = linear.boundElements?.map((def) => def.id) ?? [];
    const onlySingleLinearSelected = targetElements.every(
      (el) => el.id === linear.id || boundElements.includes(el.id),
    );

    if (onlySingleLinearSelected) {
      return new LinearElementEditor(linear, arrayToMap(allElements));
    }
  }

  return null;
};

export const getSelectionStateForElements = (
  targetElements: readonly ExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  return {
    selectedLinearElement: _getLinearElementEditor(targetElements, allElements),
    ...selectGroupsForSelectedElements(
      {
        editingGroupId: appState.editingGroupId,
        selectedElementIds: excludeElementsInFramesFromSelection(
          targetElements,
        ).reduce((acc: Record<ExcalidrawElement["id"], true>, element) => {
          if (!isBoundToContainer(element)) {
            acc[element.id] = true;
          }
          return acc;
        }, {}),
      },
      allElements,
      appState,
      null,
    ),
  };
};

/**
 * Returns editing or single-selected text element, if any.
 */
export const getActiveTextElement = (
  selectedElements: readonly NonDeleted<ExcalidrawElement>[],
  appState: Pick<AppState, "editingTextElement">,
) => {
  const activeTextElement =
    appState.editingTextElement ||
    (selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      selectedElements[0]);

  return activeTextElement || null;
};
