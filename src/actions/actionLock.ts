import { newElementWith } from "../element/mutateElement";
import { CODES, KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { register } from "./register";

export const actionLock = register({
  name: "lock",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState, false);
    const selectedElementIds = new Set(
      selectedElements.map((element) => element.id),
    );

    if (selectedElementIds.size === 0) {
      return false;
    }

    // It's safe to infer the operation from the first element because selection logic will ensure that selected elements are all of the same locked state
    const operation = selectedElements[0].locked ? "unlock" : "lock";

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
      return selected[0].locked
        ? "labels.lock.unlockAll"
        : "labels.lock.lockAll";
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

    return event.code === CODES.K && event[KEYS.CTRL_OR_CMD] && event.shiftKey;
  },
});
