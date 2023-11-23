import {
  getCommonBounds,
  getElementAbsoluteCoords,
  isTextElement,
} from "./element";
import {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";
import {
  getBoundTextElement,
  getContainerElement,
} from "./element/textElement";
import { arrayToMap } from "./utils";
import { mutateElement } from "./element/mutateElement";
import { AppClassProperties, AppState, StaticCanvasAppState } from "./types";
import { getElementsWithinSelection, getSelectedElements } from "./scene";
import { getElementsInGroup, selectGroupsFromGivenElements } from "./groups";
import Scene, { ExcalidrawElementsIncludingDeleted } from "./scene/Scene";
import { getElementLineSegments } from "./element/bounds";
import { doLineSegmentsIntersect } from "./packages/utils";
import { isFrameElement, isFrameLikeElement } from "./element/typeChecks";

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
  frame: ExcalidrawFrameLikeElement,
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
  frame: ExcalidrawFrameLikeElement,
) =>
  omitGroupsContainingFrameLikes(
    getElementsWithinSelection(elements, frame, false),
  ).filter(
    (element) =>
      (!isFrameLikeElement(element) && !element.frameId) ||
      element.frameId === frame.id,
  );

export const isElementContainingFrame = (
  elements: readonly ExcalidrawElement[],
  element: ExcalidrawElement,
  frame: ExcalidrawFrameLikeElement,
) => {
  return getElementsWithinSelection(elements, element).some(
    (e) => e.id === frame.id,
  );
};

export const getElementsIntersectingFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
) => elements.filter((element) => isElementIntersectingFrame(element, frame));

export const elementsAreInFrameBounds = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
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
  frame: ExcalidrawFrameLikeElement,
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
  frame: NonDeleted<ExcalidrawFrameLikeElement>,
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
  frame: ExcalidrawFrameLikeElement,
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
  frame: ExcalidrawFrameLikeElement,
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
export const groupByFrameLikes = (elements: readonly ExcalidrawElement[]) => {
  const frameElementsMap = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement[]
  >();

  for (const element of elements) {
    const frameId = isFrameLikeElement(element) ? element.id : element.frameId;
    if (frameId && !frameElementsMap.has(frameId)) {
      frameElementsMap.set(frameId, getFrameChildren(elements, frameId));
    }
  }

  return frameElementsMap;
};

export const getFrameChildren = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frameId: string,
) => allElements.filter((element) => element.frameId === frameId);

export const getFrameLikeElements = (
  allElements: ExcalidrawElementsIncludingDeleted,
): ExcalidrawFrameLikeElement[] => {
  return allElements.filter((element): element is ExcalidrawFrameLikeElement =>
    isFrameLikeElement(element),
  );
};

/**
 * Returns ExcalidrawFrameElements and non-frame-children elements.
 *
 * Considers children as root elements if they point to a frame parent
 * non-existing in the elements set.
 *
 * Considers non-frame bound elements (container or arrow labels) as root.
 */
export const getRootElements = (
  allElements: ExcalidrawElementsIncludingDeleted,
) => {
  const frameElements = arrayToMap(getFrameLikeElements(allElements));
  return allElements.filter(
    (element) =>
      frameElements.has(element.id) ||
      !element.frameId ||
      !frameElements.has(element.frameId),
  );
};

export const getElementsInResizingFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frame: ExcalidrawFrameLikeElement,
  appState: AppState,
): ExcalidrawElement[] => {
  const prevElementsInFrame = getFrameChildren(allElements, frame.id);
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
  frame: ExcalidrawFrameLikeElement,
) => {
  return omitGroupsContainingFrameLikes(
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
        null) as null | ExcalidrawFrameLikeElement;
    }
    return (
      (Scene.getScene(element)?.getElement(
        element.frameId,
      ) as ExcalidrawFrameLikeElement) || null
    );
  }
  return null;
};

// --------------------------- Frame Operations -------------------------------

/**
 * Retains (or repairs for target frame) the ordering invriant where children
 * elements come right before the parent frame:
 * [el, el, child, child, frame, el]
 */
export const addElementsToFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  elementsToAdd: NonDeletedExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
) => {
  const { currTargetFrameChildrenMap } = allElements.reduce(
    (acc, element, index) => {
      if (element.frameId === frame.id) {
        acc.currTargetFrameChildrenMap.set(element.id, true);
      }
      return acc;
    },
    {
      currTargetFrameChildrenMap: new Map<ExcalidrawElement["id"], true>(),
    },
  );

  const suppliedElementsToAddSet = new Set(elementsToAdd.map((el) => el.id));

  const finalElementsToAdd: ExcalidrawElement[] = [];

  // - add bound text elements if not already in the array
  // - filter out elements that are already in the frame
  for (const element of omitGroupsContainingFrameLikes(
    allElements,
    elementsToAdd,
  )) {
    if (!currTargetFrameChildrenMap.has(element.id)) {
      finalElementsToAdd.push(element);
    }

    const boundTextElement = getBoundTextElement(element);
    if (
      boundTextElement &&
      !suppliedElementsToAddSet.has(boundTextElement.id) &&
      !currTargetFrameChildrenMap.has(boundTextElement.id)
    ) {
      finalElementsToAdd.push(boundTextElement);
    }
  }

  for (const element of finalElementsToAdd) {
    mutateElement(
      element,
      {
        frameId: frame.id,
      },
      false,
    );
  }
  return allElements.slice();
};

export const removeElementsFromFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  elementsToRemove: NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const _elementsToRemove = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >();

  const toRemoveElementsByFrame = new Map<
    ExcalidrawFrameLikeElement["id"],
    ExcalidrawElement[]
  >();

  for (const element of elementsToRemove) {
    if (element.frameId) {
      _elementsToRemove.set(element.id, element);

      const arr = toRemoveElementsByFrame.get(element.frameId) || [];
      arr.push(element);

      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        _elementsToRemove.set(boundTextElement.id, boundTextElement);
        arr.push(boundTextElement);
      }

      toRemoveElementsByFrame.set(element.frameId, arr);
    }
  }

  for (const [, element] of _elementsToRemove) {
    mutateElement(
      element,
      {
        frameId: null,
      },
      false,
    );
  }

  return allElements.slice();
};

export const removeAllElementsFromFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  frame: ExcalidrawFrameLikeElement,
  appState: AppState,
) => {
  const elementsInFrame = getFrameChildren(allElements, frame.id);
  return removeElementsFromFrame(allElements, elementsInFrame, appState);
};

export const replaceAllElementsInFrame = (
  allElements: ExcalidrawElementsIncludingDeleted,
  nextElementsInFrame: ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
  appState: AppState,
) => {
  return addElementsToFrame(
    removeAllElementsFromFrame(allElements, frame, appState),
    nextElementsInFrame,
    frame,
  );
};

/** does not mutate elements, but returns new ones */
export const updateFrameMembershipOfSelectedElements = (
  allElements: ExcalidrawElementsIncludingDeleted,
  appState: AppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    // supplying elements explicitly in case we're passed non-state elements
    elements: allElements,
  });
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
      element.frameId &&
      !isFrameLikeElement(element) &&
      !isElementInFrame(element, allElements, appState)
    ) {
      elementsToRemove.add(element);
    }
  });

  return elementsToRemove.size > 0
    ? removeElementsFromFrame(allElements, [...elementsToRemove], appState)
    : allElements;
};

/**
 * filters out elements that are inside groups that contain a frame element
 * anywhere in the group tree
 */
export const omitGroupsContainingFrameLikes = (
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
      getElementsInGroup(allElements, groupId).some((el) =>
        isFrameLikeElement(el),
      )
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
  appState: StaticCanvasAppState,
) => {
  const _element = isTextElement(element)
    ? getContainerElement(element) || element
    : element;

  return appState.selectedElementIds[_element.id] &&
    appState.selectedElementsAreBeingDragged
    ? appState.frameToHighlight
    : getContainingFrame(_element);
};

// TODO: this a huge bottleneck for large scenes, optimise
// given an element, return if the element is in some frame
export const isElementInFrame = (
  element: ExcalidrawElement,
  allElements: ExcalidrawElementsIncludingDeleted,
  appState: StaticCanvasAppState,
) => {
  const frame = getTargetFrame(element, appState);
  const _element = isTextElement(element)
    ? getContainerElement(element) || element
    : element;

  if (frame) {
    // Perf improvement:
    // For an element that's already in a frame, if it's not being dragged
    // then there is no need to refer to geometry (which, yes, is slow) to check if it's in a frame.
    // It has to be in its containing frame.
    if (
      !appState.selectedElementIds[element.id] ||
      !appState.selectedElementsAreBeingDragged
    ) {
      return true;
    }

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
      if (isFrameLikeElement(elementInGroup)) {
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

export const getFrameLikeTitle = (
  element: ExcalidrawFrameLikeElement,
  frameIdx: number,
) => {
  const existingName = element.name?.trim();
  if (existingName) {
    return existingName;
  }
  // TODO name frames AI only is specific to AI frames
  return isFrameElement(element) ? `Frame ${frameIdx}` : `AI Frame ${frameIdx}`;
};
