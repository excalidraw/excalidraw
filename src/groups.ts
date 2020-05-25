import { GroupId, ExcalidrawElement, NonDeleted } from "./element/types";
import { AppState } from "./types";
import { getSelectedElements } from "./scene";

export function selectGroup(
  groupId: GroupId,
  appState: AppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
): AppState {
  return {
    ...appState,
    selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: true },
    selectedElementIds: {
      ...appState.selectedElementIds,
      ...Object.fromEntries(
        elements
          .filter((element) => element.groupIds.includes(groupId))
          .map((element) => [element.id, true]),
      ),
    },
  };
}

/**
 * If the element's group is selected, don't render an individual
 * selection border around it.
 */
export function isSelectedViaGroup(
  appState: AppState,
  element: ExcalidrawElement,
) {
  return !!element.groupIds
    .filter((groupId) => groupId !== appState.editingGroupId)
    .find((groupId) => appState.selectedGroupIds[groupId]);
}

export function getSelectedGroupIds(appState: AppState): GroupId[] {
  return Object.entries(appState.selectedGroupIds)
    .filter(([groupId, isSelected]) => isSelected)
    .map(([groupId, isSelected]) => groupId);
}

/**
 * When you select an element, you often want to actually select the whole group it's in, unless
 * you're currently editing that group.
 */
export function selectGroupsForSelectedElements(
  appState: AppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
): AppState {
  let nextAppState = { ...appState };

  const selectedElements = getSelectedElements(elements, appState);

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
}

export function isElementInGroup(element: ExcalidrawElement, groupId: string) {
  return element.groupIds.includes(groupId);
}

export function getElementsInGroup(
  elements: readonly ExcalidrawElement[],
  groupId: string,
) {
  return elements.filter((element) => isElementInGroup(element, groupId));
}

export function getSelectedGroupIdForElement(
  element: ExcalidrawElement,
  selectedGroupIds: { [groupId: string]: boolean },
) {
  return element.groupIds.find((groupId) => selectedGroupIds[groupId]);
}

export function getNewGroupIdsForDuplication(
  groupIds: GroupId[],
  editingGroupId: GroupId | null,
  mapper: (groupId: GroupId) => GroupId,
) {
  const copy = [...groupIds];
  const positionOfEditingGroupId = editingGroupId
    ? groupIds.indexOf(editingGroupId)
    : -1;
  const endIndex =
    positionOfEditingGroupId > -1 ? positionOfEditingGroupId : groupIds.length;
  for (let i = 0; i < endIndex; i++) {
    copy[i] = mapper(copy[i]);
  }

  return copy;
}

export function addToGroup(
  prevGroupIds: GroupId[],
  newGroupId: GroupId,
  editingGroupId: GroupId | null,
) {
  // insert before the editingGroupId, or push to the end.
  const groupIds = [...prevGroupIds];
  const positionOfEditingGroupId = editingGroupId
    ? groupIds.indexOf(editingGroupId)
    : -1;
  const positionToInsert =
    positionOfEditingGroupId > -1 ? positionOfEditingGroupId : groupIds.length;
  groupIds.splice(positionToInsert, 0, newGroupId);
  return groupIds;
}

export function removeFromSelectedGroups(
  groupIds: GroupId[],
  selectedGroupIds: { [groupId: string]: boolean },
) {
  return groupIds.filter((groupId) => !selectedGroupIds[groupId]);
}
