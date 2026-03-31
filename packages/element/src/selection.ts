import { arrayToMap, isShallowEqual, type Bounds } from "@excalidraw/common";
import { lineSegment, pointFrom, type GlobalPoint } from "@excalidraw/math";

import type {
  AppState,
  BoxSelectionMode,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import {
  boundsContainBounds,
  doBoundsIntersect,
  getElementAbsoluteCoords,
  getElementBounds,
} from "./bounds";
import { intersectElementWithLineSegment } from "./collision";
import { isElementInViewport } from "./sizeHelpers";
import {
  isArrowElement,
  isBoundToContainer,
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import {
  elementOverlapsWithFrame,
  getContainingFrame,
  getFrameChildren,
  isElementIntersectingFrame,
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
) =>
  element.locked || element.type === "selection" || isBoundToContainer(element);

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

    let elementBounds = getElementBounds(element, elementsMap);

    // Whether the element bounds should include the bound text element bounds
    const boundTextElement =
      isArrowElement(element) && getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      const { x, y } = LinearElementEditor.getBoundTextElementPosition(
        element,
        boundTextElement,
        elementsMap,
      );
      elementBounds = [
        Math.min(elementBounds[0], x),
        Math.min(elementBounds[1], y),
        Math.max(elementBounds[2], x + boundTextElement.width),
        Math.max(elementBounds[3], y + boundTextElement.height),
      ];
    }

    // Clip element bounds by its containing frame (if any), since only the
    // visible (frame-clipped) portion of the element is relevant for selection.
    const associatedFrame = getContainingFrame(element, elementsMap);
    if (
      associatedFrame &&
      isElementIntersectingFrame(element, associatedFrame, elementsMap)
    ) {
      const frameBounds = getElementBounds(associatedFrame, elementsMap);
      elementBounds = [
        Math.max(elementBounds[0], frameBounds[0]),
        Math.max(elementBounds[1], frameBounds[1]),
        Math.min(elementBounds[2], frameBounds[2]),
        Math.min(elementBounds[3], frameBounds[3]),
      ] as Bounds;

      if (boundsContainBounds(selectionBounds, elementBounds)) {
        elementsInSelection.push(element);
        continue;
      }
    }

    // ============== Evaluation ==============

    // 1. If the selection box WRAPs the element's bounds, then add it to the
    //    selection and move on, regardless of the selection mode.
    //
    //    PERF: This trick only works with axis-aligned box selection and the
    //          current convex element shapes!
    if (boundsContainBounds(selectionBounds, elementBounds)) {
      if (framesInSelection && isFrameLikeElement(element)) {
        framesInSelection.add(element.id);
      } else {
        elementsInSelection.push(element);
        continue;
      }
    }

    // 2. Handle the case where the selection is not wrapping the element, but
    //    it does intersect the element's outline.
    if (
      boxSelectionMode === "overlap" &&
      doBoundsIntersect(selectionBounds, elementBounds)
    ) {
      const selectionEdgeIntersects = selectionEdges.some((selectionEdge) => {
        const labelIntersection = boundTextElement
          ? intersectElementWithLineSegment(
              boundTextElement,
              elementsMap,
              selectionEdge,
              0,
              true, // Stop at first hit for better performance
            )
          : [];
        if (labelIntersection.length > 0) {
          return true;
        }

        const intersection = intersectElementWithLineSegment(
          element,
          elementsMap,
          selectionEdge,
          0,
          true, // Stop at first hit for better performance
        );

        return intersection.length > 0;
      });

      if (selectionEdgeIntersects) {
        if (framesInSelection && isFrameLikeElement(element)) {
          framesInSelection.add(element.id);
        }

        elementsInSelection.push(element);
        continue;
      }
    }

    // 3. We don't need to handle when the selection is inside the element
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
