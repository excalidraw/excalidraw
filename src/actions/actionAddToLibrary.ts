import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { loadLibrary, saveLibrary } from "../data/localStorage";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    loadLibrary().then((items) => {
      saveLibrary([...items, selectedElements.map(deepCopyElement)]);
    });

    return false;
  },
  contextMenuOrder: 6,
  contextItemLabel: "labels.addToLibrary",
});
