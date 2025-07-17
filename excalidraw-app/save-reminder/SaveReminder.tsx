import { memo, useCallback, useEffect, useRef } from "react";
import {
  importReminderStateFromLocalStorage,
  saveReminderStateToLocalStorage,
} from "excalidraw-app/data/localStorage";
import { t } from "@excalidraw/excalidraw/i18n";
import {
  isBrowserStorageStateNewer,
  updateBrowserStateVersion,
} from "excalidraw-app/data/tabSync";
import { STORAGE_KEYS } from "excalidraw-app/app_constants";

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
  baseElementsCount: number;
}

export interface SaveReminderProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onSyncDataSubscriber?: (cb: () => void) => UnsubscribeCallback;
  onLoadFromLinkSubscriber?: (
    cb: (elements: readonly ExcalidrawElement[]) => void,
  ) => UnsubscribeCallback;
}

export const SaveReminder = memo((props: SaveReminderProps) => {
  const { excalidrawAPI, onSyncDataSubscriber, onLoadFromLinkSubscriber } =
    props;
  const reminderStateRef = useRef<SaveReminderState | null>(null);

  const updateReminderState = useCallback((newState: SaveReminderState) => {
    reminderStateRef.current = newState;
    saveReminderStateToLocalStorage(newState);
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_SAVE_REMINDER);
  }, []);

  const resetReminderState = useCallback(
    (elements: readonly NonDeletedExcalidrawElement[]) => {
      updateReminderState({
        tier: 0,
        timestamp: Date.now(),
        baseElementsCount: elements.length,
      });
    },
    [updateReminderState],
  );

  const syncFromLocalStorage = useCallback(() => {
    const localStorageReminderState = importReminderStateFromLocalStorage();
    if (localStorageReminderState === null) {
      resetReminderState(excalidrawAPI.getSceneElements());
    } else {
      reminderStateRef.current = localStorageReminderState;
      updateBrowserStateVersion(STORAGE_KEYS.VERSION_SAVE_REMINDER);
    }
  }, [excalidrawAPI, resetReminderState]);

  useEffect(() => {
    syncFromLocalStorage();
  }, [syncFromLocalStorage]);

  useEffect(() => {
    const unsubOnLoad = excalidrawAPI.onLoadFromFile(resetReminderState);
    const unsubOnSave = excalidrawAPI.onSave(() =>
      resetReminderState(excalidrawAPI.getSceneElements()),
    );
    const unsubOnReset = excalidrawAPI.onReset(() => resetReminderState([]));
    const unsubOnLoadFromLink = onLoadFromLinkSubscriber?.(resetReminderState);
    const unsubOnSyncData = onSyncDataSubscriber?.(() => {
      if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_SAVE_REMINDER)) {
        syncFromLocalStorage();
      }
    });

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
          nonDeletedElements.length - reminderState.baseElementsCount >=
            reminderTier.elementsCount
        ) {
          excalidrawAPI.setToast({
            message: t("toast.rememberToSave"),
            closable: true,
            duration: 10000,
            type: "warning",
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
      unsubOnLoadFromLink?.();
      unsubOnSyncData?.();
      unsubOnChange();
    };
  }, [
    excalidrawAPI,
    resetReminderState,
    onLoadFromLinkSubscriber,
    onSyncDataSubscriber,
    syncFromLocalStorage,
    updateReminderState,
  ]);

  return null;
});
