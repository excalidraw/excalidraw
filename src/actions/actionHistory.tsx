import { Action } from "./types";
import React from "react";
import { undo, redo } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { SceneHistory } from "../history";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { KEYS } from "../keys";

const writeData = (
  appState: AppState,
  updater: () => { elements: ExcalidrawElement[]; appState: AppState } | null,
) => {
  if (
    [
      appState.multiElement,
      appState.resizingElement,
      appState.editingElement,
      appState.draggingElement,
    ].some(Boolean)
  ) {
    const data = updater();

    return data === null
      ? {}
      : {
          elements: data.elements,
          appState: { ...appState, ...data.appState },
        };
  }
  return {};
};

const testUndo = (shift: boolean) => (event: KeyboardEvent) =>
  event[KEYS.META] && /z/i.test(event.key) && event.shiftKey === shift;

type ActionCreator = (history: SceneHistory) => Action;

export const createUndoAction: ActionCreator = history => ({
  name: "undo",
  perform: (_, appState) => writeData(appState, () => history.undoOnce()),
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

export const createRedoAction: ActionCreator = history => ({
  name: "redo",
  perform: (_, appState) => writeData(appState, () => history.redoOnce()),
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
