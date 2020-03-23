import { Action, ActionResult } from "./types";
import React from "react";
import { undo, redo } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { SceneHistory } from "../history";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { KEYS } from "../keys";
import { getElementMap } from "../element";
import { newElementWith } from "../element/mutateElement";

const writeData = (
  prevElements: readonly ExcalidrawElement[],
  appState: AppState,
  updater: () => {
    elements: ExcalidrawElement[];
    appState: AppState;
  } | null,
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
    return {
      elements: nextElements
        .map((nextElement) =>
          newElementWith(
            prevElementMap[nextElement.id] || nextElement,
            nextElement,
          ),
        )
        .concat(
          prevElements
            .filter(
              (prevElement) => !nextElementMap.hasOwnProperty(prevElement.id),
            )
            .map((prevElement) =>
              newElementWith(prevElement, { isDeleted: true }),
            ),
        ),
      appState: { ...appState, ...data.appState },
      commitToHistory,
    };
  }
  return { commitToHistory };
};

const testUndo = (shift: boolean) => (event: KeyboardEvent) =>
  event[KEYS.CTRL_OR_CMD] && /z/i.test(event.key) && event.shiftKey === shift;

type ActionCreator = (history: SceneHistory) => Action;

export const createUndoAction: ActionCreator = (history) => ({
  name: "undo",
  perform: (elements, appState) =>
    writeData(elements, appState, () => history.undoOnce()),
  keyTest: testUndo(false),
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
  keyTest: testUndo(true),
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
