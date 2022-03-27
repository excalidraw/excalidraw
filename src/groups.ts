import { GroupId, ExcalidrawElement, NonDeleted } from "./element/types";
import { AppState } from "./types";
import { getSelectedElements } from "./scene";
import { getBoundTextElement } from "./element/textElement";

export const selectGroup = (
  groupId: GroupId,
  appState: AppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
): AppState => {
  const elementsInGroup = elements.filter((element) =>
    element.groupIds.includes(groupId),
  );

  if (elementsInGroup.length < 2) {
    if (
      appState.selectedGroupIds[groupId] ||
      appState.editingGroupId === groupId
    ) {
      return {
        ...appState,
        selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: false },
        editingGroupId: null,
      };
    }
    return appState;
  }

  return {
    ...appState,
    selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: true },
    selectedElementIds: {
      ...appState.selectedElementIds,
      ...Object.fromEntries(
        elementsInGroup.map((element) => [element.id, true]),
      ),
    },
  };
};

/**
 * If the element's group is selected, don't render an individual
 * selection border around it.
 */
export const isSelectedViaGroup = (
  appState: AppState,
  element: ExcalidrawElement,
) => getSelectedGroupForElement(appState, element) != null;

export const getSelectedGroupForElement = (
  appState: AppState,
  element: ExcalidrawElement,
) =>
  element.groupIds
    .filter((groupId) => groupId !== appState.editingGroupId)
    .find((groupId) => appState.selectedGroupIds[groupId]);

export const getSelectedGroupIds = (appState: AppState): GroupId[] =>
  Object.entries(appState.selectedGroupIds)
    .filter(([groupId, isSelected]) => isSelected)
    .map(([groupId, isSelected]) => groupId);

/**
 * When you select an element, you often want to actually select the whole group it's in, unless
 * you're currently editing that group.
 */
export const selectGroupsForSelectedElements = (
  appState: AppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
): AppState => {
  let nextAppState: AppState = { ...appState, selectedGroupIds: {} };

  const selectedElements = getSelectedElements(elements, appState);

  if (!selectedElements.length) {
    return { ...nextAppState, editingGroupId: null };
  }

  for (const selectedElement of selectedElements) {
    let groupIds = selectedElement.groupIds;
    if (appState.editingGroupId) {
      // handle the case where a group is nested within a group
      const indexOfEditingGroup = groupIds.indexOf(appState.editingGroupId);
      if (indexOfEditingGroup > -1) {
        groupIds = groupIds.slice(0, indexOfEditingGroup);
      }
    }
    if (groupIds.length > 0) {
      const groupId = groupIds[groupIds.length - 1];
      nextAppState = selectGroup(groupId, nextAppState, elements);
    }
  }

  return nextAppState;
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

export const getElementsInGroup = (
  elements: readonly ExcalidrawElement[],
  groupId: string,
) => elements.filter((element) => isElementInGroup(element, groupId));

export const getSelectedGroupIdForElement = (
  element: ExcalidrawElement,
  selectedGroupIds: { [groupId: string]: boolean },
) => element.groupIds.find((groupId) => selectedGroupIds[groupId]);

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

export const getMaximumGroups = (
  elements: ExcalidrawElement[],
): ExcalidrawElement[][] => {
  const groups: Map<String, ExcalidrawElement[]> = new Map<
    String,
    ExcalidrawElement[]
  >();

  elements.forEach((element: ExcalidrawElement) => {
    const groupId =
      element.groupIds.length === 0
        ? element.id
        : element.groupIds[element.groupIds.length - 1];

    const currentGroupMembers = groups.get(groupId) || [];

    // Include bound text if present when grouping
    const boundTextElement = getBoundTextElement(element);
    if (boundTextElement) {
      currentGroupMembers.push(boundTextElement);
    }
    groups.set(groupId, [...currentGroupMembers, element]);
  });

  return Array.from(groups.values());
};
