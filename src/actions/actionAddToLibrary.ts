import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    return {
      appState: {
        ...appState,
        library: [...appState.library, selectedElements.map(deepCopyElement)],
      },
      commitToHistory: false,
    };
  },
  contextMenuOrder: 6,
  contextItemLabel: "labels.addToLibrary",
});
