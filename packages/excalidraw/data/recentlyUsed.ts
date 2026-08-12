import { atom } from "jotai";

export const MAX_RECENT_LIBRARY_ITEMS = 20;

export const recentlyUsedLibraryItemsAtom = atom<string[]>([]);

export const trackRecentlyUsedAtom = atom(
  null,
  (get, set, id: string) => {
    const current = get(recentlyUsedLibraryItemsAtom);

    const updated = [
      id,
      ...current.filter((itemId) => itemId !== id),
    ].slice(0, MAX_RECENT_LIBRARY_ITEMS);

    set(recentlyUsedLibraryItemsAtom, updated);
  },
);

export const clearRecentlyUsedAtom = atom(
  null,
  (_get, set) => {
    set(recentlyUsedLibraryItemsAtom, []);
  },
);