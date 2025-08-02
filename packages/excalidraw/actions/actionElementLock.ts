import { KEYS, arrayToMap, randomId } from "@excalidraw/common";

import {
  elementsAreInSameGroup,
  newElementWith,
  selectGroupsFromGivenElements,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { LockedIcon, UnlockedIcon } from "../components/icons";

import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppState } from "../types";

const shouldLock = (elements: readonly ExcalidrawElement[]) =>
  elements.every((el) => !el.locked);

export const actionToggleElementLock = register({
  name: "toggleElementLock",
  label: (elements, appState, app) => {
    const selected = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });

    return shouldLock(selected)
      ? "labels.elementLock.lock"
      : "labels.elementLock.unlock";
  },
  icon: (appState, elements) => {
    const selectedElements = getSelectedElements(elements, appState);
    return shouldLock(selectedElements) ? LockedIcon : UnlockedIcon;
  },
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return (
      selectedElements.length > 0 &&
      !selectedElements.some((element) => element.locked && element.frameId)
    );
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    if (!selectedElements.length) {
      return false;
    }

    const nextLockState = shouldLock(selectedElements);
    const selectedElementsMap = arrayToMap(selectedElements);

    const isAGroup =
      selectedElements.length > 1 && elementsAreInSameGroup(selectedElements);
    const isASingleUnit = selectedElements.length === 1 || isAGroup;
    const newGroupId = isASingleUnit ? null : randomId();

    let nextLockedMultiSelections = { ...appState.lockedMultiSelections };

    if (nextLockState) {
      nextLockedMultiSelections = {
        ...appState.lockedMultiSelections,
        ...(newGroupId ? { [newGroupId]: true } : {}),
      };
    } else if (isAGroup) {
      const groupId = selectedElements[0].groupIds.at(-1)!;
      delete nextLockedMultiSelections[groupId];
    }

    const nextElements = elements.map((element) => {
      if (!selectedElementsMap.has(element.id)) {
        return element;
      }

      let nextGroupIds = element.groupIds;

      // if locking together, add to group
      // if unlocking, remove the temporary group
      if (nextLockState) {
        if (newGroupId) {
          nextGroupIds = [...nextGroupIds, newGroupId];
        }
      } else {
        nextGroupIds = nextGroupIds.filter(
          (groupId) => !appState.lockedMultiSelections[groupId],
        );
      }

      return newElementWith(element, {
        locked: nextLockState,
        // do not recreate the array unncessarily
        groupIds:
          nextGroupIds.length !== element.groupIds.length
            ? nextGroupIds
            : element.groupIds,
      });
    });

    const nextElementsMap = arrayToMap(nextElements);
    const nextSelectedElementIds: AppState["selectedElementIds"] = nextLockState
      ? {}
      : Object.fromEntries(selectedElements.map((el) => [el.id, true]));
    const unlockedSelectedElements = selectedElements.map(
      (el) => nextElementsMap.get(el.id) || el,
    );
    const nextSelectedGroupIds = nextLockState
      ? {}
      : selectGroupsFromGivenElements(unlockedSelectedElements, appState);

    const activeLockedId = nextLockState
      ? newGroupId
        ? newGroupId
        : isAGroup
        ? selectedElements[0].groupIds.at(-1)!
        : selectedElements[0].id
      : null;

    return {
      elements: nextElements,

      appState: {
        ...appState,
        selectedElementIds: nextSelectedElementIds,
        selectedGroupIds: nextSelectedGroupIds,
        selectedLinearElement: nextLockState
          ? null
          : appState.selectedLinearElement,
        lockedMultiSelections: nextLockedMultiSelections,
        activeLockedId,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event, appState, elements, app) => {
    return (
      event.key.toLocaleLowerCase() === KEYS.L &&
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: false,
      }).length > 0
    );
  },
});

export const actionUnlockAllElements = register({
  name: "unlockAllElements",
  trackEvent: { category: "canvas" },
  viewMode: false,
  icon: UnlockedIcon,
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 0 &&
      elements.some((element) => element.locked)
    );
  },
  perform: (elements, appState) => {
    const lockedElements = elements.filter((el) => el.locked);

    const nextElements = elements.map((element) => {
      if (element.locked) {
        // remove the temporary groupId if it exists
        const nextGroupIds = element.groupIds.filter(
          (gid) => !appState.lockedMultiSelections[gid],
        );

        return newElementWith(element, {
          locked: false,
          groupIds:
            // do not recreate the array unncessarily
            element.groupIds.length !== nextGroupIds.length
              ? nextGroupIds
              : element.groupIds,
        });
      }
      return element;
    });

    const nextElementsMap = arrayToMap(nextElements);

    const unlockedElements = lockedElements.map(
      (el) => nextElementsMap.get(el.id) || el,
    );

    return {
      elements: nextElements,
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          lockedElements.map((el) => [el.id, true]),
        ),
        selectedGroupIds: selectGroupsFromGivenElements(
          unlockedElements,
          appState,
        ),
        lockedMultiSelections: {},
        activeLockedId: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  label: "labels.elementLock.unlockAll",
});
