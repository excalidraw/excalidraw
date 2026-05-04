import { arrayToMap, isShallowEqual, type Bounds } from "@excalidraw/common";
import {
  lineSegment,
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
} from "@excalidraw/math";

import type {
  AppState,
  BoxSelectionMode,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import {
  boundsContainBounds,
  doBoundsIntersect,
  elementCenterPoint,
  getElementAbsoluteCoords,
  getElementBounds,
  pointInsideBounds,
} from "./bounds";
import { intersectElementWithLineSegment } from "./collision";
import { isElementInViewport } from "./sizeHelpers";
import {
  isArrowElement,
  isBoundToContainer,
  isFrameLikeElement,
  isFreeDrawElement,
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
import { getBoundTextElement } from "./textElement";

import type {
  ElementsMap,
  ElementsMapOrArray,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./types";

const shouldIgnoreElementFromSelection = (
  element: NonDeletedExcalidrawElement,
) => element.locked || isBoundToContainer(element);

const excludeElementsFromFrames = <T extends ExcalidrawElement>(
  selectedElements: readonly T[],
  framesInSelection: Set<ExcalidrawFrameLikeElement["id"]>,
) => {
  return selectedElements.filter((element) => {
    if (element.frameId && framesInSelection.has(element.frameId)) {
      return false;
    }
    return true;
  });
};

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

  return excludeElementsFromFrames(selectedElements, framesInSelection);
};

export const getElementsWithinSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  // TODO remove (this flag is effectively unused AFAIK)
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

  const framesInSelection = excludeElementsInFrames
    ? new Set<NonDeletedExcalidrawElement["id"]>()
    : null;
  let elementsInSelection: NonDeletedExcalidrawElement[] = [];

  for (const element of elements) {
    if (shouldIgnoreElementFromSelection(element)) {
      continue;
    }

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

    // Clip element bounds by its containing frame (if any), since only the
    // visible (frame-clipped) portion of the element is relevant for selection.
    const associatedFrame = getContainingFrame(element, elementsMap);
    if (
      associatedFrame &&
      elementOverlapsWithFrame(element, associatedFrame, elementsMap)
    ) {
      const frameAABB = getElementBounds(associatedFrame, elementsMap);
      elementAABB = [
        Math.max(elementAABB[0], frameAABB[0]),
        Math.max(elementAABB[1], frameAABB[1]),
        Math.min(elementAABB[2], frameAABB[2]),
        Math.min(elementAABB[3], frameAABB[3]),
      ] as Bounds;

      labelAABB = labelAABB
        ? ([
            Math.max(labelAABB[0], frameAABB[0]),
            Math.max(labelAABB[1], frameAABB[1]),
            Math.min(labelAABB[2], frameAABB[2]),
            Math.min(labelAABB[3], frameAABB[3]),
          ] as Bounds)
        : null;
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
      if (framesInSelection && isFrameLikeElement(element)) {
        framesInSelection.add(element.id);
      }
      elementsInSelection.push(element);
      continue;
    }

    // 2. Handle the case where the label is overlapped by the selection box
    if (
      boxSelectionMode === "overlap" &&
      labelAABB &&
      doBoundsIntersect(selectionBounds, labelAABB)
    ) {
      elementsInSelection.push(element);
      continue;
    }

    // 3. Handle the case where the selection is not wrapping the element, but
    //    it does intersect the element's outline (non-AABB).
    if (
      boxSelectionMode === "overlap" &&
      doBoundsIntersect(selectionBounds, elementAABB)
    ) {
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
        if (framesInSelection && isFrameLikeElement(element)) {
          framesInSelection.add(element.id);
        }

        elementsInSelection.push(element);
        continue;
      }
    }

    // 4. We don't need to handle when the selection is inside the element
    //    as it is separately handled in App.
  }

  elementsInSelection = framesInSelection
    ? excludeElementsFromFrames(elementsInSelection, framesInSelection)
    : elementsInSelection;

  elementsInSelection = elementsInSelection.filter((element) => {
    const containingFrame = getContainingFrame(element, elementsMap);

    if (containingFrame) {
      return elementOverlapsWithFrame(element, containingFrame, elementsMap);
    }

    return true;
  });

  return elementsInSelection;
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
