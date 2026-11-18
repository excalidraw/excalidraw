import { CODES, KEYS, isWritableElement } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { navigateToBookmark } from "../bookmarkNavigation";

import { register } from "./register";

import type React from "react";

import type { AppClassProperties, AppState } from "../types";

const navigateToAdjacentBookmark = (
  direction: "next" | "previous",
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const bookmarkedElements: NonDeletedExcalidrawElement[] = [];

  for (const id of appState.bookmarkedElementIds) {
    const element = elementsMap.get(id);
    if (element) {
      bookmarkedElements.push(element);
    }
  }

  if (!bookmarkedElements.length) {
    return false;
  }

  const currentIndex = bookmarkedElements.findIndex(
    (element) => appState.selectedElementIds[element.id],
  );
  const targetIndex =
    currentIndex === -1
      ? direction === "next"
        ? 0
        : bookmarkedElements.length - 1
      : (currentIndex +
          (direction === "next" ? 1 : -1) +
          bookmarkedElements.length) %
        bookmarkedElements.length;
  const appStateUpdate = navigateToBookmark(
    bookmarkedElements[targetIndex],
    app,
  );

  return {
    appState: appStateUpdate(appState),
    captureUpdate: CaptureUpdateAction.NEVER,
  };
};

const canNavigate = (
  event: React.KeyboardEvent | KeyboardEvent,
  appState: Readonly<AppState>,
  code: string,
) =>
  event[KEYS.CTRL_OR_CMD] &&
  event.altKey &&
  event.shiftKey &&
  event.code === code &&
  !isWritableElement(event.target) &&
  !appState.openDialog &&
  !appState.editingTextElement &&
  !appState.selectedLinearElement?.isEditing;

export const actionNextBookmark = register({
  name: "nextBookmark",
  label: "labels.elementBookmark.next",
  trackEvent: { category: "canvas" },
  viewMode: true,
  navigation: true,
  perform: (_elements, appState, _formData, app) =>
    navigateToAdjacentBookmark("next", appState, app),
  keyTest: (event, appState) =>
    canNavigate(event, appState, CODES.BRACKET_RIGHT),
});

export const actionPreviousBookmark = register({
  name: "previousBookmark",
  label: "labels.elementBookmark.previous",
  trackEvent: { category: "canvas" },
  viewMode: true,
  navigation: true,
  perform: (_elements, appState, _formData, app) =>
    navigateToAdjacentBookmark("previous", appState, app),
  keyTest: (event, appState) =>
    canNavigate(event, appState, CODES.BRACKET_LEFT),
});
