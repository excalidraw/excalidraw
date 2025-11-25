import { arrayToMap, findIndex, findLastIndex } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";
import type { GlobalPoint } from "@excalidraw/math";

import { isFrameLikeElement, isTextElement } from "./typeChecks";
import { getElementsInGroup } from "./groups";
import { syncMovedIndices } from "./fractionalIndex";
import { getSelectedElements } from "./selection";
import { getBoundTextElement, getContainerElement } from "./textElement";
import { getHoveredElementForBinding } from "./collision";

import type { Scene } from "./Scene";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Ordered,
  OrderedExcalidrawElement,
} from "./types";

const isOfTargetFrame = (element: ExcalidrawElement, frameId: string) => {
  return element.frameId === frameId || element.id === frameId;
};

/**
 * Returns indices of elements to move based on selected elements.
 * Includes contiguous deleted elements that are between two selected elements,
 *  e.g.: [0 (selected), 1 (deleted), 2 (deleted), 3 (selected)]
 *
 * Specified elements (elementsToBeMoved) take precedence over
 * appState.selectedElementsIds
 */
const getIndicesToMove = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  elementsToBeMoved?: readonly ExcalidrawElement[],
) => {
  let selectedIndices: number[] = [];
  let deletedIndices: number[] = [];
  let includeDeletedIndex = null;
  let index = -1;
  const selectedElementIds = arrayToMap(
    elementsToBeMoved
      ? elementsToBeMoved
      : getSelectedElements(elements, appState, {
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        }),
  );
  while (++index < elements.length) {
    const element = elements[index];
    if (selectedElementIds.get(element.id)) {
      if (deletedIndices.length) {
        selectedIndices = selectedIndices.concat(deletedIndices);
        deletedIndices = [];
      }
      selectedIndices.push(index);
      includeDeletedIndex = index + 1;
    } else if (element.isDeleted && includeDeletedIndex === index) {
      includeDeletedIndex = index + 1;
      deletedIndices.push(index);
    } else {
      deletedIndices = [];
    }
  }
  return selectedIndices;
};

const toContiguousGroups = (array: number[]) => {
  let cursor = 0;
  return array.reduce((acc, value, index) => {
    if (index > 0 && array[index - 1] !== value - 1) {
      cursor = ++cursor;
    }
    (acc[cursor] || (acc[cursor] = [])).push(value);
    return acc;
  }, [] as number[][]);
};

/**
 * @returns index of target element, consindering tightly-bound elements
 * (currently non-linear elements bound to a container) as a one unit.
 * If no binding present, returns `undefined`.
 */
const getTargetIndexAccountingForBinding = (
  nextElement: ExcalidrawElement,
  elements: readonly ExcalidrawElement[],
  direction: "left" | "right",
  scene: Scene,
) => {
  if ("containerId" in nextElement && nextElement.containerId) {
    // TODO: why not to get the container from the nextElements?
    const containerElement = scene.getElement(nextElement.containerId);
    if (containerElement) {
      return direction === "left"
        ? Math.min(
            elements.indexOf(containerElement),
            elements.indexOf(nextElement),
          )
        : Math.max(
            elements.indexOf(containerElement),
            elements.indexOf(nextElement),
          );
    }
  } else {
    const boundElementId = nextElement.boundElements?.find(
      (binding) => binding.type !== "arrow",
    )?.id;
    if (boundElementId) {
      const boundTextElement = scene.getElement(boundElementId);
      if (boundTextElement) {
        return direction === "left"
          ? Math.min(
              elements.indexOf(boundTextElement),
              elements.indexOf(nextElement),
            )
          : Math.max(
              elements.indexOf(boundTextElement),
              elements.indexOf(nextElement),
            );
      }
    }
  }
};

const getContiguousFrameRangeElements = (
  allElements: readonly ExcalidrawElement[],
  frameId: ExcalidrawFrameLikeElement["id"],
) => {
  let rangeStart = -1;
  let rangeEnd = -1;
  allElements.forEach((element, index) => {
    if (isOfTargetFrame(element, frameId)) {
      if (rangeStart === -1) {
        rangeStart = index;
      }
      rangeEnd = index;
    }
  });
  if (rangeStart === -1) {
    return [];
  }
  return allElements.slice(rangeStart, rangeEnd + 1);
};

/**
 * Moves the arrow element above any bindable elements it intersects with or
 * hovers over.
 */
export const moveArrowAboveBindable = (
  point: GlobalPoint,
  arrow: ExcalidrawArrowElement,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  elementsMap: NonDeletedSceneElementsMap,
  scene: Scene,
): readonly OrderedExcalidrawElement[] => {
  const hoveredElement = getHoveredElementForBinding(
    point,
    elements,
    elementsMap,
  );

  if (!hoveredElement) {
    return elements;
  }

  const boundTextElement = getBoundTextElement(hoveredElement, elementsMap);
  const containerElement = isTextElement(hoveredElement)
    ? getContainerElement(hoveredElement, elementsMap)
    : null;

  const bindableIds = [
    hoveredElement.id,
    boundTextElement?.id,
    containerElement?.id,
  ].filter((id): id is NonDeletedExcalidrawElement["id"] => !!id);
  const bindableIdx = elements.findIndex((el) => bindableIds.includes(el.id));
  const arrowIdx = elements.findIndex((el) => el.id === arrow.id);

  if (arrowIdx !== -1 && bindableIdx !== -1 && arrowIdx < bindableIdx) {
    const updatedElements = Array.from(elements);
    const arrow = updatedElements.splice(arrowIdx, 1)[0];
    updatedElements.splice(bindableIdx, 0, arrow);

    scene.replaceAllElements(updatedElements);
  }

  return elements;
};

/**
 * Returns next candidate index that's available to be moved to. Currently that
 *  is a non-deleted element, and not inside a group (unless we're editing it).
 */
const getTargetIndex = (
  appState: AppState,
  elements: readonly ExcalidrawElement[],
  boundaryIndex: number,
  direction: "left" | "right",
  /**
   * Frame id if moving frame children.
   * If whole frame (including all children) is being moved, supply `null`.
   */
  containingFrame: ExcalidrawFrameLikeElement["id"] | null,
  scene: Scene,
) => {
  const sourceElement = elements[boundaryIndex];

  const indexFilter = (element: ExcalidrawElement) => {
    if (element.isDeleted) {
      return false;
    }
    if (containingFrame) {
      return element.frameId === containingFrame;
    }
    // if we're editing group, find closest sibling irrespective of whether
    // there's a different-group element between them (for legacy reasons)
    if (appState.editingGroupId) {
      return element.groupIds.includes(appState.editingGroupId);
    }
    return true;
  };

  const candidateIndex =
    direction === "left"
      ? findLastIndex(
          elements,
          (el) => indexFilter(el),
          Math.max(0, boundaryIndex - 1),
        )
      : findIndex(elements, (el) => indexFilter(el), boundaryIndex + 1);

  const nextElement = elements[candidateIndex];

  if (!nextElement) {
    return -1;
  }

  if (appState.editingGroupId) {
    if (
      // candidate element is a sibling in current editing group → return
      sourceElement?.groupIds.join("") === nextElement?.groupIds.join("")
    ) {
      return (
        getTargetIndexAccountingForBinding(
          nextElement,
          elements,
          direction,
          scene,
        ) ?? candidateIndex
      );
    } else if (!nextElement?.groupIds.includes(appState.editingGroupId)) {
      // candidate element is outside current editing group → prevent
      return -1;
    }
  }

  if (
    !containingFrame &&
    (nextElement.frameId || isFrameLikeElement(nextElement))
  ) {
    const frameElements = getContiguousFrameRangeElements(
      elements,
      nextElement.frameId || nextElement.id,
    );
    return direction === "left"
      ? elements.indexOf(frameElements[0])
      : elements.indexOf(frameElements[frameElements.length - 1]);
  }

  if (!nextElement.groupIds.length) {
    return (
      getTargetIndexAccountingForBinding(
        nextElement,
        elements,
        direction,
        scene,
      ) ?? candidateIndex
    );
  }

  const siblingGroupId = appState.editingGroupId
    ? nextElement.groupIds[
        nextElement.groupIds.indexOf(appState.editingGroupId) - 1
      ]
    : nextElement.groupIds[nextElement.groupIds.length - 1];

  const elementsInSiblingGroup = getElementsInGroup(elements, siblingGroupId);

  if (elementsInSiblingGroup.length) {
    // assumes getElementsInGroup() returned elements are sorted
    // by zIndex (ascending)
    return direction === "left"
      ? elements.indexOf(elementsInSiblingGroup[0])
      : elements.indexOf(
          elementsInSiblingGroup[elementsInSiblingGroup.length - 1],
        );
  }

  return candidateIndex;
};

const getTargetElementsMap = <T extends ExcalidrawElement>(
  elements: readonly T[],
  indices: number[],
) => {
  return indices.reduce((acc, index) => {
    const element = elements[index];
    acc.set(element.id, element);
    return acc;
  }, new Map<string, ExcalidrawElement>());
};

const shiftElementsByOne = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  direction: "left" | "right",
  scene: Scene,
) => {
  const indicesToMove = getIndicesToMove(elements, appState);
  const targetElementsMap = getTargetElementsMap(elements, indicesToMove);

  let groupedIndices = toContiguousGroups(indicesToMove);

  if (direction === "right") {
    groupedIndices = groupedIndices.reverse();
  }

  const selectedFrames = new Set<ExcalidrawFrameLikeElement["id"]>(
    indicesToMove
      .filter((idx) => isFrameLikeElement(elements[idx]))
      .map((idx) => elements[idx].id),
  );

  groupedIndices.forEach((indices, i) => {
    const leadingIndex = indices[0];
    const trailingIndex = indices[indices.length - 1];
    const boundaryIndex = direction === "left" ? leadingIndex : trailingIndex;

    const containingFrame = indices.some((idx) => {
      const el = elements[idx];
      return el.frameId && selectedFrames.has(el.frameId);
    })
      ? null
      : elements[boundaryIndex]?.frameId;

    const targetIndex = getTargetIndex(
      appState,
      elements,
      boundaryIndex,
      direction,
      containingFrame,
      scene,
    );

    if (targetIndex === -1 || boundaryIndex === targetIndex) {
      return;
    }

    const leadingElements =
      direction === "left"
        ? elements.slice(0, targetIndex)
        : elements.slice(0, leadingIndex);
    const targetElements = elements.slice(leadingIndex, trailingIndex + 1);
    const displacedElements =
      direction === "left"
        ? elements.slice(targetIndex, leadingIndex)
        : elements.slice(trailingIndex + 1, targetIndex + 1);
    const trailingElements =
      direction === "left"
        ? elements.slice(trailingIndex + 1)
        : elements.slice(targetIndex + 1);

    elements =
      direction === "left"
        ? [
            ...leadingElements,
            ...targetElements,
            ...displacedElements,
            ...trailingElements,
          ]
        : [
            ...leadingElements,
            ...displacedElements,
            ...targetElements,
            ...trailingElements,
          ];
  });

  syncMovedIndices(elements, targetElementsMap);

  return elements;
};

const shiftElementsToEnd = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  direction: "left" | "right",
  containingFrame: ExcalidrawFrameLikeElement["id"] | null,
  elementsToBeMoved?: readonly ExcalidrawElement[],
) => {
  const indicesToMove = getIndicesToMove(elements, appState, elementsToBeMoved);
  const targetElementsMap = getTargetElementsMap(elements, indicesToMove);
  const displacedElements: ExcalidrawElement[] = [];

  let leadingIndex: number;
  let trailingIndex: number;
  if (direction === "left") {
    if (containingFrame) {
      leadingIndex = findIndex(elements, (el) =>
        isOfTargetFrame(el, containingFrame),
      );
    } else if (appState.editingGroupId) {
      const groupElements = getElementsInGroup(
        elements,
        appState.editingGroupId,
      );
      if (!groupElements.length) {
        return elements;
      }
      leadingIndex = elements.indexOf(groupElements[0]);
    } else {
      leadingIndex = 0;
    }

    trailingIndex = indicesToMove[indicesToMove.length - 1];
  } else {
    if (containingFrame) {
      trailingIndex = findLastIndex(elements, (el) =>
        isOfTargetFrame(el, containingFrame),
      );
    } else if (appState.editingGroupId) {
      const groupElements = getElementsInGroup(
        elements,
        appState.editingGroupId,
      );
      if (!groupElements.length) {
        return elements;
      }
      trailingIndex = elements.indexOf(groupElements[groupElements.length - 1]);
    } else {
      trailingIndex = elements.length - 1;
    }

    leadingIndex = indicesToMove[0];
  }

  if (leadingIndex === -1) {
    leadingIndex = 0;
  }

  for (let index = leadingIndex; index < trailingIndex + 1; index++) {
    if (!indicesToMove.includes(index)) {
      displacedElements.push(elements[index]);
    }
  }

  const targetElements = Array.from(targetElementsMap.values());
  const leadingElements = elements.slice(0, leadingIndex);
  const trailingElements = elements.slice(trailingIndex + 1);
  const nextElements =
    direction === "left"
      ? [
          ...leadingElements,
          ...targetElements,
          ...displacedElements,
          ...trailingElements,
        ]
      : [
          ...leadingElements,
          ...displacedElements,
          ...targetElements,
          ...trailingElements,
        ];

  syncMovedIndices(nextElements, targetElementsMap);

  return nextElements;
};

function shiftElementsAccountingForFrames(
  allElements: readonly ExcalidrawElement[],
  appState: AppState,
  direction: "left" | "right",
  shiftFunction: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    direction: "left" | "right",
    containingFrame: ExcalidrawFrameLikeElement["id"] | null,
    elementsToBeMoved?: readonly ExcalidrawElement[],
  ) => ExcalidrawElement[] | readonly ExcalidrawElement[],
) {
  const elementsToMove = arrayToMap(
    getSelectedElements(allElements, appState, {
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    }),
  );

  const frameAwareContiguousElementsToMove: {
    regularElements: ExcalidrawElement[];
    frameChildren: Map<ExcalidrawFrameLikeElement["id"], ExcalidrawElement[]>;
  } = { regularElements: [], frameChildren: new Map() };

  const fullySelectedFrames = new Set<ExcalidrawFrameLikeElement["id"]>();

  for (const element of allElements) {
    if (elementsToMove.has(element.id) && isFrameLikeElement(element)) {
      fullySelectedFrames.add(element.id);
    }
  }

  for (const element of allElements) {
    if (elementsToMove.has(element.id)) {
      if (
        isFrameLikeElement(element) ||
        (element.frameId && fullySelectedFrames.has(element.frameId))
      ) {
        frameAwareContiguousElementsToMove.regularElements.push(element);
      } else if (!element.frameId) {
        frameAwareContiguousElementsToMove.regularElements.push(element);
      } else {
        const frameChildren =
          frameAwareContiguousElementsToMove.frameChildren.get(
            element.frameId,
          ) || [];
        frameChildren.push(element);
        frameAwareContiguousElementsToMove.frameChildren.set(
          element.frameId,
          frameChildren,
        );
      }
    }
  }

  let nextElements = allElements;

  const frameChildrenSets = Array.from(
    frameAwareContiguousElementsToMove.frameChildren.entries(),
  );

  for (const [frameId, children] of frameChildrenSets) {
    nextElements = shiftFunction(
      allElements,
      appState,
      direction,
      frameId,
      children,
    );
  }

  return shiftFunction(
    nextElements,
    appState,
    direction,
    null,
    frameAwareContiguousElementsToMove.regularElements,
  );
}

// public API
// -----------------------------------------------------------------------------

export const moveOneLeft = (
  allElements: readonly ExcalidrawElement[],
  appState: AppState,
  scene: Scene,
) => {
  return shiftElementsByOne(allElements, appState, "left", scene);
};

export const moveOneRight = (
  allElements: readonly ExcalidrawElement[],
  appState: AppState,
  scene: Scene,
) => {
  return shiftElementsByOne(allElements, appState, "right", scene);
};

export const moveAllLeft = (
  allElements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return shiftElementsAccountingForFrames(
    allElements,
    appState,
    "left",
    shiftElementsToEnd,
  );
};

export const moveAllRight = (
  allElements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return shiftElementsAccountingForFrames(
    allElements,
    appState,
    "right",
    shiftElementsToEnd,
  );
};
