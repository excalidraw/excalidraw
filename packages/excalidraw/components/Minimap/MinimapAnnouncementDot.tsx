/**
 * TEMPORARY: a pulsing dot on the minimap toggle announcing the (new)
 * minimap. Stops showing on its own after `ANNOUNCEMENT_END` — remove this
 * file (and its uses) any time after.
 */

import { useEffect, useState } from "react";

import { EDITOR_LS_KEYS } from "@excalidraw/common";

import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { useAppStateValue } from "../../hooks/useAppStateValue";

import type { AppClassProperties } from "../../types";

/** shown through 2026-11-19 (UTC) */
const ANNOUNCEMENT_END = Date.UTC(2026, 10, 20);

/**
 * Whether the scene had content once the editor loaded, per editor instance
 * (i.e. per page load). An editor that loaded empty doesn't show the dot at
 * all, even once there's content.
 */
const hadContentOnLoad = new WeakMap<AppClassProperties, boolean>();

export const MinimapAnnouncementDot = ({
  app,
  minimapEnabled,
}: {
  app: AppClassProperties;
  minimapEnabled: boolean;
}) => {
  const isLoading = useAppStateValue("isLoading");
  const [isDismissed, setIsDismissed] = useState(
    () =>
      Date.now() >= ANNOUNCEMENT_END ||
      EditorLocalStorage.has(EDITOR_LS_KEYS.MINIMAP_ANNOUNCEMENT_DISMISSED),
  );

  // decided once, when the initial load is over (the toggle may be mounted
  // before it, or remounted after it)
  if (!isLoading && !hadContentOnLoad.has(app)) {
    hadContentOnLoad.set(app, app.scene.getNonDeletedElements().length > 0);
  }

  // dismissed for good once the minimap is opened, whichever way
  useEffect(() => {
    if (minimapEnabled && !isDismissed) {
      EditorLocalStorage.set(
        EDITOR_LS_KEYS.MINIMAP_ANNOUNCEMENT_DISMISSED,
        true,
      );
      setIsDismissed(true);
    }
  }, [minimapEnabled, isDismissed]);

  if (isDismissed || minimapEnabled || !hadContentOnLoad.get(app)) {
    return null;
  }

  return <span className="minimap-announcement-dot" aria-hidden="true" />;
};
