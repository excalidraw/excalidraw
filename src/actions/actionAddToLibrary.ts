import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    app.library.loadLibrary().then((items) => {
      app.library.saveLibrary([
        ...items,
        selectedElements.map(deepCopyElement),
      ]);
    });
    return false;
  },
  contextItemLabel: "labels.addToLibrary",
});
