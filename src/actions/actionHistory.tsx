import { Action, ActionResult } from "./types";
import React from "react";
import { undo, redo } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { SceneHistory, HistoryEntry } from "../history";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { isWindows, KEYS } from "../keys";
import { getElementMap } from "../element";
import { newElementWith } from "../element/mutateElement";
import { fixBindingsAfterDeletion } from "../element/binding";

const writeData = (
  prevElements: readonly ExcalidrawElement[],
  appState: AppState,
  updater: () => HistoryEntry | null,
): ActionResult => {
  const commitToHistory = false;
  if (
    !appState.multiElement &&
    !appState.resizingElement &&
    !appState.editingElement &&
    !appState.draggingElement
  ) {
    const data = updater();
    if (data === null) {
      return { commitToHistory };
    }

    const prevElementMap = getElementMap(prevElements);
    const nextElements = data.elements;
    const nextElementMap = getElementMap(nextElements);

    const deletedElements = prevElements.filter(
      (prevElement) => !nextElementMap.hasOwnProperty(prevElement.id),
    );
    const elements = nextElements
      .map((nextElement) =>
        newElementWith(
          prevElementMap[nextElement.id] || nextElement,
          nextElement,
        ),
      )
      .concat(
        deletedElements.map((prevElement) =>
          newElementWith(prevElement, { isDeleted: true }),
        ),
      );
    fixBindingsAfterDeletion(elements, deletedElements);

    return {
      elements,
      appState: { ...appState, ...data.appState },
      commitToHistory,
      syncHistory: true,
    };
  }
  return { commitToHistory };
};

type ActionCreator = (history: SceneHistory) => Action;

export const createUndoAction: ActionCreator = (history) => ({
  name: "undo",
  perform: (elements, appState) =>
    writeData(elements, appState, () => history.undoOnce()),
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.key.toLowerCase() === KEYS.Z &&
    !event.shiftKey,
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={undo}
      aria-label={t("buttons.undo")}
      onClick={updateData}
    />
  ),
  commitToHistory: () => false,
});

export const createRedoAction: ActionCreator = (history) => ({
  name: "redo",
  perform: (elements, appState) =>
    writeData(elements, appState, () => history.redoOnce()),
  keyTest: (event) =>
    (event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      event.key.toLowerCase() === KEYS.Z) ||
    (isWindows && event.ctrlKey && !event.shiftKey && event.key === KEYS.Y),
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={redo}
      aria-label={t("buttons.redo")}
      onClick={updateData}
    />
  ),
  commitToHistory: () => false,
});
