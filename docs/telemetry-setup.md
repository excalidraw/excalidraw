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

From repo root:

```bash
yarn deploy:pages -- --project-name=YOUR_PAGES_PROJECT
```

Equivalent:

```bash
yarn build:pages
npx wrangler pages deploy ./excalidraw-app/build --project-name=YOUR_PAGES_PROJECT
```

### Do not use `wrangler deploy` for this project

If you see:

```text
Missing entry-point to Worker script or to assets directory
```

you ran **`npx wrangler deploy`** (Workers) instead of **`npx wrangler pages deploy`** (Pages). Fix the command in the Cloudflare dashboard or your shell.

| Command | Use for tfdraw? |
| --- | --- |
| `wrangler pages deploy ./excalidraw-app/build` | Yes — static app + `/functions` API |
| `wrangler deploy` | No — needs `main` or `assets` in config |
| `wrangler deploy -c wrangler.workers.jsonc` | Optional — static only, **no** Pages Functions |

[`wrangler.jsonc`](../wrangler.jsonc) includes both `pages_build_output_dir` (Pages) and `assets` (so dashboard/`wrangler deploy` pipelines do not fail with “Missing entry-point”).

### Cloudflare dashboard (Git-connected Pages)

Under **Build** / **Deploy**:

- **Build command:** `yarn install --frozen-lockfile && yarn build:pages`
- **Deploy / non-Pages builders:** if Wrangler is invoked, it must be `npx wrangler pages deploy ./excalidraw-app/build`, not `npx wrangler deploy`.

Or turn off Cloudflare’s Git build and deploy only via GitHub Actions ([`pages-deploy.yml`](../.github/workflows/pages-deploy.yml) on `master`).

GitHub Actions runs `wrangler pages deploy ./excalidraw-app/build` on pushes to `master`.
