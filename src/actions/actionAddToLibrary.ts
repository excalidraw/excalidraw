import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { deepCopyElement } from "../element/newElement";
import { randomId } from "../random";
import { t } from "../i18n";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  perform: (elements, appState, _, app) => {
    return app.library
      .loadLibrary()
      .then((items) => {
        return app.library.saveLibrary([
          {
            id: randomId(),
            status: "unpublished",
            elements: getSelectedElements(
              getNonDeletedElements(elements),
              appState,
            ).map(deepCopyElement),
          },
          ...items,
        ]);
      })
      .then(() => {
        return {
          commitToHistory: false,
          appState: {
            ...appState,
            toastMessage: t("toast.addedToLibrary"),
          },
        };
      })
      .catch((error) => {
        return {
          commitToHistory: false,
          appState: {
            ...appState,
            errorMessage: error.message,
          },
        };
      });
  },
  contextItemLabel: "labels.addToLibrary",
});
