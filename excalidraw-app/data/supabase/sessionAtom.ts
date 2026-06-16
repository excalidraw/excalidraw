import { useEffect } from "react";

import { atom, useSetAtom } from "../../app-jotai";

import { getSession, onAuthStateChange } from "./auth";

import type { Session } from "@supabase/supabase-js";

/** The current auth session (or null when signed out / sync disabled). */
export const sessionAtom = atom<Session | null>(null);

/** Derived, read-only: the signed-in user id, or null. */
export const userIdAtom = atom((get) => get(sessionAtom)?.user?.id ?? null);

/**
 * Mount once near the app root. On mount it seeds `sessionAtom` from
 * `getSession()` and keeps it in sync via `onAuthStateChange`, unsubscribing on
 * cleanup. Null-safe: if Supabase isn't configured the wrappers no-op and the
 * session stays null.
 */
export const useInitSupabaseSession = (): void => {
  const setSession = useSetAtom(sessionAtom);

  useEffect(() => {
    let mounted = true;

    getSession().then((session) => {
      if (mounted) {
        setSession(session);
      }
    });

    const unsubscribe = onAuthStateChange((session) => {
      setSession(session);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
