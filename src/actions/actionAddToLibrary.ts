import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { LibraryItem } from "../types";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState, _, app) => {
    const selectedElements: LibraryItem = {
      status: "unpublished",
      items: getSelectedElements(getNonDeletedElements(elements), appState).map(
        deepCopyElement,
      ),
    };
    app.library.loadLibrary().then((items) => {
      app.library.saveLibrary([...items, selectedElements]);
    });
    return false;
  },
  contextItemLabel: "labels.addToLibrary",
});
