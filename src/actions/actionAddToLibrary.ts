import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { globalLibraryState } from "../libraryState";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    globalLibraryState.replaceLibrary((items) => [
      ...items,
      selectedElements.map(deepCopyElement),
    ]);

    return false;
  },
  contextMenuOrder: 6,
  contextItemLabel: "labels.addToLibrary",
});
