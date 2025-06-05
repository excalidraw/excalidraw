import { arrayToMap, isShallowEqual } from "@excalidraw/common";

import type {
  AppState,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import { getElementAbsoluteCoords, getElementBounds } from "./bounds";
import { isElementInViewport } from "./sizeHelpers";
import {
  isBoundToContainer,
  isFrameLikeElement,
  isLinearElement,
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
  NonDeletedExcalidrawElement,
} from "./types";

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
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(selection, elementsMap);

  let elementsInSelection = elements.filter((element) => {
    let [elementX1, elementY1, elementX2, elementY2] = getElementBounds(
      element,
      elementsMap,
    );

    const containingFrame = getContainingFrame(element, elementsMap);
    if (containingFrame) {
      const [fx1, fy1, fx2, fy2] = getElementBounds(
        containingFrame,
        elementsMap,
      );

      elementX1 = Math.max(fx1, elementX1);
      elementY1 = Math.max(fy1, elementY1);
      elementX2 = Math.min(fx2, elementX2);
      elementY2 = Math.min(fy2, elementY2);
    }

    return (
      element.locked === false &&
      element.type !== "selection" &&
      !isBoundToContainer(element) &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2
    );
  });

  elementsInSelection = excludeElementsInFrames
    ? excludeElementsInFramesFromSelection(elementsInSelection)
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
