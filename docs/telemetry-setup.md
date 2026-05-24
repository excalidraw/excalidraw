# Telemetry API setup (Cloudflare Pages Functions)

## Resources (already in `wrangler.jsonc`)

- **D1** `tfdraw-analytics` — email signups (`emails` table)
- **KV** `TFDRAW_STATS` — counters `import_success`, `import_fail`

Apply schema after changes:

```bash
npx wrangler d1 execute tfdraw-analytics --remote --file=./functions/schema.sql
```

## Turnstile (recommended for production)

1. Create a Turnstile widget in the Cloudflare dashboard.
2. Set the **Pages** secret:

   ```bash
   npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=YOUR_PAGES_PROJECT
   ```

3. Add the **site key** to GitHub Actions (or Pages env) as `VITE_TURNSTILE_SITE_KEY` and pass it into `yarn build:pages`.

If `TURNSTILE_SECRET_KEY` is unset, the API accepts signups without Turnstile (fine for local dev).

## Read stats

```bash
npx wrangler kv key get import_success --namespace-id=67b24881a9a746e2bcfe4505b02ba00a --remote
npx wrangler kv key get import_fail --namespace-id=67b24881a9a746e2bcfe4505b02ba00a --remote
npx wrangler d1 execute tfdraw-analytics --remote --command "SELECT COUNT(*) AS n FROM emails"
```

## Deploy

From repo root (after `yarn build:pages`):

```bash
npx wrangler pages deploy --project-name=YOUR_PAGES_PROJECT
```

Use [`wrangler.jsonc`](../wrangler.jsonc) only — do **not** put an `assets` key in that file (Pages rejects it). For Workers static-asset deploy, use [`wrangler.workers.jsonc`](../wrangler.workers.jsonc) instead.

GitHub Actions runs the same Pages command on pushes to `master`. See [`.github/workflows/pages-deploy.yml`](../.github/workflows/pages-deploy.yml).
