# Cloudflare deploy — Pages only

This repo deploys with **GitHub Actions + `wrangler pages deploy`**. Do not use **`wrangler deploy`** (Workers) — Pages Functions (`/api/*`) only run on Pages.

## What you want (site + email API)

| Piece          | Requirement                                                 |
| -------------- | ----------------------------------------------------------- |
| Deploy command | `wrangler pages deploy` (GitHub Actions or manual)          |
| Config file    | [`wrangler.jsonc`](../wrangler.jsonc) — **no `assets` key** |
| Host           | `*.pages.dev` or custom domain (`tfdraw.dev`) on **Pages**  |
| API            | `/functions` → `/api/subscribe`, `/api/event`, presets API  |

## Workers Builds removed

The **Worker script `ainur`** (Workers Builds / `*.workers.dev`) was deleted. It could only serve static assets — **no Pages Functions** — so email signup and `/api/terraform-import-presets` never worked there.

If GitHub still shows a **Cloudflare Workers** check on pull requests:

1. [Cloudflare dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. If a Worker named `ainur` reappears, open it → **Settings → Builds → Disconnect**
3. Or remove the stale check under GitHub **Settings → Branches → required status checks**

The **Pages** project `ainur` (`tfdraw.dev`, `ainur-chb.pages.dev`) is separate and is deployed by [`.github/workflows/pages-deploy.yml`](../.github/workflows/pages-deploy.yml).

---

## Step 1 — Config (repo)

- [`wrangler.jsonc`](../wrangler.jsonc) — Pages only (`pages_build_output_dir`, KV, D1). **No `assets`.**

Do **not** add `assets` to `wrangler.jsonc` — Pages validation rejects it.

---

## Step 2 — GitHub Actions (production + PR previews)

Repo → **Settings → Secrets and variables → Actions**

| Type | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages Edit** (+ Account read) |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Your account ID |
| Variable | `CF_PAGES_PROJECT_NAME` | Pages project name, e.g. `ainur` |
| Variable (optional) | `VITE_TURNSTILE_SITE_KEY` | Turnstile site key for the build |

Workflow: [`.github/workflows/pages-deploy.yml`](../.github/workflows/pages-deploy.yml)

- **Pull request** (same-repo only) → preview deploy (`--branch=<head>`), sticky PR comment with live URLs, smoke tests
- Push to **`master`** → production Pages deploy
- Push to **`terraform-feature`** → preview deploy (`--branch=terraform-feature`)

After a green run, open the branch alias URL from the Actions job summary or the sticky PR comment (`*.pages.dev` or `tfdraw.dev`).

---

## PR preview workflow

Every **same-repo** pull request triggers [`.github/workflows/pages-deploy.yml`](../.github/workflows/pages-deploy.yml):

1. **Build** — `yarn build:pages` on the GitHub runner (not on Cloudflare)
2. **Upload** — `wrangler pages deploy ./excalidraw-app/build` (direct upload of static files)
3. **Smoke tests** — `GET /`, `GET /api/terraform-import-presets`, `GET /demo?preset=staging-multi-state-expanded`
4. **Sticky PR comment** — one updating comment with preview URL, demo deep links, and smoke status

### Preview URL pattern

Branch aliases follow Cloudflare’s rules (lowercase, non-alphanumeric → hyphen):

```text
<branch>.<CF_PAGES_PROJECT_NAME>.pages.dev
```

Example: PR from branch `fix/api` → `fix-api.ainur.pages.dev` (subdomain may include a suffix, e.g. `ainur-chb.pages.dev`).

Production custom domain: **https://tfdraw.dev**

### Fork pull requests

Preview deploy is **skipped** for fork PRs (Cloudflare secrets are not available). The workflow posts a notice comment. CI (`ci.yml`) still runs.

### Smoke test expectations

| Check | Pass criteria |
| --- | --- |
| Index | `GET /` returns HTML |
| Presets API | `GET /api/terraform-import-presets` returns JSON with `presets.length > 0` |
| Demo route | `GET /demo?preset=staging-multi-state-expanded` returns HTTP 200 |

If the presets API smoke test fails on preview, push preset data to **preview D1** (see below).

---

## Step 3 — Cloudflare dashboard

Use **one** deploy path: **GitHub Actions → Pages**.

On the **Pages** project `ainur`:

- **Builds** → disable automatic Git builds (Actions deploys for you)
- **Settings → Production branch** → should match your prod branch (`master` in this repo; dashboard may show `main` — align them)

Do **not** reconnect **Workers Builds** to this repository.

---

## Step 4 — D1 + secrets (first time)

[`wrangler.jsonc`](../wrangler.jsonc) uses **separate D1 databases** for production vs preview:

| Binding             | Production (`master`) | Preview (branch deploys)      |
| ------------------- | --------------------- | ----------------------------- |
| `DB`                | `tfdraw-analytics`    | `tfdraw-analytics-preview`    |
| `PRESETS_DB`        | `tfdraw-presets`      | `tfdraw-presets-preview`      |
| `LAYOUT_CACHE` (KV) | `tfdraw-layout-cache` | `tfdraw-layout-cache-preview` |

Top-level bindings in `wrangler.jsonc` = preview. `env.production` overrides to prod DBs and production layout KV when Pages deploys the **production branch**.

**Layout cache KV** (precomputed Terraform scenes for builtin presets):

- Namespaces were created with `wrangler kv namespace create` (ids in [`wrangler.jsonc`](../wrangler.jsonc)).
- On every **push to `master`**, [pages-deploy.yml](../.github/workflows/pages-deploy.yml) purges production KV, runs `yarn precompute:terraform-layout-cache`, and `wrangler kv bulk put`.
- Manual: `yarn purge:terraform-layout-cache` then `LAYOUT_CACHE_VERSION=$(git rev-parse --short HEAD) yarn precompute:terraform-layout-cache` then bulk put (see workflow for namespace id).
- Preview branch deploys: cache miss → client layout fallback (no precompute on PRs).

**One-time prod schemas:**

```bash
npx wrangler d1 execute tfdraw-analytics --remote --file=./functions/schema.sql
npx wrangler d1 execute tfdraw-presets --remote --file=./functions/presets-schema.sql
```

**One-time preview schemas:**

```bash
npx wrangler d1 execute tfdraw-analytics-preview --remote --file=./functions/schema.sql
npx wrangler d1 execute tfdraw-presets-preview --remote --file=./functions/presets-schema.sql
```

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=ainur
```

See [telemetry-setup.md](./telemetry-setup.md) for Turnstile and stats.

### Terraform import presets (read-only, D1)

**Push local SQLite** (after `yarn seed:terraform-presets`):

```bash
yarn push:terraform-presets-d1:prod      # production (tfdraw.dev)
yarn push:terraform-presets-d1:preview   # branch previews
yarn push:terraform-presets-d1           # both
```

Or GitHub Actions → **Push Terraform presets to D1** (`workflow_dispatch`).

**Verify presets API:**

```bash
curl -sS "https://tfdraw.dev/api/terraform-import-presets" | head -c 200
curl -sS "https://<branch>.ainur-chb.pages.dev/api/terraform-import-presets" | head -c 200
```

---

## Step 5 — Verify

1. **Actions** → “Deploy to Cloudflare Pages” → green on your branch
2. Open the **Pages** URL from the PR comment or job summary
3. `POST /api/subscribe` → **200** JSON `{ "ok": true }`
4. `GET /api/terraform-import-presets` → **200** with a `presets` array
5. `GET /api/terraform-import-layout-cache?v=<deploy-sha-prefix>&preset=staging-multi-state-expanded&view=pipeline` → **200** with `{ scene }` (production, after master cache seed)

---

## Quick reference

| Command | Use for tfdraw? |
| --- | --- |
| `wrangler pages deploy ./excalidraw-app/build` | **Yes** — static app + Pages Functions |
| `wrangler deploy` | **No** — Workers mode; no Pages Functions |
