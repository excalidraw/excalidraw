import { useCallback, useEffect, useState } from "react";
import {
  importReminderStateFromLocalStorage,
  saveReminderStateToLocalStorage,
} from "excalidraw-app/data/localStorage";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Time is in ms
// export const REMINDER_TIERS = [
//   {
//     time: 604800000, // 1 week
//     elementsCount: 300,
//   },
//   {
//     time: 1209600000, // 2 weeks
//     elementsCount: 600,
//   },
//   {
//     time: 2419200000, // 4 weeks
//     elementsCount: 900,
//   },
// ];
export const REMINDER_TIERS = [
  {
    time: 15000,
    elementsCount: 10,
  },
  {
    time: 30000,
    elementsCount: 20,
  },
  {
    time: 45000,
    elementsCount: 30,
  },
];

export interface SaveReminderState {
  tier: number;
  lastSave: {
    timestamp: number;
    elementsCount: number;
  };
}

export interface SaveReminderProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export function SaveReminder(props: SaveReminderProps) {
  const { excalidrawAPI } = props;
  const [reminderState, setReminderState] = useState<SaveReminderState | null>(
    null,
  );
  const updateReminderState = useCallback((newState: SaveReminderState) => {
    setReminderState(newState);
    saveReminderStateToLocalStorage(newState);
  }, []);

  const handleNewScene = useCallback(() => {
    updateReminderState({
      tier: 0,
      lastSave: {
        timestamp: Date.now(),
        elementsCount: excalidrawAPI.getSceneElements().length,
      },
    });
  }, [excalidrawAPI, updateReminderState]);

  useEffect(() => {
    const localStorageReminderState = importReminderStateFromLocalStorage();
    if (localStorageReminderState === null) {
      handleNewScene();
    } else {
      setReminderState(localStorageReminderState);
    }

    const unsubOnLoad = excalidrawAPI.onLoad(handleNewScene);
    const unsubOnSave = excalidrawAPI.onSave(handleNewScene);
    const unsubOnReset = excalidrawAPI.onReset(handleNewScene);

    const unsubOnChange = excalidrawAPI.onChange(() => {
      if (!reminderState) {
        return;
      }
      const now = Date.now();
      if (reminderState.tier < REMINDER_TIERS.length) {
        const reminderTier = REMINDER_TIERS[reminderState.tier];
        const nonDeletedElements = excalidrawAPI.getSceneElements();
        if (
          now - reminderState.lastSave.timestamp >= reminderTier.time &&
          nonDeletedElements.length - reminderState.lastSave.elementsCount >=
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
          });
        }
      }
    });

    return () => {
      unsubOnLoad();
      unsubOnSave();
      unsubOnReset();
      unsubOnChange();
    };
  }, [excalidrawAPI, handleNewScene, reminderState, updateReminderState]);
}
