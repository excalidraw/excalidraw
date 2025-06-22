import { memo, useCallback, useEffect, useRef } from "react";
import {
  importReminderStateFromLocalStorage,
  saveReminderStateToLocalStorage,
} from "excalidraw-app/data/localStorage";
import { t } from "@excalidraw/excalidraw/i18n";

import type {
  ExcalidrawImperativeAPI,
  UnsubscribeCallback,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

// Time is in ms
export const REMINDER_TIERS = [
  {
    time: 604800000, // 1 week
    elementsCount: 300,
  },
  {
    time: 604800000, // 1 week
    elementsCount: 600,
  },
  {
    time: 1209600000, // 2 weeks
    elementsCount: 900,
  },
];

export interface SaveReminderState {
  tier: number;
  timestamp: number;
  elementsCount: number;
}

export interface SaveReminderProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onSyncFromLocalStorage: (cb: () => void) => UnsubscribeCallback;
  onLoadedShareableLink: (
    cb: (elements: readonly ExcalidrawElement[]) => void,
  ) => UnsubscribeCallback;
}

export const SaveReminder = memo((props: SaveReminderProps) => {
  const { excalidrawAPI, onSyncFromLocalStorage, onLoadedShareableLink } =
    props;
  const reminderStateRef = useRef<SaveReminderState | null>(null);

  const updateReminderState = useCallback((newState: SaveReminderState) => {
    reminderStateRef.current = newState;
    saveReminderStateToLocalStorage(newState);
  }, []);

  const handleNewScene = useCallback(
    (elements: readonly NonDeletedExcalidrawElement[]) => {
      updateReminderState({
        tier: 0,
        timestamp: Date.now(),
        elementsCount: elements.length,
      });
    },
    [updateReminderState],
  );

  const syncFromLocalStorage = useCallback(() => {
    const localStorageReminderState = importReminderStateFromLocalStorage();
    if (localStorageReminderState === null) {
      handleNewScene(excalidrawAPI.getSceneElements());
    } else {
      reminderStateRef.current = localStorageReminderState;
    }
  }, [excalidrawAPI, handleNewScene]);

  useEffect(() => {
    syncFromLocalStorage();
  }, [syncFromLocalStorage]);

  useEffect(() => {
    const unsubOnLoad = excalidrawAPI.onLoadFromFile(handleNewScene);
    const unsubOnSave = excalidrawAPI.onSave(() =>
      handleNewScene(excalidrawAPI.getSceneElements()),
    );
    const unsubOnReset = excalidrawAPI.onReset(() => handleNewScene([]));
    const unsubOnLoadedShareableLink = onLoadedShareableLink(handleNewScene);
    const unsubOnSync = onSyncFromLocalStorage(syncFromLocalStorage);

    const unsubOnChange = excalidrawAPI.onChange(() => {
      const reminderState = reminderStateRef.current;
      if (!reminderState) {
        return;
      }
      const now = Date.now();
      if (reminderState.tier < REMINDER_TIERS.length) {
        const reminderTier = REMINDER_TIERS[reminderState.tier];
        const nonDeletedElements = excalidrawAPI.getSceneElements();
        if (
          now - reminderState.timestamp >= reminderTier.time &&
          nonDeletedElements.length - reminderState.elementsCount >=
            reminderTier.elementsCount
        ) {
          excalidrawAPI.updateScene({
            appState: {
              toast: {
                message: t("toast.rememberToSave"),
              },
            },
          });
          updateReminderState({
            ...reminderState,
            tier: reminderState.tier + 1,
            timestamp: Date.now(),
          });
        }
      }
    });

    return () => {
      unsubOnLoad();
      unsubOnSave();
      unsubOnReset();
      unsubOnLoadedShareableLink();
      unsubOnSync();
      unsubOnChange();
    };
  }, [
    excalidrawAPI,
    handleNewScene,
    onLoadedShareableLink,
    onSyncFromLocalStorage,
    syncFromLocalStorage,
    updateReminderState,
  ]);

  return null;
});
