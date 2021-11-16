import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { randomId } from "../random";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState, _, app) => {
    app.library.loadLibrary().then((items) => {
      app.library.saveLibrary([
        ...items,
        {
          id: randomId(),
          status: "unpublished",
          elements: getSelectedElements(
            getNonDeletedElements(elements),
            appState,
          ).map(deepCopyElement),
        },
      ]);
    });
    return false;
  },
  contextItemLabel: "labels.addToLibrary",
});
