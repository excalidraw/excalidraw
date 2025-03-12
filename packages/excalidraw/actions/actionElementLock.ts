import { LockedIcon, UnlockedIcon } from "../components/icons";
import { newElementWith } from "../element/mutateElement";
import { isFrameLikeElement } from "../element/typeChecks";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { CaptureUpdateAction } from "../store";
import { arrayToMap } from "../utils";

import { register } from "./register";

import type { ExcalidrawElement } from "../element/types";

const shouldLock = (elements: readonly ExcalidrawElement[]) =>
  elements.every((el) => !el.locked);

export const actionToggleElementLock = register({
  name: "toggleElementLock",
  label: (elements, appState, app) => {
    const selected = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });
    if (selected.length === 1 && !isFrameLikeElement(selected[0])) {
      return selected[0].locked
        ? "labels.elementLock.unlock"
        : "labels.elementLock.lock";
    }

    return shouldLock(selected)
      ? "labels.elementLock.lockAll"
      : "labels.elementLock.unlockAll";
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
    return {
      elements: elements.map((element) => {
        if (!selectedElementsMap.has(element.id)) {
          return element;
        }

        return newElementWith(element, { locked: nextLockState });
      }),
      appState: {
        ...appState,
        selectedLinearElement: nextLockState
          ? null
          : appState.selectedLinearElement,
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
  paletteName: "Unlock all elements",
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

    return {
      elements: elements.map((element) => {
        if (element.locked) {
          return newElementWith(element, { locked: false });
        }
        return element;
      }),
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          lockedElements.map((el) => [el.id, true]),
        ),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  label: "labels.elementLock.unlockAll",
});
