import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { Library } from "../data/library";
import { EVENT_LIBRARY, trackEvent } from "../analytics";

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
    trackEvent(EVENT_LIBRARY, "add1");
    return false;
  },
  contextMenuOrder: 6,
  contextItemLabel: "labels.addToLibrary",
});
