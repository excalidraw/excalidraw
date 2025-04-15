import { isWindows, KEYS, matchKey, arrayToMap } from "@excalidraw/common";

import type { SceneElementsMap } from "@excalidraw/element/types";

import { ToolButton } from "../components/ToolButton";
import { UndoIcon, RedoIcon } from "../components/icons";
import { HistoryChangedEvent } from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { t } from "../i18n";
import { CaptureUpdateAction } from "../store";

import type { History } from "../history";
import type { Store } from "../store";
import type { AppClassProperties, AppState } from "../types";
import type { Action, ActionResult } from "./types";

const executeHistoryAction = (
  app: AppClassProperties,
  appState: Readonly<AppState>,
  updater: () => [SceneElementsMap, AppState] | void,
): ActionResult => {
  if (
    !appState.multiElement &&
    !appState.resizingElement &&
    !appState.editingTextElement &&
    !appState.newElement &&
    !appState.selectedElementsAreBeingDragged &&
    !appState.selectionElement &&
    !app.flowChartCreator.isCreatingChart
  ) {
    const result = updater();

    if (!result) {
      return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
    }

    const [nextElementsMap, nextAppState] = result;
    const nextElements = Array.from(nextElementsMap.values());

    return {
      appState: nextAppState,
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  }

  return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
};

type ActionCreator = (history: History, store: Store) => Action;

export const createUndoAction: ActionCreator = (history, store) => ({
  name: "undo",
  label: "buttons.undo",
  icon: UndoIcon,
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState, value, app) =>
    executeHistoryAction(app, appState, () =>
      history.undo(
        arrayToMap(elements) as SceneElementsMap, // TODO: #7348 refactor action manager to already include `SceneElementsMap`
        appState,
        store.snapshot,
      ),
    ),
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && matchKey(event, KEYS.Z) && !event.shiftKey,
  PanelComponent: ({ updateData, data }) => {
    const { isUndoStackEmpty } = useEmitter<HistoryChangedEvent>(
      history.onHistoryChangedEmitter,
      new HistoryChangedEvent(
        history.isUndoStackEmpty,
        history.isRedoStackEmpty,
      ),
    );

    return (
      <ToolButton
        type="button"
        icon={UndoIcon}
        aria-label={t("buttons.undo")}
        onClick={updateData}
        size={data?.size || "medium"}
        disabled={isUndoStackEmpty}
        data-testid="button-undo"
      />
    );
  },
});

export const createRedoAction: ActionCreator = (history, store) => ({
  name: "redo",
  label: "buttons.redo",
  icon: RedoIcon,
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState, _, app) =>
    executeHistoryAction(app, appState, () =>
      history.redo(
        arrayToMap(elements) as SceneElementsMap, // TODO: #7348 refactor action manager to already include `SceneElementsMap`
        appState,
        store.snapshot,
      ),
    ),
  keyTest: (event) =>
    (event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.Z)) ||
    (isWindows && event.ctrlKey && !event.shiftKey && matchKey(event, KEYS.Y)),
  PanelComponent: ({ updateData, data }) => {
    const { isRedoStackEmpty } = useEmitter(
      history.onHistoryChangedEmitter,
      new HistoryChangedEvent(
        history.isUndoStackEmpty,
        history.isRedoStackEmpty,
      ),
    );

    return (
      <ToolButton
        type="button"
        icon={RedoIcon}
        aria-label={t("buttons.redo")}
        onClick={updateData}
        size={data?.size || "medium"}
        disabled={isRedoStackEmpty}
        data-testid="button-redo"
      />
    );
  },
});
