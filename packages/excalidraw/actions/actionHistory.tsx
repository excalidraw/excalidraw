import {
  isWindows,
  KEYS,
  matchKey,
  arrayToMap,
  MOBILE_ACTION_BUTTON_BG,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { orderByFractionalIndex } from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import { ToolButton } from "../components/ToolButton";
import { UndoIcon, RedoIcon } from "../components/icons";
import { HistoryChangedEvent } from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { t } from "../i18n";

import { useStylesPanelMode } from "..";

import type { History } from "../history";
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

    // order by fractional indices in case the map was accidently modified in the meantime
    const nextElements = orderByFractionalIndex(
      Array.from(nextElementsMap.values()),
    );

    return {
      appState: nextAppState,
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  }

  return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
};

type ActionCreator = (history: History) => Action;

export const createUndoAction: ActionCreator = (history) => ({
  name: "undo",
  label: "buttons.undo",
  icon: UndoIcon,
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState, value, app) =>
    executeHistoryAction(app, appState, () =>
      history.undo(arrayToMap(elements) as SceneElementsMap, appState),
    ),
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && matchKey(event, KEYS.Z) && !event.shiftKey,
  PanelComponent: ({ appState, updateData, data, app }) => {
    const { isUndoStackEmpty } = useEmitter<HistoryChangedEvent>(
      history.onHistoryChangedEmitter,
      new HistoryChangedEvent(
        history.isUndoStackEmpty,
        history.isRedoStackEmpty,
      ),
    );
    const isMobile = useStylesPanelMode() === "mobile";

    return (
      <ToolButton
        type="button"
        icon={UndoIcon}
        aria-label={t("buttons.undo")}
        onClick={updateData}
        size={data?.size || "medium"}
        disabled={isUndoStackEmpty}
        data-testid="button-undo"
        style={{
          ...(isMobile ? MOBILE_ACTION_BUTTON_BG : {}),
        }}
      />
    );
  },
});

export const createRedoAction: ActionCreator = (history) => ({
  name: "redo",
  label: "buttons.redo",
  icon: RedoIcon,
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState, __, app) =>
    executeHistoryAction(app, appState, () =>
      history.redo(arrayToMap(elements) as SceneElementsMap, appState),
    ),
  keyTest: (event) =>
    (event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.Z)) ||
    (isWindows && event.ctrlKey && !event.shiftKey && matchKey(event, KEYS.Y)),
  PanelComponent: ({ appState, updateData, data, app }) => {
    const { isRedoStackEmpty } = useEmitter(
      history.onHistoryChangedEmitter,
      new HistoryChangedEvent(
        history.isUndoStackEmpty,
        history.isRedoStackEmpty,
      ),
    );
    const isMobile = useStylesPanelMode() === "mobile";

    return (
      <ToolButton
        type="button"
        icon={RedoIcon}
        aria-label={t("buttons.redo")}
        onClick={updateData}
        size={data?.size || "medium"}
        disabled={isRedoStackEmpty}
        data-testid="button-redo"
        style={{
          ...(isMobile ? MOBILE_ACTION_BUTTON_BG : {}),
        }}
      />
    );
  },
});
