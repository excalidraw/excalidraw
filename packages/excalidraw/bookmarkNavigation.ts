import { makeNextSelectedElementIds } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type React from "react";

import type { AppClassProperties, AppState } from "./types";

type SetAppState = React.Component<any, AppState>["setState"];

export const navigateToBookmark = (
  element: NonDeletedExcalidrawElement,
  app: AppClassProperties,
  setAppState?: SetAppState,
) => {
  app.viewport.setViewport({
    target: element,
    fit: "scale-down",
    animation: { duration: 300 },
    offsets: { ui: true },
  });

  const appStateUpdate = (prevState: Readonly<AppState>) => ({
    selectedElementIds: makeNextSelectedElementIds(
      { [element.id]: true },
      prevState,
    ),
    selectedGroupIds: {},
    editingGroupId: null,
    selectedLinearElement: null,
  });

  setAppState?.(appStateUpdate);
  app.focusContainer();

  return appStateUpdate;
};
