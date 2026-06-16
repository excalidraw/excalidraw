import type { AppState } from "@excalidraw/excalidraw/types";

/**
 * AppState keys that are `browser: true` (so they survive clearAppStateForLocalStorage)
 * but are pure viewport / selection / transient-UI state. They are stripped from the cloud
 * `app_state` AND excluded from the sync dirty-check, so pan/zoom/selection/menu/tool/mode
 * churn never marks the board dirty or triggers a push. Each key verified against
 * APP_STATE_STORAGE_CONF (packages/excalidraw/appState.ts).
 */
export const EPHEMERAL_APPSTATE_KEYS = [
  // viewport
  "scrollX",
  "scrollY",
  "zoom",
  "scrolledOutside",
  "shouldCacheIgnoreZoom",
  // selection
  "selectedElementIds",
  "selectedGroupIds",
  "previousSelectedElementIds",
  "selectedLinearElement",
  "editingGroupId",
  // transient UI / menus / pointer
  "openMenu",
  "openSidebar",
  "cursorButton",
  "lastPointerDownWith",
  "stats",
  // tool / mode UI state (LLD decision: ephemeral — excluded from cloud doc + dirty-check)
  "activeTool",
  "preferredSelectionTool",
  "zenModeEnabled",
  "objectsSnapModeEnabled",
  "penMode",
  "penDetected",
] as const;

export type EphemeralAppStateKey = typeof EPHEMERAL_APPSTATE_KEYS[number];

// Compile-time guarantee that every entry above is a real `AppState` key. If a key is
// renamed/removed from AppState, this assignment errors (the prettier 2.6.2 parser used by
// this repo's lint can't handle `as const satisfies`, so we assert separately).
const _ephemeralKeysAreAppStateKeys: ReadonlyArray<keyof AppState> =
  EPHEMERAL_APPSTATE_KEYS;
void _ephemeralKeysAreAppStateKeys;

const EPHEMERAL_SET = new Set<string>(EPHEMERAL_APPSTATE_KEYS);

/** Removes ephemeral keys from a (browser-subset) appState before upload / before dirty-compare. */
export const stripEphemeral = (
  appState: Partial<AppState>,
): Partial<AppState> => {
  const out: Partial<AppState> = {};
  for (const key of Object.keys(appState) as (keyof AppState)[]) {
    if (!EPHEMERAL_SET.has(key)) {
      (out as any)[key] = appState[key];
    }
  }
  return out;
};
