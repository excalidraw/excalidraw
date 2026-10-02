import { getLibraryItemsHash } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef } from "react";

import type {
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types";

import { get, put } from "../api/client";

/**
 * Keeps the editor's library in sync with the user's server-side personal library.
 * Loading does not echo back, and failed saves are retried with backoff / on reconnect.
 */
export const usePersonalLibrary = (enabled: boolean) => {
  const lastHash = useRef<number | null>(null);
  const pending = useRef<LibraryItems | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);

  const push = useCallback(async () => {
    const items = pending.current;
    if (!items) {
      return;
    }
    try {
      await put("/libraries/personal", { items });
      pending.current = null;
      failures.current = 0;
    } catch (e: any) {
      // permanent client errors are dropped; network/server errors are retried
      if (e?.status && e.status < 500 && e.status !== 429 && e.status !== 408) {
        console.warn("library not saved:", e.message);
        pending.current = null;
        return;
      }
      failures.current++;
      timer.current = setTimeout(
        () => void push(),
        Math.min(30_000, 2000 * 2 ** failures.current),
      );
    }
  }, []);

  const onLibraryChange = useCallback(
    (items: LibraryItems) => {
      if (!enabled) {
        return;
      }
      const hash = getLibraryItemsHash(items);
      if (hash === lastHash.current) {
        return; // the change we just loaded from the server
      }
      lastHash.current = hash;
      pending.current = items;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => void push(), 800);
    },
    [enabled, push],
  );

  const load = useCallback(
    async (api: ExcalidrawImperativeAPI) => {
      if (!enabled) {
        return;
      }
      try {
        const { items } = await get("/libraries/personal");
        lastHash.current = getLibraryItemsHash(items);
        await api.updateLibrary({
          libraryItems: items,
          merge: false,
          defaultStatus: "unpublished",
        } as any);
      } catch {
        /* offline: the editor keeps working with an empty library */
      }
    },
    [enabled],
  );

  useEffect(() => {
    const online = () => void push();
    const flush = () => {
      if (pending.current) {
        void push();
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", flush);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      flush();
    };
  }, [push]);

  return { load, onLibraryChange };
};
