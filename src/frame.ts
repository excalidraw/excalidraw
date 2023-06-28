import {
  getCommonBounds,
  getElementAbsoluteCoords,
  isTextElement,
} from "./element";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";
import {
  getBoundTextElement,
  getContainerElement,
} from "./element/textElement";
import { arrayToMap, findIndex } from "./utils";
import { mutateElement } from "./element/mutateElement";
import { AppState } from "./types";
import { getElementsWithinSelection, getSelectedElements } from "./scene";
import { isFrameElement } from "./element";
import { moveOneRight } from "./zindex";
import { getElementsInGroup, selectGroupsFromGivenElements } from "./groups";
import Scene, { ExcalidrawElementsIncludingDeleted } from "./scene/Scene";
import { getElementLineSegments } from "./element/bounds";
import { doLineSegmentsIntersect } from "./packages/utils";

// --------------------------- Frame State ------------------------------------
export const bindElementsToFramesAfterDuplication = (
  nextElements: ExcalidrawElement[],
  oldElements: readonly ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
) => {
  const nextElementMap = arrayToMap(nextElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;

  for (const element of oldElements) {
    if (element.frameId) {
      // use its frameId to get the new frameId
      const nextElementId = oldIdToDuplicatedId.get(element.id);
      const nextFrameId = oldIdToDuplicatedId.get(element.frameId);
      if (nextElementId) {
        const nextElement = nextElementMap.get(nextElementId);
        if (nextElement) {
          mutateElement(
            nextElement,
            {
              frameId: nextFrameId ?? element.frameId,
            },
            false,
          );
        }
      }
    }
  }
};

export function isElementIntersectingFrame(
  element: ExcalidrawElement,
  frame: ExcalidrawFrameElement,
) {
  const frameLineSegments = getElementLineSegments(frame);

  const elementLineSegments = getElementLineSegments(element);

  const intersecting = frameLineSegments.some((frameLineSegment) =>
    elementLineSegments.some((elementLineSegment) =>
      doLineSegmentsIntersect(frameLineSegment, elementLineSegment),
    ),
  );

  return intersecting;
}

export const getElementsCompletelyInFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) =>
  omitGroupsContainingFrames(
    getElementsWithinSelection(elements, frame, false),
  ).filter(
    (element) =>
      (element.type !== "frame" && !element.frameId) ||
      element.frameId === frame.id,
  );

export const isElementContainingFrame = (
  elements: readonly ExcalidrawElement[],
  element: ExcalidrawElement,
  frame: ExcalidrawFrameElement,
) => {
  return getElementsWithinSelection(elements, element).some(
    (e) => e.id === frame.id,
  );
};

export const getElementsIntersectingFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) => elements.filter((element) => isElementIntersectingFrame(element, frame));

export const elementsAreInFrameBounds = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(frame);

  const [elementX1, elementY1, elementX2, elementY2] =
    getCommonBounds(elements);

  return (
    selectionX1 <= elementX1 &&
    selectionY1 <= elementY1 &&
    selectionX2 >= elementX2 &&
    selectionY2 >= elementY2
  );
};

export const elementOverlapsWithFrame = (
  element: ExcalidrawElement,
  frame: ExcalidrawFrameElement,
) => {
  return (
    elementsAreInFrameBounds([element], frame) ||
    isElementIntersectingFrame(element, frame) ||
    isElementContainingFrame([frame], element, frame)
  );
};

export const isCursorInFrame = (
  cursorCoords: {
    x: number;
    y: number;
  },
  frame: NonDeleted<ExcalidrawFrameElement>,
) => {
  const [fx1, fy1, fx2, fy2] = getElementAbsoluteCoords(frame);

  return isPointWithinBounds(
    [fx1, fy1],
    [cursorCoords.x, cursorCoords.y],
    [fx2, fy2],
  );
};

export const groupsAreAtLeastIntersectingTheFrame = (
  elements: readonly NonDeletedExcalidrawElement[],
  groupIds: readonly string[],
  frame: ExcalidrawFrameElement,
) => {
  const elementsInGroup = groupIds.flatMap((groupId) =>
    getElementsInGroup(elements, groupId),
  );

  if (elementsInGroup.length === 0) {
    return true;
  }

  return !!elementsInGroup.find(
    (element) =>
      elementsAreInFrameBounds([element], frame) ||
      isElementIntersectingFrame(element, frame),
  );
};

export const groupsAreCompletelyOutOfFrame = (
  elements: readonly NonDeletedExcalidrawElement[],
  groupIds: readonly string[],
  frame: ExcalidrawFrameElement,
) => {
  const elementsInGroup = groupIds.flatMap((groupId) =>
    getElementsInGroup(elements, groupId),
  );

  if (elementsInGroup.length === 0) {
    return true;
  }

  return (
    elementsInGroup.find(
      (element) =>
        elementsAreInFrameBounds([element], frame) ||
        isElementIntersectingFrame(element, frame),
    ) === undefined
  );
};

// --------------------------- Frame Utils ------------------------------------

/**
 * Returns a map of frameId to frame elements. Includes empty frames.
 */
export const groupByFrames = (elements: ExcalidrawElementsIncludingDeleted) => {
  const frameElementsMap = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement[]
  >();

  for (const element of elements) {
    const frameId = isFrameElement(element) ? element.id : element.frameId;
    if (frameId && !frameElementsMap.has(frameId)) {
      frameElementsMap.set(frameId, getFrameElements(elements, frameId));
    }
  }

  return frameElementsMap;
};

export const getFrameElements = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frameId: string,
) => allElements.filter((element) => element.frameId === frameId);

export const getElementsInResizingFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frame: ExcalidrawFrameElement,
  appState: AppState,
): ExcalidrawElement[] => {
  const prevElementsInFrame = getFrameElements(allElements, frame.id);
  const nextElementsInFrame = new Set<ExcalidrawElement>(prevElementsInFrame);

  const elementsCompletelyInFrame = new Set([
    ...getElementsCompletelyInFrame(allElements, frame),
    ...prevElementsInFrame.filter((element) =>
      isElementContainingFrame(allElements, element, frame),
    ),
  ]);

  const elementsNotCompletelyInFrame = prevElementsInFrame.filter(
    (element) => !elementsCompletelyInFrame.has(element),
  );

  // for elements that are completely in the frame
  // if they are part of some groups, then those groups are still
  // considered to belong to the frame
  const groupsToKeep = new Set<string>(
    Array.from(elementsCompletelyInFrame).flatMap(
      (element) => element.groupIds,
    ),
  );

  for (const element of elementsNotCompletelyInFrame) {
    if (!isElementIntersectingFrame(element, frame)) {
      if (element.groupIds.length === 0) {
        nextElementsInFrame.delete(element);
      }
    } else if (element.groupIds.length > 0) {
      // group element intersects with the frame, we should keep the groups
      // that this element is part of
      for (const id of element.groupIds) {
        groupsToKeep.add(id);
      }
    }
  }

  for (const element of elementsNotCompletelyInFrame) {
    if (element.groupIds.length > 0) {
      let shouldRemoveElement = true;

      for (const id of element.groupIds) {
        if (groupsToKeep.has(id)) {
          shouldRemoveElement = false;
        }
      }

      if (shouldRemoveElement) {
        nextElementsInFrame.delete(element);
      }
    }
  }

  const individualElementsCompletelyInFrame = Array.from(
    elementsCompletelyInFrame,
  ).filter((element) => element.groupIds.length === 0);

  for (const element of individualElementsCompletelyInFrame) {
    nextElementsInFrame.add(element);
  }

  const newGroupElementsCompletelyInFrame = Array.from(
    elementsCompletelyInFrame,
  ).filter((element) => element.groupIds.length > 0);

  const groupIds = selectGroupsFromGivenElements(
    newGroupElementsCompletelyInFrame,
    appState,
  );

  // new group elements
  for (const [id, isSelected] of Object.entries(groupIds)) {
    if (isSelected) {
      const elementsInGroup = getElementsInGroup(allElements, id);

      if (elementsAreInFrameBounds(elementsInGroup, frame)) {
        for (const element of elementsInGroup) {
          nextElementsInFrame.add(element);
        }
      }
    }
  }

  return [...nextElementsInFrame].filter((element) => {
    return !(isTextElement(element) && element.containerId);
  });
};

export const getElementsInNewFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frame: ExcalidrawFrameElement,
) => {
  return omitGroupsContainingFrames(
    allElements,
    getElementsCompletelyInFrame(allElements, frame),
  );
};

export const getContainingFrame = (
  element: ExcalidrawElement,
  /**
   * Optionally an elements map, in case the elements aren't in the Scene yet.
   * Takes precedence over Scene elements, even if the element exists
   * in Scene elements and not the supplied elements map.
   */
  elementsMap?: Map<string, ExcalidrawElement>,
) => {
  if (element.frameId) {
    if (elementsMap) {
      return (elementsMap.get(element.frameId) ||
        null) as null | ExcalidrawFrameElement;
    }
    return (
      (Scene.getScene(element)?.getElement(
        element.frameId,
      ) as ExcalidrawFrameElement) || null
    );
  }
  return null;
};

// --------------------------- Frame Operations -------------------------------
export const addElementsToFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  elementsToAdd: NonDeletedExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) => {
  const _elementsToAdd: ExcalidrawElement[] = [];

  for (const element of elementsToAdd) {
    _elementsToAdd.push(element);

    const boundTextElement = getBoundTextElement(element);
    if (boundTextElement) {
      _elementsToAdd.push(boundTextElement);
    }
  }

  let nextElements = allElements.slice();

  const frameBoundary = findIndex(nextElements, (e) => e.frameId === frame.id);

  for (const element of omitGroupsContainingFrames(
    allElements,
    _elementsToAdd,
  )) {
    if (element.frameId !== frame.id && !isFrameElement(element)) {
      mutateElement(
        element,
        {
          frameId: frame.id,
        },
        false,
      );

      const frameIndex = findIndex(nextElements, (e) => e.id === frame.id);
      const elementIndex = findIndex(nextElements, (e) => e.id === element.id);

      if (elementIndex < frameBoundary) {
        nextElements = [
          ...nextElements.slice(0, elementIndex),
          ...nextElements.slice(elementIndex + 1, frameBoundary),
          element,
          ...nextElements.slice(frameBoundary),
        ];
      } else if (elementIndex > frameIndex) {
        nextElements = [
          ...nextElements.slice(0, frameIndex),
          element,
          ...nextElements.slice(frameIndex, elementIndex),
          ...nextElements.slice(elementIndex + 1),
        ];
      }
    }
  }

  return nextElements;
};

export const removeElementsFromFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  elementsToRemove: NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const _elementsToRemove: ExcalidrawElement[] = [];

  for (const element of elementsToRemove) {
    if (element.frameId) {
      _elementsToRemove.push(element);
      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        _elementsToRemove.push(boundTextElement);
      }
    }
  }

  for (const element of _elementsToRemove) {
    mutateElement(
      element,
      {
        frameId: null,
      },
      false,
    );
  }

  const nextElements = moveOneRight(
    allElements,
    appState,
    Array.from(_elementsToRemove),
  );

  return nextElements;
};

export const removeAllElementsFromFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frame: ExcalidrawFrameElement,
  appState: AppState,
) => {
  const elementsInFrame = getFrameElements(allElements, frame.id);
  return removeElementsFromFrame(allElements, elementsInFrame, appState);
};

export const replaceAllElementsInFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  nextElementsInFrame: ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
  appState: AppState,
) => {
  return addElementsToFrame(
    removeAllElementsFromFrame(allElements, frame, appState),
    nextElementsInFrame,
    frame,
  );
};

/** does not mutate elements, but return new ones */
export const updateFrameMembershipOfSelectedElements = (
  allElements: ExcalidrawElementsIncludingDeleted,
  appState: AppState,
) => {
  const selectedElements = getSelectedElements(allElements, appState);
  const elementsToFilter = new Set<ExcalidrawElement>(selectedElements);

  if (appState.editingGroupId) {
    for (const element of selectedElements) {
      if (element.groupIds.length === 0) {
        elementsToFilter.add(element);
      } else {
        element.groupIds
          .flatMap((gid) => getElementsInGroup(allElements, gid))
          .forEach((element) => elementsToFilter.add(element));
      }
    }
  }

  const elementsToRemove = new Set<ExcalidrawElement>();

  elementsToFilter.forEach((element) => {
    if (
      !isFrameElement(element) &&
      !isElementInFrame(element, allElements, appState)
    ) {
      elementsToRemove.add(element);
    }
  });

  return removeElementsFromFrame(allElements, [...elementsToRemove], appState);
};

/**
 * filters out elements that are inside groups that contain a frame element
 * anywhere in the group tree
 */
export const omitGroupsContainingFrames = (
  allElements: ExcalidrawElementsIncludingDeleted,
  /** subset of elements you want to filter. Optional perf optimization so we
   * don't have to filter all elements unnecessarily
   */
  selectedElements?: readonly ExcalidrawElement[],
) => {
  const uniqueGroupIds = new Set<string>();
  for (const el of selectedElements || allElements) {
    const topMostGroupId = el.groupIds[el.groupIds.length - 1];
    if (topMostGroupId) {
      uniqueGroupIds.add(topMostGroupId);
    }
  }

  const rejectedGroupIds = new Set<string>();
  for (const groupId of uniqueGroupIds) {
    if (
      getElementsInGroup(allElements, groupId).some((el) => isFrameElement(el))
    ) {
      rejectedGroupIds.add(groupId);
    }
  }

  return (selectedElements || allElements).filter(
    (el) => !rejectedGroupIds.has(el.groupIds[el.groupIds.length - 1]),
  );
};

/**
 * depending on the appState, return target frame, which is the frame the given element
 * is going to be added to or remove from
 */
export const getTargetFrame = (
  element: ExcalidrawElement,
  appState: AppState,
) => {
  const _element = isTextElement(element)
    ? getContainerElement(element) || element
    : element;

  return appState.selectedElementIds[_element.id] &&
    appState.selectedElementsAreBeingDragged
    ? appState.frameToHighlight
    : getContainingFrame(_element);
};

// given an element, return if the element is in some frame
export const isElementInFrame = (
  element: ExcalidrawElement,
  allElements: ExcalidrawElementsIncludingDeleted,
  appState: AppState,
) => {
  const frame = getTargetFrame(element, appState);
  const _element = isTextElement(element)
    ? getContainerElement(element) || element
    : element;

  if (frame) {
    if (_element.groupIds.length === 0) {
      return elementOverlapsWithFrame(_element, frame);
    }

    const allElementsInGroup = new Set(
      _element.groupIds.flatMap((gid) => getElementsInGroup(allElements, gid)),
    );

    if (appState.editingGroupId && appState.selectedElementsAreBeingDragged) {
      const selectedElements = new Set(
        getSelectedElements(allElements, appState),
      );

      const editingGroupOverlapsFrame = appState.frameToHighlight !== null;

      if (editingGroupOverlapsFrame) {
        return true;
      }

      selectedElements.forEach((selectedElement) => {
        allElementsInGroup.delete(selectedElement);
      });
    }

    for (const elementInGroup of allElementsInGroup) {
      if (isFrameElement(elementInGroup)) {
        return false;
      }
    }

    for (const elementInGroup of allElementsInGroup) {
      if (elementOverlapsWithFrame(elementInGroup, frame)) {
        return true;
      }
    }
  }

  return false;
};
