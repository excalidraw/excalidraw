import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleElementBookmark = register({
  name: "toggleElementBookmark",
  label: (_elements, appState, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const bookmarkedElementIds = new Set(appState.bookmarkedElementIds);

    return selectedElements.every((element) =>
      bookmarkedElementIds.has(element.id),
    )
      ? "labels.elementBookmark.removeBookmark"
      : "labels.elementBookmark.bookmark";
  },
  trackEvent: { category: "element" },
  predicate: (_elements, appState, _appProps, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (_elements, appState, _formData, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (!selectedElements.length) {
      return false;
    }

    const selectedElementIds = new Set(
      selectedElements.map((element) => element.id),
    );
    const bookmarkedElementIds = new Set(appState.bookmarkedElementIds);
    const allSelectedAreBookmarked = selectedElements.every((element) =>
      bookmarkedElementIds.has(element.id),
    );

    return {
      appState: {
        ...appState,
        bookmarkedElementIds: allSelectedAreBookmarked
          ? appState.bookmarkedElementIds.filter(
              (id) => !selectedElementIds.has(id),
            )
          : [
              ...appState.bookmarkedElementIds,
              ...selectedElements
                .filter((element) => !bookmarkedElementIds.has(element.id))
                .map((element) => element.id),
            ],
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
