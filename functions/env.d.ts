interface Env {
  STATS: KVNamespace;
  LAYOUT_CACHE: KVNamespace;
  DB: D1Database;
  PRESETS_DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
}

type PagesFunction<E = Env> =
  import("@cloudflare/workers-types").PagesFunction<E>;
