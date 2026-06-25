import { atom } from "./app-jotai";

import { loadActiveTabId, loadTabsMetadata } from "./data/tabsStore";

import type { Tab } from "./data/tabsStore";

/**
 * Atoms backing the multitab feature.
 *
 * These are hydrated from localStorage on module load (sync, cheap) so that
 * the TabBar can render immediately. The actual document content for each
 * tab lives in IndexedDB and is loaded async via DocumentStore.
 */

export const tabsAtom = atom<Tab[]>(loadTabsMetadata());

export const activeTabIdAtom = atom<string | null>(loadActiveTabId());

export const activeTabAtom = atom<Tab | null>((get) => {
  const id = get(activeTabIdAtom);
  if (!id) {
    return null;
  }
  const tabs = get(tabsAtom);
  return tabs.find((t) => t.id === id) ?? null;
});
