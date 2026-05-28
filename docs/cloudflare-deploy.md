# Cloudflare deploy — fix your setup

This repo uses **two** deploy paths. Mixing them is why PR checks can look “half green” and email signup fails.

## What you want (site + email API)

| Piece          | Requirement                                                 |
| -------------- | ----------------------------------------------------------- |
| Deploy command | `wrangler pages deploy` (GitHub Actions or manual)          |
| Config file    | [`wrangler.jsonc`](../wrangler.jsonc) — **no `assets` key** |
| Host           | `*.pages.dev` or custom domain on **Pages**                 |
| API            | `/functions` → `/api/subscribe`, `/api/event`               |

## What you have if only Workers Builds is green

| Piece          | What happens                                             |
| -------------- | -------------------------------------------------------- |
| Deploy command | `wrangler deploy` (Cloudflare Workers Builds)            |
| URL            | `https://<branch>-ainur.<account>.workers.dev`           |
| Email signup   | **Broken** — no Pages Functions on Workers static deploy |

Example preview: `terraform-feature-ainur.tushar-sariya77.workers.dev` — fine for UI, **not** for email.

---

## Step 1 — Config (done in repo)

- [`wrangler.jsonc`](../wrangler.jsonc) — Pages only (`pages_build_output_dir`, KV, D1). **No `assets`.**
- [`wrangler.workers.jsonc`](../wrangler.workers.jsonc) — optional Workers static preview (`assets` only).

Merge/push this branch so GitHub Actions stops failing with:

`Configuration file for Pages projects does not support "assets"`

---

## Step 2 — GitHub Actions (production + branch previews)

Repo → **Settings → Secrets and variables → Actions**

| Type | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages Edit** (+ Account read) |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Your account ID |
| Variable | `CF_PAGES_PROJECT_NAME` | Pages project name, e.g. `ainur` |
| Variable (optional) | `VITE_TURNSTILE_SITE_KEY` | Turnstile site key for the build |

Workflow: [`.github/workflows/pages-deploy.yml`](../.github/workflows/pages-deploy.yml)

- Push to **`master`** → production Pages deploy
- Push to **`terraform-feature`** → preview deploy (`--branch=terraform-feature`)

After a green run, open the URL Wrangler prints (or Cloudflare **Pages → ainur → Deployments**). It will be **`*.pages.dev`**, not `workers.dev`.

---

## Step 3 — Cloudflare dashboard (stop fighting GitHub)

You likely have **Workers Builds** on script **ainur** connected to GitHub. That bypasses Pages Functions.

**Recommended:** use **one** deploy path.

### Option A — GitHub Actions only (recommended)

1. **Workers & Pages** → your **Worker** `ainur` (if it’s only Workers) — either delete/disable **Workers Builds** Git integration, **or** leave it for static-only previews knowing email won’t work there.
2. Create or use a **Pages** project named `ainur` (same name is OK; different product).
3. On the **Pages** project: **Builds** → disable automatic Git builds (Actions deploys for you).

### Option B — Keep Workers Builds for static previews

1. In Workers build settings, point Wrangler config to **`wrangler.workers.jsonc`** if the UI allows a config path.
2. Do **not** use `wrangler.jsonc` for `wrangler deploy` (no `assets` in that file anymore).
3. Still run GitHub Actions for **Pages** when you need email/API.

---

## Step 4 — D1 + secrets (first time)

[`wrangler.jsonc`](../wrangler.jsonc) uses **separate D1 databases** for production vs preview:

| Binding      | Production (`master`) | Preview (branch deploys)   |
| ------------ | --------------------- | -------------------------- |
| `DB`         | `tfdraw-analytics`    | `tfdraw-analytics-preview` |
| `PRESETS_DB` | `tfdraw-presets`      | `tfdraw-presets-preview`   |

Top-level bindings in `wrangler.jsonc` = preview. `env.production` overrides to prod DBs when Pages deploys the **production branch** (set in dashboard, usually `master`).

**One-time prod schemas:**

```bash
npx wrangler d1 execute tfdraw-analytics --remote --file=./functions/schema.sql
npx wrangler d1 execute tfdraw-presets --remote --file=./functions/presets-schema.sql
```

**One-time preview schemas** (after `wrangler d1 create …-preview`):

```bash
npx wrangler d1 execute tfdraw-analytics-preview --remote --file=./functions/schema.sql
npx wrangler d1 execute tfdraw-presets-preview --remote --file=./functions/presets-schema.sql
```

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=ainur
```

See [telemetry-setup.md](./telemetry-setup.md) for Turnstile and stats. Preview analytics starts empty (test signups do not hit prod emails).

### Terraform import presets (read-only, D1)

The Pages app calls `GET /api/terraform-import-presets` and `GET /api/terraform-import-presets/:id/sources`. Which database is used depends on the deployment environment (prod vs preview).

**Push local SQLite** (after `yarn seed:terraform-presets`):

```bash
yarn push:terraform-presets-d1:prod      # production only (tfdraw.dev)
yarn push:terraform-presets-d1:preview   # branch previews only
yarn push:terraform-presets-d1           # both
```

Or use GitHub Actions → **Push Terraform presets to D1** (`workflow_dispatch`, target `prod` / `preview` / `both`).

Large plan/dot payloads are gzip-compressed and split into `terraform_import_preset_blob_chunks` so each SQL statement stays under D1 limits.

**Verify presets API** (use the host that matches the environment):

```bash
# Production
curl -sS "https://tfdraw.dev/api/terraform-import-presets" | head -c 200

# Preview (example)
curl -sS "https://terraform-feature.YOUR.pages.dev/api/terraform-import-presets" | head -c 200
```

In the app: **Import Terraform** → preset dropdown → **Load & import**.

**Dashboard:** Pages → Settings → ensure **Production branch** = `master` (or your prod branch).

---

## Step 5 — Verify

1. **Actions** → “Deploy to Cloudflare Pages” → green on your branch (required after `wrangler.jsonc` env changes so prod/preview bindings apply).
2. Open the **Pages** deployment URL (not `workers.dev`).
3. DevTools → Network → submit email → `POST /api/subscribe` should be **200** JSON `{ "ok": true }` (preview signups go to `tfdraw-analytics-preview`, prod to `tfdraw-analytics`).
4. DevTools → `GET /api/terraform-import-presets` → **200** with a `presets` array (after D1 data import to the matching environment).

---

## Quick reference

| Command | Config | Email API |
| --- | --- | --- |
| `wrangler pages deploy ./excalidraw-app/build` | `wrangler.jsonc` | Yes |
| `wrangler deploy -c wrangler.workers.jsonc` | `wrangler.workers.jsonc` | No |
| `wrangler deploy` (default config) | Fails or wrong | No |
