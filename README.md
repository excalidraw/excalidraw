# tfdraw.dev

**A browser-only Terraform plan visualizer that turns plan output into an editable Excalidraw architecture canvas.**

Import Terraform/OpenTofu plan JSON and graph DOT files, review the generated infrastructure diagram, then edit, annotate, and export it like any other Excalidraw scene. Optionally add a [`.tfd` declared dataflow file](#declared-dataflow-tfd) to draw explicit app-level arrows on a separate layer. The app does not ask for cloud credentials, upload your files to a backend, or run Terraform for you.

<p align="center">
  <a href="https://github.com/TusharSariya/excalidraw-tf/blob/master/LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
  <a href="https://github.com/TusharSariya/excalidraw-tf/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/TusharSariya/excalidraw-tf/actions/workflows/ci.yml/badge.svg" />
  </a>
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22%2B-339933" />
  <a href="https://tfdraw.dev/demo">
    <img alt="Live demo" src="https://img.shields.io/badge/live-demo-0f766e" />
  </a>
</p>

<p align="center">
  <a href="https://tfdraw.dev/demo">Open live demo</a>
  |
  <a href="https://github.com/TusharSariya/excalidraw-tf">GitHub repository</a>
</p>

![Semantic view: Terraform import with declared dataflow (blue) and IAM dataflow (grey)](docs/terraform-semantic-dataflow.png)

## How it works

1. You run Terraform or OpenTofu locally and export **plan JSON** (`terraform show -json`) and **graph DOT** (`terraform graph -type=plan`) from the same working directory.
2. You open the [hosted demo](https://tfdraw.dev/demo) or a local dev build and choose **Import Terraform** (`Ctrl/Cmd+Shift+K`).
3. The browser parses those files into Excalidraw elements: resource cards, dependency edges, module frames, and cloud hierarchy (account, region, VPC, subnets).
4. Optionally you attach a **`.tfd`** file to add **declared dataflow** arrows (blue) in a fixed order; IAM-inferred **data flow** (grey) still comes from the plan.
5. You edit, save locally, or export the scene like any other Excalidraw drawing.

## Quick start

**Hosted app:** [https://tfdraw.dev/demo](https://tfdraw.dev/demo)

**Local dev** (Node.js 22+, see [`.nvmrc`](./.nvmrc)):

```bash
yarn install
yarn start
```

Open the Vite URL (usually `http://localhost:3000/`), then **Import Terraform** from the menu or `Ctrl/Cmd+Shift+K`.

### Demo deep links (`/demo`)

The full editor at `/demo` can load a hosted import preset automatically via query params (no import dialog):

| Param | Required | Values |
| --- | --- | --- |
| `preset` | yes | Preset id from the catalog, e.g. `staging-multi-state-expanded` |
| `view` | no | `module`, `semantic`, or `pipeline` (overrides the preset default) |
| `pack` | no | `default`, `box`, or `rectpacking` (module view only) |

Examples:

- `/demo?preset=staging-multi-state-expanded` — preset default view (`pipeline`)
- `/demo?preset=staging-multi-state-expanded&view=semantic`
- `/demo?preset=staging-multi-state-expanded&view=module&pack=box`

Preset data is served from D1 on Cloudflare Pages (see [Hosted Pages](#hosted-pages-cloudflare-d1) below). Local dev uses the same API via the Vite preset plugin after `yarn seed:terraform-presets`.

## Import Terraform plans

Generate exports from one Terraform or OpenTofu working directory, then import them together.

### 1. Generate plan JSON

```bash
# Terraform
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# OpenTofu
tofu plan -out=tfplan
tofu show -json tfplan > plan.json
```

### 2. Generate graph DOT

```bash
# Terraform
terraform graph -type=plan > graph.dot

# OpenTofu
tofu graph -type=plan > graph.dot
```

### 3. (Optional) Export raw state

```bash
# Terraform
terraform state pull > state.json

# OpenTofu
tofu state pull > state.json
```

State must be raw JSON with a top-level `resources` array (same shape as `terraform state pull`). Use it with plan+dot to enrich existing resources, or alone for a current-infrastructure snapshot (no plan diffs).

### 4. Import in the app

Open **Import Terraform** and pick a mode:

| Mode | What to upload |
| --- | --- |
| Plan + graph | One or more plan JSON + graph DOT pairs (one pair per stack/root) |
| Plan + graph + state | Plan pairs plus optional state file(s) to enrich nodes |
| Plan + graph + `.tfd` | Plan pairs plus optional [declared dataflow](#declared-dataflow-tfd) file(s) |
| State only | One or more raw state JSON files (semantic topology or module graph) |

| File | Source |
| --- | --- |
| Plan | `terraform show -json <planfile>` or `tofu show -json <planfile>` |
| Graph | `terraform graph -type=plan` or `tofu graph -type=plan` |
| State | `terraform state pull` or a `.tfstate` file |
| Dataflow links | Hand-authored `.tfd` text (optional; multiple files merged in upload order) |

### Multiple stacks

Use **Add plan + graph** in the import dialog for each Terraform or OpenTofu working directory (up to 10 bundles). Optionally add multiple state files and multiple `.tfd` overlays in one import.

If the same resource address appears in more than one file, the **last file wins** and a non-blocking warning is shown after import. Cross-stack diagrams work best when module paths do not collide.

### Sample fixtures

Example import bundles live under [`packages/backend/terraform/staging-multi-state/`](./packages/backend/terraform/staging-multi-state/) (`plan.json` + `graph.dot` per stack, `pipeline.tfd`, etc.). Those files are **gitignored**; hydrate them locally with the dev preset commands below or generate plans from your own Terraform roots.

Unit tests read plan/dot content from the committed preset test database and optional gitignored exports under [`packages/backend/terraform/cloudflare/`](./packages/backend/terraform/cloudflare/) and [`packages/backend/terraform/staging-multi-state/`](./packages/backend/terraform/staging-multi-state/).

### Dev import presets (SQLite)

Local dev (`yarn start`) loads Terraform import **presets** from `terraform-import-presets.db` at the repo root (gitignored). The catalog is [`packages/backend/terraform/import-presets.catalog.json`](./packages/backend/terraform/import-presets.catalog.json) — built-in preset **`staging-multi-state-expanded`** only (25 stacks + `pipeline.tfd`).

After adding or updating plan/dot/state files under `packages/backend/terraform/staging-multi-state/`, re-hydrate:

```bash
yarn hydrate:terraform-preset staging-multi-state-expanded
# or: yarn seed:terraform-presets
```

Copy `terraform-import-presets.db` to share presets with another machine. In the import dialog, use **Use preset manifest** or **Sync from disk** on a single preset; `POST /api/terraform-import-presets/seed-all` re-hydrates every built-in preset without restarting the dev server.

### Hosted Pages (Cloudflare D1)

On **Cloudflare Pages** (not local dev), built-in presets are served read-only from D1 via `GET /api/terraform-import-presets`. Production and branch previews use **separate databases** ([`wrangler.jsonc`](./wrangler.jsonc): top-level bindings = preview, `env.production` = prod when the production branch deploys):

| Binding | Production (`master` / tfdraw.dev) | Preview (other branches / `*.pages.dev`) |
| --- | --- | --- |
| `PRESETS_DB` | `tfdraw-presets` | `tfdraw-presets-preview` |
| `DB` (email signups) | `tfdraw-analytics` | `tfdraw-analytics-preview` |

**What CI does automatically**

| Workflow | Triggers | Effect |
| --- | --- | --- |
| [Deploy to Cloudflare Pages](./.github/workflows/pages-deploy.yml) | Push to `master` or `terraform-feature`, or manual | Builds and deploys the static app + Functions. Picks prod vs preview D1 **bindings** from `wrangler.jsonc`. **Does not** upload preset data. |
| [Push Terraform presets to D1](./.github/workflows/push-presets-d1.yml) | **Manual only** (Actions → Run workflow) | Exports SQL and runs `wrangler d1 execute` to prod and/or preview preset DBs. |

Preset data does **not** update on every deploy (large SQL import). After you change fixtures, `pipeline.tfd`, or the catalog, push data yourself:

```bash
yarn seed:terraform-presets
yarn push:terraform-presets-d1:prod      # production only
yarn push:terraform-presets-d1:preview   # branch previews only
# yarn push:terraform-presets-d1         # both
```

Or in GitHub: **Actions → Push Terraform presets to D1** → choose `prod`, `preview`, or `both`.

Deploy the app when code or Functions change ([`pages-deploy.yml`](./.github/workflows/pages-deploy.yml) or `yarn deploy:pages`). Full setup: [docs/cloudflare-deploy.md](./docs/cloudflare-deploy.md).

**Tests and CI** read plan/dot/tfd content from the committed SQLite file [`packages/excalidraw/test-fixtures/terraform-import-presets.db`](./packages/excalidraw/test-fixtures/terraform-import-presets.db) (not from gitignored paths on disk). After changing catalog fixtures locally, run:

```bash
yarn hydrate:terraform-preset staging-multi-state-expanded
yarn export:terraform-presets-test-db
```

## Declared dataflow (`.tfd`)

A **`.tfd`** file is an optional overlay for **declared dataflow** — blue arrows on the **Declared data flow** layer in the Terraform layers menu. It does not replace plan JSON or graph DOT. Grey **Data flow** edges still come from IAM semantics in the plan.

Use it to document app-level flows in a fixed order (for example writer → S3 → SQS) without listing IAM actions in the file.

### Find addresses in your plan

Every `bind` line must use a **full Terraform resource address** from the plan you import (`resource_changes[].address`):

```bash
jq -r '.resource_changes[] | select(.mode == "managed") | .address' plan.json | sort
```

### Syntax

| Line | Meaning |
| --- | --- |
| `# …` | Comment |
| `bind alias = <full address>` | Short name for an exact plan address |
| `alias -> other` | Directed edge (`other` = alias or full address) |

**Order matters:** edges are drawn in file order.

### Example ([`staging-multi-state/pipeline.tfd`](./packages/backend/terraform/staging-multi-state/pipeline.tfd))

See the committed preset catalog for a full multi-stack pipeline; a minimal pattern is:

```tfd
bind api = module.example.aws_api_gateway_rest_api.this
bind fn  = module.example.aws_lambda_function.this

api -> fn
```

### Import

Upload plan JSON + graph DOT, then attach the `.tfd` under **Dataflow links (.tfd)**. **Declared data flow** is enabled automatically when you provide a links file; toggle layers under **Terraform layers** in the menu.

## What you see on the canvas

- **AWS-style resource cards** for common services (IAM, Lambda, S3, SQS, VPC, CloudWatch, and more).
- **Dependency arrows** from Terraform graph relationships (toggle: **Dependency** layer).
- **Data flow** (grey) from IAM policy semantics in the plan.
- **Declared data flow** (blue) from an optional `.tfd` file.
- **Networking** edges for security-group peers where inferred.
- **Semantic boundaries** for account, region, VPC, and subnets (semantic view), with **provider boxes** (AWS, Cloudflare, GCP, Azure) for multi-cloud imports.
- **Module-aware layout** in module view.
- **Terraform metadata** on elements: diffs, known-after-apply hints, and selected fields.

Everything remains editable Excalidraw content.

## Views

| View | Best for |
| --- | --- |
| **Semantic** | AWS account / region / VPC / subnet topology plus sibling provider boxes for Cloudflare, GCP, and Azure. Plan+dot shows planned changes; state-only shows what is deployed now. |
| **Module** | Terraform module structure and nested resources. |

### Semantic primary satellite layouts (JSON)

In **semantic view**, each primary resource (Lambda, ECS service, S3 bucket, ALB, API Gateway, and others) is drawn as a tier-0 card with **satellites** in fixed slots (CloudWatch above, IAM and companions below-left, security groups below-right).

- [`packages/excalidraw/assets/terraform-topology-satellite-kinds.json`](./packages/excalidraw/assets/terraform-topology-satellite-kinds.json) — global catalog: each satellite **kind** has an attachment rule (`reverseRef`, `companions`, `forwardRef`, or `plugin` for complex discovery).
- [`packages/excalidraw/assets/terraform-topology-primary-layouts/`](./packages/excalidraw/assets/terraform-topology-primary-layouts/) — per primary type: `attachments` (which kinds run) and `slots` (where they are drawn). Example: [`aws_lambda_function.json`](./packages/excalidraw/assets/terraform-topology-primary-layouts/aws_lambda_function.json). Unknown primary types use [`default.json`](./packages/excalidraw/assets/terraform-topology-primary-layouts/default.json).

Every kind listed in `slots[].kinds` must also appear in `attachments`. Runtime code in `terraformTopologySatelliteEngine.ts` and `terraformTopologySatelliteRegistry.ts` resolves attachments from the Terraform plan; add a declarative rule when the pattern is simple (reverse reference or companion link field), or a registered **plugin** when discovery needs custom logic (IAM chains, security groups, API Gateway stages, and similar).

Production builds use a Terraform Canvas landing page with an embedded editor; dev mode opens the editor directly.

## Safety

- No AWS, Terraform Cloud, or other cloud credentials in the app.
- No `terraform` / `tofu` execution in the browser.
- Plan JSON and DOT are parsed locally; **Terraform files are not uploaded** for import.
- Optional email signup and **anonymous import success/fail counters** on the hosted app only (see [docs/privacy.md](./docs/privacy.md)).

Treat plan JSON as sensitive (names, ARNs, tags, sometimes secrets). Review before sharing diagrams or scenes.

## Limitations

- Plan-based import requires **plan JSON and graph DOT together**.
- `.tfd` is optional; it does not replace plan+dot.
- State-only semantic view has no create/update/delete diffs from a plan.
- Semantic view places AWS resources in account topology and other cloud providers in labeled provider boxes (Cloudflare groups by account, zone, Pages, and Workers).
- Strongest AWS semantic detail today; GCP/Azure use account/project grids until richer topology is added.
- Public mode hides collaboration, share links, Firebase share load, and some export/promo controls.

## FAQ

### Does tfdraw.dev need my AWS account?

No. Generate Terraform/OpenTofu outputs locally and import the files.

### Does the app apply changes?

No. It only visualizes files you provide.

### Can I edit the diagram after import?

Yes. Resources, labels, arrows, and containers are normal Excalidraw elements.

### Can I use OpenTofu?

Yes, with compatible `tofu show -json` and `tofu graph` output.

### Where does parsing run?

In the browser ([`terraformPlanParsing.tsx`](./packages/excalidraw/components/terraformPlanParsing.tsx)). [`packages/backend/`](./packages/backend/) holds sample Terraform and fixture tooling, not a required upload API.

## Development

```bash
yarn install
yarn start          # local app
yarn test           # Vitest (watch)
yarn test --watch=false
yarn test:typecheck
yarn test:code      # ESLint
yarn test:other     # Prettier
yarn test:prepush   # mirrors CI before push
yarn build:packages
yarn build:app
```

Parser tests: [`terraformPlanParsing.test.ts`](./packages/excalidraw/components/terraformPlanParsing.test.ts) using the committed preset test DB plus [`packages/backend/terraform/cloudflare/`](./packages/backend/terraform/cloudflare/) and [`packages/backend/terraform/staging-multi-state/`](./packages/backend/terraform/staging-multi-state/) exports.

### Hosted telemetry (maintainers)

Pages Functions under [`functions/`](./functions/) provide `/api/subscribe` and `/api/event`. Setup: [docs/telemetry-setup.md](./docs/telemetry-setup.md).

## Deployment

Build the static public app:

```bash
yarn build:pages
```

Output: `excalidraw-app/build`. Optional tarball: `yarn bundle:whiteboard` → `releases/tfdraw-whiteboard-<version>-<sha>.tar.gz`.

### Cloudflare Pages

[`pages-deploy.yml`](./.github/workflows/pages-deploy.yml) runs on push to `master` or `terraform-feature` (and on manual dispatch). It builds with `yarn build:pages` and runs `wrangler pages deploy`. That deploys the app and Pages Functions only; it does **not** push Terraform preset rows into D1 (see [Hosted Pages (Cloudflare D1)](#hosted-pages-cloudflare-d1) above).

| Kind     | Name                                                      |
| -------- | --------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`                                    |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`                                   |
| Variable | `CF_PAGES_PROJECT_NAME` (optional; skips deploy if unset) |

Manual deploy after a local build (from repo root):

```bash
yarn deploy:pages -- --project-name=YOUR_PAGES_PROJECT_NAME
# or:
npx wrangler@4 pages deploy ./excalidraw-app/build --project-name=YOUR_PAGES_PROJECT_NAME
```

Use **`wrangler pages deploy`**, not `wrangler deploy`. [`wrangler.jsonc`](./wrangler.jsonc) is **Pages-only** (no `assets` key).

Hosted deploys use **Cloudflare Pages** (GitHub Actions). The old **Workers Builds** Worker (`ainur`) was removed — it could not serve Pages Functions (`/api/*`).

Setup: [docs/cloudflare-deploy.md](./docs/cloudflare-deploy.md).

## Upstream Excalidraw

Built on [Excalidraw](https://github.com/excalidraw/excalidraw). This fork adds Terraform import and graph-to-canvas layout on top of the standard editor, tools, and export behavior.

- [Excalidraw](https://excalidraw.com) · [Docs](https://docs.excalidraw.com) · [MIT license](https://github.com/excalidraw/excalidraw/blob/master/LICENSE)

## License

MIT. See [`LICENSE`](./LICENSE).
