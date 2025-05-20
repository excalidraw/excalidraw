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

    let nextLockedSingleUnits = { ...appState.lockedUnits.singleUnits };
    let nextLockedMultiSelections = { ...appState.lockedUnits.multiSelections };

    if (nextLockState) {
      nextLockedSingleUnits = {
        ...appState.lockedUnits?.singleUnits,
        ...(isASingleUnit
          ? {
              [isAGroup
                ? selectedElements[0].groupIds.at(-1)!
                : selectedElements[0].id]: true,
            }
          : {}),
      };

      nextLockedMultiSelections = {
        ...appState.lockedUnits.multiSelections,
        ...(newGroupId ? { [newGroupId]: true } : {}),
      };
    } else if (isAGroup) {
      const groupId = selectedElements[0].groupIds.at(-1)!;
      delete nextLockedSingleUnits[groupId];
      delete nextLockedMultiSelections[groupId];
    } else {
      delete nextLockedSingleUnits[selectedElements[0].id];
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
          (groupId) => !appState.lockedUnits?.multiSelections?.[groupId],
        );
      }

      return newElementWith(element, {
        locked: nextLockState,
        groupIds: nextGroupIds,
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

    const hitLockedId = nextLockState
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
        lockedUnits: {
          singleUnits: nextLockedSingleUnits,
          multiSelections: nextLockedMultiSelections,
        },
        hitLockedId,
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

    const hasTemporaryGroupIds =
      Object.keys(appState.lockedUnits.multiSelections).length > 0;

    const nextElements = elements.map((element) => {
      if (element.locked) {
        // remove the temporary groupId if it exists
        const nextGroupIds = hasTemporaryGroupIds
          ? element.groupIds.filter(
              (gid) => !appState.lockedUnits.multiSelections[gid],
            )
          : element.groupIds;

        return newElementWith(element, {
          locked: false,
          groupIds: nextGroupIds,
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
        lockedUnits: {
          singleUnits: {},
          multiSelections: {},
        },
        hitLockedId: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  label: "labels.elementLock.unlockAll",
});
