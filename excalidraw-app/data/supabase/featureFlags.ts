export const isSupabaseSyncEnabled = (): boolean =>
  import.meta.env.VITE_APP_FEATURE_SUPABASE_SYNC === "true";
