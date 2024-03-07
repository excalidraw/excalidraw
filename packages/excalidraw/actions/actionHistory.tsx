import { useEffect, useState } from "react";
import { Action, ActionResult, StoreAction } from "./types";
import { UndoIcon, RedoIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { History, HistoryChangedEvent } from "../history";
import { AppState } from "../types";
import { KEYS } from "../keys";
import { arrayToMap } from "../utils";
import { isWindows } from "../constants";
import { SceneElementsMap } from "../element/types";
import { IStore } from "../store";

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

const useEmitter = (emitter: History["onHistoryChangeEmitter"]) => {
  const [event, setEvent] = useState<HistoryChangedEvent>({
    isUndoStackEmpty: true,
    isRedoStackEmpty: true,
  });

  useEffect(() => {
    const unsubscribe = emitter.on((historyChangedEvent) => {
      setEvent(historyChangedEvent);
    });

    return () => {
      unsubscribe();
    };
  }, [emitter]);

  return event;
};

type ActionCreator = (history: History, store: IStore) => Action;

export const createUndoAction: ActionCreator = (history, store) => ({
  name: "undo",
  trackEvent: { category: "history" },
  perform: (elements, appState) =>
    writeData(appState, () =>
      history.undo(
        arrayToMap(elements) as SceneElementsMap, // TODO: refactor action manager to already include `SceneElementsMap`
        appState,
        store.snapshot,
      ),
    ),
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.key.toLowerCase() === KEYS.Z &&
    !event.shiftKey,
  PanelComponent: ({ updateData, data }) => {
    const { isUndoStackEmpty } = useEmitter(history.onHistoryChangeEmitter);

    return (
      <ToolButton
        type="button"
        icon={UndoIcon}
        aria-label={t("buttons.undo")}
        onClick={updateData}
        size={data?.size || "medium"}
        disabled={isUndoStackEmpty}
      />
    );
  },
});

export const createRedoAction: ActionCreator = (history, store) => ({
  name: "redo",
  trackEvent: { category: "history" },
  perform: (elements, appState) =>
    writeData(appState, () =>
      history.redo(
        arrayToMap(elements) as SceneElementsMap, // TODO: refactor action manager to already include `SceneElementsMap`
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
    const { isRedoStackEmpty } = useEmitter(history.onHistoryChangeEmitter);

    return (
      <ToolButton
        type="button"
        icon={RedoIcon}
        aria-label={t("buttons.redo")}
        onClick={updateData}
        size={data?.size || "medium"}
        disabled={isRedoStackEmpty}
      />
    );
  },
});
