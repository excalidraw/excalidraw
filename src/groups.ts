import { GroupId, ExcalidrawElement } from "./element/types";
import { AppState } from "./types";
import { getSelectedElements, globalSceneState } from "./scene";

export function selectGroup(
  groupId: GroupId,
  appState: AppState,
  elements: readonly ExcalidrawElement[],
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
export function selectGroupsForSelectedElements(appState: AppState): AppState {
  let nextAppState = { ...appState };

  const selectedElements = getSelectedElements(
    globalSceneState.getElements(),
    appState,
  );

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
      nextAppState = selectGroup(
        groupId,
        nextAppState,
        globalSceneState.getElementsIncludingDeleted(),
      );
    }
  }

  return nextAppState;
}
