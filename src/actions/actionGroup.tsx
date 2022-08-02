import { KEYS } from "../keys";
import { t } from "../i18n";
import { arrayToMap, getShortcutKey } from "../utils";
import { register } from "./register";
import { UngroupIcon, GroupIcon } from "../components/icons";
import { newElementWith } from "../element/mutateElement";
import { getSelectedElements, isSomeElementSelected } from "../scene";
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
import { ToolButton } from "../components/ToolButton";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { AppState } from "../types";
import { isBoundToContainer } from "../element/typeChecks";

const allElementsInSameGroup = (elements: readonly ExcalidrawElement[]) => {
  if (elements.length >= 2) {
    const groupIds = elements[0].groupIds;
    for (const groupId of groupIds) {
      if (
        elements.reduce(
          (acc, element) => acc && isElementInGroup(element, groupId),
          true,
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

const enableActionGroup = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
    true,
  );
  return (
    selectedElements.length >= 2 && !allElementsInSameGroup(selectedElements)
  );
};

export const actionGroup = register({
  name: "group",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      true,
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
    const selectElementIds = arrayToMap(selectedElements);
    const updatedElements = elements.map((element) => {
      if (!selectElementIds.get(element.id)) {
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
    const lastGroupElementIndex =
      updatedElements.lastIndexOf(lastElementInGroup);
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
  contextItemLabel: "labels.group",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  keyTest: (event) =>
    !event.shiftKey && event[KEYS.CTRL_OR_CMD] && event.key === KEYS.G,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon theme={appState.theme} />}
      onClick={() => updateData(null)}
      title={`${t("labels.group")} — ${getShortcutKey("CtrlOrCmd+G")}`}
      aria-label={t("labels.group")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    ></ToolButton>
  ),
});

export const actionUngroup = register({
  name: "ungroup",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const groupIds = getSelectedGroupIds(appState);
    if (groupIds.length === 0) {
      return { appState, elements, commitToHistory: false };
    }

    const boundTextElementIds: ExcalidrawTextElement["id"][] = [];
    const nextElements = elements.map((element) => {
      if (isBoundToContainer(element)) {
        boundTextElementIds.push(element.id);
      }
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

    const updateAppState = selectGroupsForSelectedElements(
      { ...appState, selectedGroupIds: {} },
      getNonDeletedElements(nextElements),
    );

    // remove binded text elements from selection
    boundTextElementIds.forEach(
      (id) => (updateAppState.selectedElementIds[id] = false),
    );
    return {
      appState: updateAppState,

      elements: nextElements,
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event.shiftKey && event[KEYS.CTRL_OR_CMD] && event.key === KEYS.G,
  contextItemLabel: "labels.ungroup",
  contextItemPredicate: (elements, appState) =>
    getSelectedGroupIds(appState).length > 0,

  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      hidden={getSelectedGroupIds(appState).length === 0}
      icon={<UngroupIcon theme={appState.theme} />}
      onClick={() => updateData(null)}
      title={`${t("labels.ungroup")} — ${getShortcutKey("CtrlOrCmd+Shift+G")}`}
      aria-label={t("labels.ungroup")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    ></ToolButton>
  ),
});
