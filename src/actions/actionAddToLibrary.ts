import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { Library } from "../data/library";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    Library.loadLibrary().then((items) => {
      Library.saveLibrary([...items, selectedElements.map(deepCopyElement)]);
    });
    return false;
  },
  contextItemLabel: "labels.addToLibrary",
});
