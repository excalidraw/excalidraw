import type {
  AppState,
  InteractiveCanvasAppState,
} from "@excalidraw/excalidraw/types";

import { getBoundTextElement } from "./textElement";

import { isBoundToContainer } from "./typeChecks";

import type {
  GroupId,
  ExcalidrawElement,
  NonDeleted,
  ElementsMapOrArray,
  ElementsMap,
  NonDeletedExcalidrawElement,
  NonDeletedElementsMapOrArray,
} from "./types";

export const selectGroup = (
  groupId: GroupId,
  appState: InteractiveCanvasAppState,
  elements: readonly NonDeletedExcalidrawElement[],
): Pick<
  InteractiveCanvasAppState,
  "selectedGroupIds" | "selectedElementIds" | "editingGroupId"
> => {
  const elementsInGroup = elements.reduce(
    (acc: Record<string, true>, element) => {
      if (element.groupIds.includes(groupId)) {
        acc[element.id] = true;
      }
      return acc;
    },
    {},
  );

  if (Object.keys(elementsInGroup).length < 2) {
    if (
      appState.selectedGroupIds[groupId] ||
      appState.editingGroupId === groupId
    ) {
      return {
        selectedElementIds: appState.selectedElementIds,
        selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: false },
        editingGroupId: null,
      };
    }
    return appState;
  }

  return {
    editingGroupId: appState.editingGroupId,
    selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: true },
    selectedElementIds: {
      ...appState.selectedElementIds,
      ...elementsInGroup,
    },
  };
};

/**
 * If the element's group is selected, don't render an individual
 * selection border around it.
 */
export const isSelectedViaGroup = (
  appState: Pick<
    InteractiveCanvasAppState,
    "editingGroupId" | "selectedGroupIds"
  >,
  element: ExcalidrawElement,
) => getSelectedGroupForElement(appState, element) != null;

export const getSelectedGroupForElement = (
  appState: Pick<
    InteractiveCanvasAppState,
    "editingGroupId" | "selectedGroupIds"
  >,
  element: ExcalidrawElement,
) =>
  element.groupIds
    .filter((groupId) => groupId !== appState.editingGroupId)
    .find((groupId) => appState.selectedGroupIds[groupId]);

export const getSelectedGroupIds = (
  appState: Pick<InteractiveCanvasAppState, "selectedGroupIds">,
): GroupId[] =>
  Object.entries(appState.selectedGroupIds)
    .filter(([groupId, isSelected]) => isSelected)
    .map(([groupId, isSelected]) => groupId);

// given a list of elements, return the the actual group ids that should be selected
// or used to update the elements
export const selectGroupsFromGivenElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: InteractiveCanvasAppState,
) => {
  let nextAppState: InteractiveCanvasAppState = {
    ...appState,
    selectedGroupIds: {},
  };

  for (const element of elements) {
    let groupIds = element.groupIds;
    if (appState.editingGroupId) {
      const indexOfEditingGroup = groupIds.indexOf(appState.editingGroupId);
      if (indexOfEditingGroup > -1) {
        groupIds = groupIds.slice(0, indexOfEditingGroup);
      }
    }
    if (groupIds.length > 0) {
      const groupId = groupIds[groupIds.length - 1];
      nextAppState = {
        ...nextAppState,
        ...selectGroup(groupId, nextAppState, elements),
      };
    }
  }

  return nextAppState.selectedGroupIds;
};

export const editGroupForSelectedElement = (
  appState: AppState,
  element: NonDeleted<ExcalidrawElement>,
): AppState => {
  return {
    ...appState,
    editingGroupId: element.groupIds.length ? element.groupIds[0] : null,
    selectedGroupIds: {},
    selectedElementIds: {
      [element.id]: true,
    },
  };
};

export const isElementInGroup = (element: ExcalidrawElement, groupId: string) =>
  element.groupIds.includes(groupId);

export const getElementsInGroup = <
  P extends NonDeletedExcalidrawElement | ExcalidrawElement,
>(
  elements: P extends NonDeletedExcalidrawElement
    ? NonDeletedElementsMapOrArray
    : ElementsMapOrArray,
  groupId: string,
): P[] => {
  const elementsInGroup: P[] = [];
  for (const element of elements.values()) {
    if (isElementInGroup(element, groupId)) {
      elementsInGroup.push(element as P);
    }
  }
  return elementsInGroup;
};

export const getSelectedGroupIdForElement = (
  element: ExcalidrawElement,
  selectedGroupIds: { [groupId: string]: boolean },
) => element.groupIds.find((groupId) => selectedGroupIds[groupId]);

export const addToGroup = (
  prevGroupIds: ExcalidrawElement["groupIds"],
  newGroupId: GroupId,
  editingGroupId: AppState["editingGroupId"],
) => {
  // insert before the editingGroupId, or push to the end.
  const groupIds = [...prevGroupIds];
  const positionOfEditingGroupId = editingGroupId
    ? groupIds.indexOf(editingGroupId)
    : -1;
  const positionToInsert =
    positionOfEditingGroupId > -1 ? positionOfEditingGroupId : groupIds.length;
  groupIds.splice(positionToInsert, 0, newGroupId);
  return groupIds;
};

export const removeFromSelectedGroups = (
  groupIds: ExcalidrawElement["groupIds"],
  selectedGroupIds: { [groupId: string]: boolean },
) => groupIds.filter((groupId) => !selectedGroupIds[groupId]);

export const getMaximumGroups = <
  T extends NonDeletedExcalidrawElement | ExcalidrawElement,
>(
  elements: T[],
  elementsMap: ElementsMap,
): T[][] => {
  const groups: Map<String, T[]> = new Map<String, T[]>();
  elements.forEach((element: T) => {
    const groupId =
      element.groupIds.length === 0
        ? element.id
        : element.groupIds[element.groupIds.length - 1];

    const currentGroupMembers = groups.get(groupId) || [];

    // Include bound text if present when grouping
    const boundTextElement = getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      currentGroupMembers.push(boundTextElement as T);
    }
    groups.set(groupId, [...currentGroupMembers, element]);
  });

  return Array.from(groups.values());
};

export const getNonDeletedGroupIds = (elements: ElementsMap) => {
  const nonDeletedGroupIds = new Set<string>();

  for (const [, element] of elements) {
    // defensive check
    if (element.isDeleted) {
      continue;
    }

    // defensive fallback
    for (const groupId of element.groupIds ?? []) {
      nonDeletedGroupIds.add(groupId);
    }
  }

  return nonDeletedGroupIds;
};

export const elementsAreInSameGroup = (
  elements: readonly ExcalidrawElement[],
) => {
  const allGroups = elements.flatMap((element) => element.groupIds);
  const groupCount = new Map<string, number>();
  let maxGroup = 0;

  for (const group of allGroups) {
    groupCount.set(group, (groupCount.get(group) ?? 0) + 1);
    if (groupCount.get(group)! > maxGroup) {
      maxGroup = groupCount.get(group)!;
    }
  }

  return maxGroup === elements.length;
};

export const isInGroup = (element: ExcalidrawElement) => {
  return element.groupIds.length > 0;
};

export const getNewGroupIdsForDuplication = (
  groupIds: ExcalidrawElement["groupIds"],
  editingGroupId: AppState["editingGroupId"],
  mapper: (groupId: GroupId) => GroupId,
) => {
  const copy = [...groupIds];
  const positionOfEditingGroupId = editingGroupId
    ? groupIds.indexOf(editingGroupId)
    : -1;
  const endIndex =
    positionOfEditingGroupId > -1 ? positionOfEditingGroupId : groupIds.length;
  for (let index = 0; index < endIndex; index++) {
    copy[index] = mapper(copy[index]);
  }

  return copy;
};

// given a list of selected elements, return the element grouped by their immediate group selected state
// in the case if only one group is selected and all elements selected are within the group, it will respect group hierarchy in accordance to their nested grouping order
export const getSelectedElementsByGroup = (
  selectedElements: NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  appState: Readonly<Pick<AppState, "selectedGroupIds" | "editingGroupId">>,
): NonDeletedExcalidrawElement[][] => {
  const buckets: Map<string, NonDeletedExcalidrawElement[]> = new Map();
  const selectedGroupIds = getSelectedGroupIds(appState);
  const isSingleSelectedGroupCase =
    selectedGroupIds.length === 1 &&
    selectedElements.every((element) => isSelectedViaGroup(appState, element));

  selectedElements.forEach((element) => {
    // skip dependent boundTextElements, they are appended after their container
    if (isBoundToContainer(element)) {
      return;
    }

    let bucketKey: string;
    const selectedGroupId = getSelectedGroupIdForElement(
      element,
      appState.selectedGroupIds,
    );

    if (!selectedGroupId) {
      bucketKey = `${element.id}_element`;
    } else {
      // if only one group is selected, grouping is based on inner hierarchy
      const keyIndex = isSingleSelectedGroupCase
        ? element.groupIds.indexOf(selectedGroupId) - 1
        : element.groupIds.indexOf(selectedGroupId);

      // edge case: single selected group where element is non member of inner group
      bucketKey =
        keyIndex < 0
          ? `${element.id}_element`
          : `${element.groupIds[keyIndex]}_group`;
    }

    const currentBucketMembers = buckets.get(bucketKey) ?? [];
    const boundTextElement = getBoundTextElement(element, elementsMap);

    // preserve boundtext after container ordering
    buckets.set(bucketKey, [
      ...currentBucketMembers,
      element,
      ...(boundTextElement ? [boundTextElement] : []),
    ]);
  });
  return [...buckets.values()];
};
