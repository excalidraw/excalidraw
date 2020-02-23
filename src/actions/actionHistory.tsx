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
  data: { elements: ExcalidrawElement[]; appState: AppState } | null,
) => {
  if (data !== null) {
    return {
      elements: data.elements,
      appState: { ...appState, ...data.appState },
    };
  }
  return {};
};

const testUndo = (shift: boolean) => (
  event: KeyboardEvent,
  appState: AppState,
) => event[KEYS.META] && /z/i.test(event.key) && event.shiftKey === shift;

export const createUndoAction: (h: SceneHistory) => Action = history => ({
  name: "undo",
  perform: (_, appState) =>
    [
      appState.multiElement,
      appState.resizingElement,
      appState.editingElement,
      appState.draggingElement,
    ].every(x => x === null)
      ? writeData(appState, history.undoOnce())
      : {},
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

export const createRedoAction: (h: SceneHistory) => Action = history => ({
  name: "redo",
  perform: (_, appState) =>
    [
      appState.multiElement,
      appState.resizingElement,
      appState.editingElement,
      appState.draggingElement,
    ].every(x => x === null)
      ? writeData(appState, history.redoOnce())
      : {},
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
