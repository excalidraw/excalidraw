/**
 * Tab metadata store (localStorage) and legacy single-document migration.
 *
 * Metadata (id/name/timestamps) lives in localStorage so that the app boots
 * synchronously and can render the tab bar before IDB content resolves.
 * The actual drawing payload for each tab lives in DocumentStore (IDB).
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { activeTabIdAtom, tabsAtom } from "../tabs-atoms";

import { DocumentStore } from "./DocumentStore";
import { LocalData } from "./LocalData";

export type Tab = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export const generateTabId = (): string =>
  `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

const isValidTab = (value: unknown): value is Tab =>
  !!value &&
  typeof value === "object" &&
  typeof (value as Tab).id === "string" &&
  typeof (value as Tab).name === "string" &&
  typeof (value as Tab).createdAt === "number" &&
  typeof (value as Tab).updatedAt === "number";

export const loadTabsMetadata = (): Tab[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_TABS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidTab);
  } catch (error) {
    console.error("[tabsStore] loadTabsMetadata failed", error);
    return [];
  }
};

export const saveTabsMetadata = (tabs: readonly Tab[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_TABS, JSON.stringify(tabs));
  } catch (error) {
    console.error("[tabsStore] saveTabsMetadata failed", error);
  }
};

export const loadActiveTabId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_TAB);
  } catch (error) {
    console.error("[tabsStore] loadActiveTabId failed", error);
    return null;
  }
};

export const saveActiveTabId = (id: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_TAB, id);
  } catch (error) {
    console.error("[tabsStore] saveActiveTabId failed", error);
  }
};

/**
 * Removes the pre-multitab single-document keys from localStorage once their
 * payload has been migrated into IndexedDB (or when tabs already exist).
 */
export const clearLegacyLocalStorageDocument = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  } catch (error) {
    console.warn("[tabsStore] clearLegacyLocalStorageDocument failed", error);
  }
};

/**
 * Switches the active tab. Use this instead of writing activeTabIdAtom
 * directly — flushes the outgoing document and pauses saves before the id
 * changes so onChange cannot stamp the old scene onto the new tab.
 */
export const activateTab = (id: string): void => {
  LocalData.prepareForTabSwitch();
  appJotaiStore.set(activeTabIdAtom, id);
  saveActiveTabId(id);
};

export const createBlankTab = (name: string): Tab => {
  const now = Date.now();
  return {
    id: generateTabId(),
    name,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Returns a name like "Drawing N" that doesn't clash with existing tabs.
 */
export const getNextDefaultTabName = (existing: readonly Tab[]): string => {
  const baseName = "Drawing";
  const used = new Set(existing.map((t) => t.name));
  let n = 1;
  while (used.has(`${baseName} ${n}`)) {
    n += 1;
  }
  return `${baseName} ${n}`;
};

/**
 * Bootstrap helper. If no tab metadata exists yet:
 *   - Create a single "Drawing 1" tab
 *   - Move whatever was in the legacy `excalidraw` / `excalidraw-state`
 *     localStorage keys into IDB under that tab's id
 * Otherwise just normalizes the active tab id.
 */
export const migrateLegacyDocumentIfNeeded = async (): Promise<{
  tabs: Tab[];
  activeTabId: string;
}> => {
  const existing = loadTabsMetadata();

  if (existing.length > 0) {
    clearLegacyLocalStorageDocument();
    const stored = loadActiveTabId();
    const activeTabId =
      stored && existing.some((t) => t.id === stored) ? stored : existing[0].id;
    if (activeTabId !== stored) {
      saveActiveTabId(activeTabId);
    }
    return { tabs: existing, activeTabId };
  }

  const firstTab = createBlankTab("Drawing 1");

  let elements: ExcalidrawElement[] = [];
  let appState: Partial<AppState> = {};

  try {
    const legacyElements = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    );
    if (legacyElements) {
      const parsed = JSON.parse(legacyElements);
      if (Array.isArray(parsed)) {
        elements = parsed;
      }
    }
  } catch (error) {
    console.warn("[tabsStore] failed to parse legacy elements", error);
  }

  try {
    const legacyAppState = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
    );
    if (legacyAppState) {
      const parsed = JSON.parse(legacyAppState);
      if (parsed && typeof parsed === "object") {
        appState = parsed;
      }
    }
  } catch (error) {
    console.warn("[tabsStore] failed to parse legacy appState", error);
  }

  // Persist into IDB *before* writing tab metadata or clearing legacy keys.
  // If IDB fails (e.g. Safari private mode, quota), we keep the legacy data
  // intact so the next boot can retry without losing the user's drawing.
  try {
    await DocumentStore.saveDocument(firstTab.id, { elements, appState });
  } catch (error) {
    console.error(
      "[tabsStore] failed to persist legacy document into IDB; keeping legacy localStorage keys for retry on next boot",
      error,
    );
    // Fall back to an in-memory tab so the rest of the app can still boot.
    // The legacy keys are preserved; on the next successful boot the
    // migration will run again and write to IDB.
    return { tabs: [firstTab], activeTabId: firstTab.id };
  }

  const tabs = [firstTab];
  saveTabsMetadata(tabs);
  saveActiveTabId(firstTab.id);
  clearLegacyLocalStorageDocument();

  return { tabs, activeTabId: firstTab.id };
};

/**
 * Ensures the tabs feature is bootstrapped. Idempotent; the migration only
 * runs on the first call (or first boot post-upgrade). Pushes the resolved
 * state into the Jotai atoms so the rest of the app can read it sync.
 */
let tabsReadyPromise: Promise<{ tabs: Tab[]; activeTabId: string }> | null =
  null;

export const ensureTabsReady = (): Promise<{
  tabs: Tab[];
  activeTabId: string;
}> => {
  if (tabsReadyPromise) {
    return tabsReadyPromise;
  }
  tabsReadyPromise = migrateLegacyDocumentIfNeeded()
    .then((result) => {
      appJotaiStore.set(tabsAtom, result.tabs);
      appJotaiStore.set(activeTabIdAtom, result.activeTabId);
      return result;
    })
    .catch((error) => {
      // Allow a future call to retry instead of caching the rejection
      // forever — important because the migration touches IDB which can
      // fail transiently (locked DBs, private mode, quota).
      tabsReadyPromise = null;
      throw error;
    });
  return tabsReadyPromise;
};

/** @internal test helper */
export const resetTabsBootstrapForTests = (): void => {
  tabsReadyPromise = null;
};
