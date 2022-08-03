import { newElementWith } from "../element/mutateElement";
import { ExcalidrawElement } from "../element/types";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { arrayToMap } from "../utils";
import { register } from "./register";

export const actionToggleLock = register({
  name: "toggleLock",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState, true);

    if (!selectedElements.length) {
      return false;
    }

    const operation = getOperation(selectedElements);
    const selectedElementsMap = arrayToMap(selectedElements);
    const lock = operation === "lock";
    return {
      elements: elements.map((element) => {
        if (!selectedElementsMap.has(element.id)) {
          return element;
        }

        return newElementWith(element, { locked: lock });
      }),
      appState: {
        ...appState,
        selectedLinearElement: lock ? null : appState.selectedLinearElement,
      },
      commitToHistory: true,
    };
  },
  contextItemLabel: (elements, appState) => {
    const selected = getSelectedElements(elements, appState, false);
    if (selected.length === 1) {
      return selected[0].locked
        ? "labels.elementLock.unlock"
        : "labels.elementLock.lock";
    }

    if (selected.length > 1) {
      return getOperation(selected) === "lock"
        ? "labels.elementLock.lockAll"
        : "labels.elementLock.unlockAll";
    }

    throw new Error(
      "Unexpected zero elements to lock/unlock. This should never happen.",
    );
  },
  keyTest: (event, appState, elements) => {
    return (
      event.key.toLocaleLowerCase() === KEYS.L &&
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      getSelectedElements(elements, appState, false).length > 0
    );
  },
});

const getOperation = (
  elements: readonly ExcalidrawElement[],
): "lock" | "unlock" => (elements.some((el) => !el.locked) ? "lock" : "unlock");
