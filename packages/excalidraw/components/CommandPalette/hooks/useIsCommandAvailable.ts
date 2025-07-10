import { useApp, useAppProps } from "../../App";
import { useUIAppState } from "../../../context/ui-appState";
import { useStableCallback } from "../../../hooks/useStableCallback";

import type { CommandPaletteItem } from "../types";
import type { AppState } from "../../../types";

export const useIsCommandAvailable = () => {
  const app = useApp();
  const appProps = useAppProps();
  const uiAppState = useUIAppState();

  return useStableCallback((command: CommandPaletteItem) => {
    if (command.viewMode === false && uiAppState.viewModeEnabled) {
      return false;
    }

    return typeof command.predicate === "function"
      ? command.predicate(
          app.scene.getNonDeletedElements(),
          uiAppState as AppState,
          appProps,
          app,
        )
      : command.predicate === undefined || command.predicate;
  });
};
