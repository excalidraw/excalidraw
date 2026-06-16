import { getSupabaseClient } from "./client";

import type { AuthError, Session } from "@supabase/supabase-js";

/**
 * Thin, null-safe wrappers over `supabase.auth`. Each resolves the client
 * first; when the client is `null` (sync disabled or unconfigured) it returns
 * a benign result instead of throwing, so callers never crash flag-off.
 */

/**
 * Sends an email magic link (uses `signInWithOtp` underneath). The
 * `emailRedirectTo` brings the user back to the app to complete the session.
 */
export const signInWithMagicLink = async (
  email: string,
): Promise<{ error: AuthError | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { error: null };
  }
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return { error };
};

export const signOut = async (): Promise<{ error: AuthError | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { error: null };
  }
  return client.auth.signOut();
};

export const getSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  const { data } = await client.auth.getSession();
  return data.session ?? null;
};

/**
 * Subscribes to auth changes; returns an unsubscribe function. When the client
 * is `null`, returns a no-op unsubscribe.
 */
export const onAuthStateChange = (
  cb: (session: Session | null) => void,
): (() => void) => {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    cb(session);
  });
  return () => {
    data.subscription.unsubscribe();
  };
};
