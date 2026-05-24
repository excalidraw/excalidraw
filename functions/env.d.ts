interface Env {
  STATS: KVNamespace;
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
}

type PagesFunction<E = Env> =
  import("@cloudflare/workers-types").PagesFunction<E>;
