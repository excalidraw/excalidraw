import { KEYS } from "../keys";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";
import { getSelectedElements } from "../scene";
import {
  getSelectedGroupIds,
  selectGroup,
  selectGroupsForSelectedElements,
  getElementsInGroup,
  addToGroup,
  removeFromSelectedGroups,
  isElementInGroup,
} from "../groups";
import { getNonDeletedElements } from "../element";
import { randomId } from "../random";

export const actionGroup = register({
  name: "group",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
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
        getElementsInGroup(elements, selectedGroupId).map(
          (element) => element.id,
        ),
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
    const newGroupId = randomId();
    const updatedElements = elements.map((element) => {
      if (!appState.selectedElementIds[element.id]) {
        return element;
      }
      return newElementWith(element, {
        groupIds: addToGroup(
          element.groupIds,
          newGroupId,
          appState.editingGroupId,
        ),
      });
    });
    // keep the z order within the group the same, but move them
    // to the z order of the highest element in the layer stack
    const elementsInGroup = getElementsInGroup(updatedElements, newGroupId);
    const lastElementInGroup = elementsInGroup[elementsInGroup.length - 1];
    const lastGroupElementIndex = updatedElements.lastIndexOf(
      lastElementInGroup,
    );
    const elementsAfterGroup = updatedElements.slice(lastGroupElementIndex + 1);
    const elementsBeforeGroup = updatedElements
      .slice(0, lastGroupElementIndex)
      .filter(
        (updatedElement) => !isElementInGroup(updatedElement, newGroupId),
      );
    const updatedElementsInOrder = [
      ...elementsBeforeGroup,
      ...elementsInGroup,
      ...elementsAfterGroup,
    ];

    return {
      appState: selectGroup(
        newGroupId,
        { ...appState, selectedGroupIds: {} },
        getNonDeletedElements(updatedElementsInOrder),
      ),
      elements: updatedElementsInOrder,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 4,
  contextItemLabel: "labels.group",
  keyTest: (event) => {
    return (
      !event.shiftKey &&
      event[KEYS.CTRL_OR_CMD] &&
      event.keyCode === KEYS.G_KEY_CODE
    );
  },
});

export const actionUngroup = register({
  name: "ungroup",
  perform: (elements, appState) => {
    const groupIds = getSelectedGroupIds(appState);
    if (groupIds.length === 0) {
      return { appState, elements, commitToHistory: false };
    }
    const nextElements = elements.map((element) => {
      const nextGroupIds = removeFromSelectedGroups(
        element.groupIds,
        appState.selectedGroupIds,
      );
      if (nextGroupIds.length === element.groupIds.length) {
        return element;
      }
      return newElementWith(element, {
        groupIds: nextGroupIds,
      });
    });
    return {
      appState: selectGroupsForSelectedElements(
        { ...appState, selectedGroupIds: {} },
        getNonDeletedElements(nextElements),
      ),
      elements: nextElements,
      commitToHistory: true,
    };
  },
  keyTest: (event) => {
    return (
      event.shiftKey &&
      event[KEYS.CTRL_OR_CMD] &&
      event.keyCode === KEYS.G_KEY_CODE
    );
  },
  contextMenuOrder: 5,
  contextItemLabel: "labels.ungroup",
});
