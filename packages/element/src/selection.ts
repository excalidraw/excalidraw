import { arrayToMap, isShallowEqual, type Bounds } from "@excalidraw/common";

import type {
  AppState,
  BoxSelectionMode,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import {
  boundsContainBounds,
  doBoundsIntersect,
  elementsOverlappingBBox,
  getElementAbsoluteCoords,
  getElementBounds,
} from "./bounds";
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

// Correct for frame clipping: elementsOverlappingBBox uses unclipped element
// bounds, but selection should only consider the visible (frame-clipped)
// portion of elements in frames.
const getFrameClippedAABB = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
): Bounds | null => {
  const associatedFrame = getContainingFrame(element, elementsMap);
  if (
    !associatedFrame ||
    !elementOverlapsWithFrame(element, associatedFrame, elementsMap)
  ) {
    return null;
  }
  const strokeWidth = element.strokeWidth;
  let elementAABB = getElementBounds(element, elementsMap);
  elementAABB = [
    elementAABB[0] - strokeWidth / 2,
    elementAABB[1] - strokeWidth / 2,
    elementAABB[2] + strokeWidth / 2,
    elementAABB[3] + strokeWidth / 2,
  ] as Bounds;
  const frameAABB = getElementBounds(associatedFrame, elementsMap);
  return [
    Math.max(elementAABB[0], frameAABB[0]),
    Math.max(elementAABB[1], frameAABB[1]),
    Math.min(elementAABB[2], frameAABB[2]),
    Math.min(elementAABB[3], frameAABB[3]),
  ] as Bounds;
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

  const groups: Record<string, NonDeletedExcalidrawElement[]> = {};

  // First pass: filter selectable elements and build groups map
  const selectableElements: NonDeletedExcalidrawElement[] = [];
  for (const element of elements) {
    if (shouldIgnoreElementFromSelection(element)) {
      continue;
    }

    // Track only selectable top-level group members, so ignored elements such
    // as bound text and locked elements don't affect group selection.
    const groupId = element.groupIds.at(-1);
    if (groupId) {
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(element);
    }

    selectableElements.push(element);
  }

  // Use elementsOverlappingBBox for bounds checking (without frame clipping)
  let elementsInSelectionArr = elementsOverlappingBBox({
    elements: selectableElements,
    elementsMap,
    bounds: selectionBounds,
    type: boxSelectionMode,
  });

  if (boxSelectionMode === "overlap") {
    // Remove elements whose frame-clipped bounds no longer overlap the selection
    elementsInSelectionArr = elementsInSelectionArr.filter((element) => {
      const clippedAABB = getFrameClippedAABB(element, elementsMap);
      if (!clippedAABB) {
        return true;
      }
      return (
        boundsContainBounds(selectionBounds, clippedAABB) ||
        doBoundsIntersect(selectionBounds, clippedAABB)
      );
    });
  } else {
    // "contain" mode: add elements whose clipped bounds fit within the
    // selection, but whose unclipped bounds did not (so elementsOverlappingBBox
    // missed them)
    const inSelectionSet = new Set(elementsInSelectionArr);
    for (const element of selectableElements) {
      if (inSelectionSet.has(element)) {
        continue;
      }
      const clippedAABB = getFrameClippedAABB(element, elementsMap);
      if (clippedAABB && boundsContainBounds(selectionBounds, clippedAABB)) {
        elementsInSelectionArr.push(element);
        inSelectionSet.add(element);
      }
    }
  }

  // Track frames in selection and build working set
  const framesInSelection = excludeElementsInFrames
    ? new Set<NonDeletedExcalidrawElement["id"]>()
    : null;

  const elementsInSelection = new Set(elementsInSelectionArr);

  if (framesInSelection) {
    for (const element of elementsInSelection) {
      if (isFrameLikeElement(element)) {
        framesInSelection.add(element.id);
      }
    }
  }

  // Exclude frame children when their frame is also selected
  if (framesInSelection) {
    elementsInSelection.forEach((element) => {
      if (element.frameId && framesInSelection.has(element.frameId)) {
        elementsInSelection.delete(element);
      }
    });
  }

  if (boxSelectionMode === "overlap") {
    Array.from(elementsInSelection).forEach((element) => {
      const groupId = element.groupIds.at(-1);
      const group = groupId ? groups[groupId] : null;

      group?.forEach((groupElement) => elementsInSelection.add(groupElement));
    });
  } else if (boxSelectionMode === "contain") {
    elementsInSelection.forEach((element) => {
      // note: currently we only support top-level group handling since
      // we don't support box selecting while editing the group/subgroup
      // see https://github.com/excalidraw/excalidraw/pull/11234#issuecomment-4387654451
      const groupId = element.groupIds.at(-1);

      const group = groupId ? groups[groupId] : null;

      if (
        group &&
        !group.every((groupElement) => elementsInSelection.has(groupElement))
      ) {
        elementsInSelection.delete(element);
      }
    });
  }

  // to maintain original order elements (namely for group selection)
  return elements.filter((element) => elementsInSelection.has(element));
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
