import type { Action, ActionResult } from "./types";
import { UndoIcon, RedoIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import type { History } from "../history";
import { HistoryChangedEvent } from "../history";
import type { AppState } from "../types";
import { KEYS } from "../keys";
import { arrayToMap } from "../utils";
import { isWindows } from "../constants";
import type { SceneElementsMap } from "../element/types";
import type { Store } from "../store";
import { StoreAction } from "../store";
import { useEmitter } from "../hooks/useEmitter";

const writeData = (
  appState: Readonly<AppState>,
  updater: () => [SceneElementsMap, AppState] | void,
): ActionResult => {
  if (
    !appState.multiElement &&
    !appState.resizingElement &&
    !appState.editingElement &&
    !appState.draggingElement
  ) {
    const result = updater();

    if (!result) {
      return { storeAction: StoreAction.NONE };
    }

    const [nextElementsMap, nextAppState] = result;
    const nextElements = Array.from(nextElementsMap.values());

    return {
      appState: nextAppState,
      elements: nextElements,
      storeAction: StoreAction.UPDATE,
    };
  }

  return { storeAction: StoreAction.NONE };
};

type ActionCreator = (history: History, store: Store) => Action;

export const createUndoAction: ActionCreator = (history, store) => ({
  name: "undo",
  label: "buttons.undo",
  icon: UndoIcon,
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState) =>
    writeData(appState, () =>
      history.undo(
        arrayToMap(elements) as SceneElementsMap, // TODO: #7348 refactor action manager to already include `SceneElementsMap`
        appState,
        store.snapshot,
      ),
    ),
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.key.toLowerCase() === KEYS.Z &&
    !event.shiftKey,
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
  perform: (elements, appState) =>
    writeData(appState, () =>
      history.redo(
        arrayToMap(elements) as SceneElementsMap, // TODO: #7348 refactor action manager to already include `SceneElementsMap`
        appState,
        store.snapshot,
      ),
    ),
  keyTest: (event) =>
    (event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      event.key.toLowerCase() === KEYS.Z) ||
    (isWindows && event.ctrlKey && !event.shiftKey && event.key === KEYS.Y),
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
