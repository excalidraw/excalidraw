import { newElementWith } from "../element/mutateElement";
import { ExcalidrawElement } from "../element/types";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { register } from "./register";

export const actionToggleLock = register({
  name: "toggleLock",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState, true);
    const selectedElementIds = new Set(
      selectedElements.map((element) => element.id),
    );

    if (selectedElementIds.size === 0) {
      return false;
    }

    const operation = getOperation(selectedElements);

    return {
      elements: elements.map((element) => {
        if (!selectedElementIds.has(element.id)) {
          return element;
        }

        return newElementWith(element, { locked: operation === "lock" });
      }),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: (elements, appState) => {
    const selected = getSelectedElements(elements, appState, false);
    if (selected.length === 1) {
      return selected[0].locked ? "labels.lock.unlock" : "labels.lock.lock";
    }

    if (selected.length > 1) {
      return getOperation(selected) === "lock"
        ? "labels.lock.lockAll"
        : "labels.lock.unlockAll";
    }

    throw new Error(
      "Unexpected zero elements to lock. This should never happen.",
    );
  },
  keyTest: (event, appState, elements) => {
    const selected = getSelectedElements(elements, appState, false);
    if (selected.length === 0) {
      return false;
    }

    return (
      event.key.toLocaleLowerCase() === KEYS.L &&
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey
    );
  },
});

const getOperation = (
  elements: readonly ExcalidrawElement[],
): "lock" | "unlock" => (elements.some((el) => !el.locked) ? "lock" : "unlock");
