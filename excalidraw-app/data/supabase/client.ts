import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseSyncEnabled } from "./featureFlags";

// `undefined` = not yet resolved; `null` = resolved-to-disabled (flag off or
// env missing) so we don't re-evaluate on every call.
let client: SupabaseClient | null | undefined = undefined;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (client !== undefined) {
    return client;
  }

  if (!isSupabaseSyncEnabled()) {
    client = null;
    return client;
  }

  const url = import.meta.env.VITE_APP_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_APP_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[supabase-sync] sync is enabled but VITE_APP_SUPABASE_URL / VITE_APP_SUPABASE_ANON_KEY are not configured — falling back to local-only.",
    );
    client = null;
    return client;
  }

  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  return client;
};
