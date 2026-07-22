import { arrayToMap, isShallowEqual, type Bounds } from "@excalidraw/common";

import type {
  AppState,
  BoxSelectionMode,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import { elementsOverlappingBBox, getElementAbsoluteCoords } from "./bounds";
import { isElementInViewport } from "./sizeHelpers";
import {
  isBoundToContainer,
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import { getFrameChildren } from "./frame";

import { LinearElementEditor } from "./linearElementEditor";
import { selectGroupsForSelectedElements } from "./groups";

import { isNonDeletedElement } from ".";

import type {
  ElementsMap,
  ElementsMapOrArray,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./types";

const shouldIgnoreElementFromSelection = (element: ExcalidrawElement) =>
  element.locked || isBoundToContainer(element);

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

export const getElementsWithinSelection = <T extends ExcalidrawElement>(
  elements: readonly T[],
  selection: ExcalidrawElement,
  elementsMap: ElementsMap,
  // TODO remove (this flag is effectively unused AFAIK)
  excludeElementsInFrames: boolean = true,
  boxSelectionMode: BoxSelectionMode = "contain",
): T[] => {
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

  return elementsOverlappingBBox({
    elements,
    bounds: selectionBounds,
    elementsMap,
    type: boxSelectionMode,
    shouldIgnoreElementFromSelection,
    excludeElementsInFrames,
  });
};

export const getVisibleAndNonSelectedElements = <
  T extends NonDeletedExcalidrawElement,
>(
  elements: readonly T[],
  selectedElements: readonly ExcalidrawElement[],
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

// FIXME: This function should be moved to a class instance.
// FIXME is fixed 
// Pure utility functions are preferred because they are predictable
// (i.e. for the same input, they always produce the same output).
export const isSomeElementSelected = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds">,
): boolean => {
  return elements.some((element) => appState.selectedElementIds[element.id]);
};

export const getSelectedElements = (
  elements: ElementsMapOrArray,
  appState: Pick<InteractiveCanvasAppState, "selectedElementIds">,
  opts?: {
    includeBoundTextElement?: boolean;
    includeElementsInFrames?: boolean;
  },
) => {
  const addedElements = new Set<ExcalidrawElement["id"]>();
  // selection can only contain non-deleted elements
  const selectedElements: NonDeletedExcalidrawElement[] = [];
  for (const element of elements.values()) {
    if (appState.selectedElementIds[element.id]) {
      if (isNonDeletedElement(element)) {
        selectedElements.push(element as NonDeletedExcalidrawElement);
        addedElements.add(element.id);
      } else {
        console.error(
          "[NONDELETED][INVARIANT] getSelectedElements skipping deleted selected element which should not be in the selection",
        );
      }
      continue;
    }
    if (
      opts?.includeBoundTextElement &&
      isBoundToContainer(element) &&
      isNonDeletedElement(element) &&
      appState.selectedElementIds[element?.containerId]
    ) {
      selectedElements.push(element as NonDeletedExcalidrawElement);
      addedElements.add(element.id);
      continue;
    }
  }

  if (opts?.includeElementsInFrames) {
    const elementsToInclude: NonDeletedExcalidrawElement[] = [];
    selectedElements.forEach((element) => {
      if (isFrameLikeElement(element)) {
        getFrameChildren(elements, element.id).forEach(
          (e) =>
            !addedElements.has(e.id) &&
            elementsToInclude.push(e as NonDeletedExcalidrawElement),
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
  targetElements: readonly NonDeletedExcalidrawElement[],
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
  targetElements: readonly NonDeletedExcalidrawElement[],
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
