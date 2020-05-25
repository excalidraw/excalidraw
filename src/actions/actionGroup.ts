import { KEYS } from "../keys";
import { register } from "./register";
import nanoid from "nanoid";
import { GroupId, ExcalidrawElement, NonDeleted } from "../element/types";
import { AppState } from "../types";
import { newElementWith } from "../element/mutateElement";
import { getSelectedElements, globalSceneState } from "../scene";

export function isSelectedViaGroup(
  appState: AppState,
  element: ExcalidrawElement,
) {
  return !!element.groupIds
    .filter((groupId) => groupId !== appState.editingGroupId)
    .find((groupId) => appState.selectedGroupIds[groupId]);
}

function selectGroup(
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

export const actionGroup = register({
  name: "group",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      elements.filter((element) => !element.isDeleted) as NonDeleted<
        ExcalidrawElement
      >[],
      appState,
    );
    if (selectedElements.length < 2) {
      // nothing to group
      return { appState, elements, commitToHistory: false };
    }
    // if everything is already grouped into 1 group, there is nothing to do
    const selectedGroupIds = getSelectedGroupIds(appState);
    if (selectedGroupIds.length === 1) {
      const selectedGroupId = selectedGroupIds[0];
      const elementIdsInGroup = new Set(
        elements
          .filter((element) => element.groupIds.includes(selectedGroupId))
          .map((element) => element.id),
      );
      const selectedElementIds = new Set(
        selectedElements.map((element) => element.id),
      );
      const combinedSet = new Set([
        ...Array.from(elementIdsInGroup),
        ...Array.from(selectedElementIds),
      ]);
      if (combinedSet.size === elementIdsInGroup.size) {
        // no incremental ids in the selected ids
        return { appState, elements, commitToHistory: false };
      }
    }
    const newGroupId = nanoid();
    const updatedElements = elements.map((element) => {
      if (!appState.selectedElementIds[element.id]) {
        return element;
      }
      return newElementWith(element, {
        groupIds: [...element.groupIds, newGroupId],
      });
    });
    return {
      appState: selectGroup(newGroupId, appState, updatedElements),
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.group",
  keyTest: (event) => {
    return (
      !event.shiftKey &&
      event[KEYS.CTRL_OR_CMD] &&
      event.altKey &&
      event.keyCode === 71
    );
  },
});

export function getSelectedGroupIds(appState: AppState): GroupId[] {
  return Object.entries(appState.selectedGroupIds)
    .filter(([groupId, isSelected]) => isSelected)
    .map(([groupId, isSelected]) => groupId);
}

export const actionUngroup = register({
  name: "ungroup",
  perform: (elements, appState) => {
    const groupIds = getSelectedGroupIds(appState);
    if (groupIds.length === 0) {
      return { appState, elements, commitToHistory: false };
    }
    return {
      appState: { ...appState, selectedGroupIds: {} },
      elements: elements.map((element) => {
        const filteredGroupIds = element.groupIds.filter(
          (groupId) => !appState.selectedGroupIds[groupId],
        );
        if (filteredGroupIds.length === element.groupIds.length) {
          return element;
        }
        return newElementWith(element, {
          groupIds: filteredGroupIds,
        });
      }),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.ungroup",
  keyTest: (event) => {
    return (
      event.shiftKey &&
      event[KEYS.CTRL_OR_CMD] &&
      event.altKey &&
      event.keyCode === 71
    );
  },
});

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
