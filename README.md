# Excalidraw Terraform

A **Terraform architecture visualizer** built on [Excalidraw](https://excalidraw.com). You upload **plan JSON** (from `terraform show -json`) and **graph DOT** (from `terraform graph`); the **browser** parses them, lays out resources, and replaces the canvas with an editable diagram—no separate import API or collaboration backend.

Production/static builds open on a **Terraform Canvas** landing page with an embedded canvas: draw, load/save local scenes, export images, and run **Import Terraform** the same way as in development—all without a collaboration server, Firebase share links, or Excalidraw+ cloud actions.

![Sample import: plan JSON and graph DOT rendered as an editable AWS-style diagram](docs/terraform-import-sample.png)

<p align="center">
  <a href="https://github.com/excalidraw/excalidraw/blob/master/LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
</p>

---

## What this fork adds

- **Frontend-only public landing page** — production/static `/` renders a Terraform Canvas landing page and an embedded Excalidraw canvas in the same page. Public mode intentionally hides collaboration, share-link, Firebase-backed export, and Excalidraw+ cloud surfaces.
- **Client-side Terraform plan + graph import** — Plan JSON (`terraform show -json`) and DOT (`terraform graph`) are read in the browser; [`terraformPlanParsing`](./packages/excalidraw/components/terraformPlanParsing.tsx) builds nodes, edges, and an Excalidraw scene (no Node upload service). [`packages/backend/`](./packages/backend/) holds **fixtures** and legacy reference scripts used for parity with the client pipeline.
- **Semantic and module views** — Choose **Semantic view** (account, region, VPC, subnet topology) or **Module view** (module-framed graph) in the import dialog.
- **AWS architecture icons** — Resource cards use the bundled AWS architecture icon library (IAM, Lambda, S3, SQS, RDS, VPC, CloudWatch, and many others).
- **Module-aware layout** — Modules are layout units so sibling modules have space and internals stay readable.
- **Nested infrastructure boundaries** — Account, region, VPC, subnet, and module containers use staggered padding so hierarchy is visible.
- **Lambda module preset** — Common Lambda module internals (function, role, inline policies, log group, package) get stable relative placement.
- **Relationship rendering** — Planned dependencies (and state-backed edges when state is supplied) render as arrows behind resource cards.
- **Terraform details on elements** — Resource diffs, known-after-apply values, and selected fields are stored on Excalidraw elements for inspection.

The rest is standard Excalidraw: hand-drawn style, zoom/pan, export to PNG/SVG, and the usual editor tools.

---

## Quick start

Use **Node.js 22 or newer** (dependency `chevrotain@12` requires it). If you use nvm: `nvm install` / `nvm use` from the repo root reads [`.nvmrc`](.nvmrc).

**Run the Excalidraw developer app:**

```bash
yarn install
yarn start
```

Open the Vite URL printed by the command, usually `http://localhost:3000/`. In development, `/` opens directly into the normal Excalidraw editor for faster local work.

**Build or preview the public landing page:**

```bash
yarn build:app
yarn build:preview
```

The static app is emitted to `excalidraw-app/build`. Hosted static builds and `yarn build:preview` render the Terraform Canvas landing page at `/` with the embedded frontend-only demo below it.

**Lean static build for hosting (smaller output, less Vite memory):**

```bash
yarn build:pages
```

This disables Sentry and product analytics for the bundle, omits production source maps by default (set `VITE_PROD_SOURCEMAP=true` in env to opt back in), and skips `vite-plugin-checker` during `vite build` (typecheck and lint remain available via `yarn test:typecheck` and `yarn test:code`).

**Cloudflare Pages via GitHub Actions (direct upload):**

The workflow [.github/workflows/pages-deploy.yml](.github/workflows/pages-deploy.yml) deploys when a **push** lands on **`main` or `master`**, and on **workflow_dispatch** (manual run in the Actions tab). That **includes merging a pull request** into `main` or `master`, because GitHub adds the merge commit as a push to the base branch. Direct pushes to those branches also run the workflow. Steps: `yarn install --frozen-lockfile`, `yarn build:pages`, then `wrangler pages deploy excalidraw-app/build`. Configure the repository under **Settings → Secrets and variables → Actions**:

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | API token with **Account → Cloudflare Pages → Edit** (and read as needed). |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Account ID from the Cloudflare dashboard sidebar. |
| Variable | `CF_PAGES_PROJECT_NAME` | Exact **Pages project name** (creates production deploy when set). If unset, the workflow still **builds** but **skips deploy** so forks stay green. |

**Use the branch this workflow listens to.** Production deploys from Actions when code is **merged or pushed** into **`main` or `master`**—whichever your team uses. If your default branch is something else (for example only `develop`), either merge release commits into `master`/`main`, or edit `pages-deploy.yml` `on.push.branches` to match. If the Pages project is still **Git-connected**, set the Cloudflare **production branch** ( **Settings → Builds & deployments → Production** ) to that same primary branch so you are not expecting deploys from a branch that never triggers the workflow.

After this is wired, **turn off Cloudflare’s Git-triggered builds** for this project. Otherwise every push still starts a **Pages build on Cloudflare** (the one that OOMs), even when GitHub Actions deploys successfully.

In the dashboard: **Workers & Pages** → your Pages project → **Settings** → **Builds & deployments**:

1. Under **Production**, open **Configure Production deployments** and **disable** “Enable automatic production branch deployments” (see [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/) and [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/#disable-automatic-deployments)).
2. Under **Preview**, set automatic preview deployments to **None** (or restrict branches) so pushes do not spawn preview builds on Cloudflare either.

Then only **`wrangler pages deploy`** from GitHub Actions updates the site. Production updates after a **merge into** or **push to** **`main` or `master`**, or when you use **Run workflow** in the Actions tab.

**Manual upload (same as CI):** after `yarn build:pages`, from the repo root:

```bash
npx wrangler@4 pages deploy excalidraw-app/build --project-name=YOUR_PAGES_PROJECT_NAME
```

Use the **`pages`** subcommand for Cloudflare **Pages** (`wrangler pages deploy …`). **`wrangler deploy`** targets **Workers** with static assets and uses the `assets` block instead of (or in addition to) Pages upload semantics.

**`wrangler.jsonc`:** [wrangler.jsonc](wrangler.jsonc) sets **`pages_build_output_dir`** to `./excalidraw-app/build` for **`wrangler pages deploy`**, and an **`assets`** block with the same directory plus **`not_found_handling`: `single-page-application`** for **Workers + static assets** / SPA routing. Replace **`name`** with your real **Pages** or **Worker** name as appropriate. This file does **not** run the Vite build on Cloudflare by itself; CI and local builds write `excalidraw-app/build` first. You can run `npx wrangler pages download config <PROJECT_NAME>` to align with an existing Pages project ([docs](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)).

**Import Terraform in the app**

```bash
yarn install
yarn start
```

Open the Vite URL (usually `http://localhost:3000/`). In development, `/` opens the Excalidraw editor directly. Use the **Import Terraform** action in the menu or **Ctrl/Cmd+Shift+K**.

1. **Plan file** — JSON from `terraform show -json <planfile>` (or equivalent OpenTofu).
2. **Graph file** — DOT from `terraform graph` (e.g. `terraform graph -type=plan > graph.dot`).

Plan and DOT must be selected **together**. The client runs [`terraformPlanParsing`](./packages/excalidraw/components/terraformPlanParsing.tsx) and replaces the canvas with the returned scene.

**Try the fixtures:** [`packages/backend/terraform/allplanmodules.json`](./packages/backend/terraform/allplanmodules.json) and [`allplanmodules.dot`](./packages/backend/terraform/allplanmodules.dot) (same pair used by [`terraformPlanParsing.test.ts`](./packages/excalidraw/components/terraformPlanParsing.test.ts)).

**State files:** The parsing pipeline can merge optional raw `terraform.tfstate`, but the **state file control is currently disabled** in the import dialog (`TERRAFORM_STATE_UPLOAD_ENABLED` in [`TerraformImportDialog.tsx`](./packages/excalidraw/components/TerraformImportDialog.tsx)).

---

## Frontend-only public mode

The production root Excalidraw app (`/`) is intended to be deployable as a static frontend from `excalidraw-app/build`. Development mode (`yarn start`) intentionally opens the raw editor instead.

Available in public mode:

- Draw and edit on the embedded canvas.
- Local browser persistence.
- Load/save Excalidraw scenes from disk.
- Export images.
- **Import Terraform** — plan JSON + graph DOT in the browser (same as full editor mode).

Hidden in public mode:

- Collaboration and live-share controls.
- Share-link dialogs and backend share-link creation.
- Firebase-backed scene/file loading from share URLs.
- Excalidraw+ sign-up, promo, and cloud export controls.
- Backend export actions in the export dialog.

The special `/excalidraw-plus-export` route is still preserved for the existing Excalidraw+ iframe export behavior.

---

## Generating Terraform Inputs

To import your infrastructure, you need to generate a plan JSON and a graph DOT file from your Terraform or OpenTofu project.

### 1. Generate Plan JSON

This provides the resource details, diffs, and attributes.

```bash
# Terraform
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# OpenTofu
tofu plan -out=tfplan
tofu show -json tfplan > plan.json
```

### 2. Generate Graph DOT

This provides the dependency relationship data.

```bash
# Terraform
terraform graph -type=plan > graph.dot

# OpenTofu
tofu graph -type=plan > graph.dot
```

### 3. State file (optional; UI currently off)

The importer’s parsing layer can merge raw `terraform.tfstate` when provided, but **uploading state is not enabled** in the dialog yet. Skip this until the UI flag is turned on in [`TerraformImportDialog.tsx`](./packages/excalidraw/components/TerraformImportDialog.tsx).

---

## Development

### Tests

Vitest runs from the **repository root** (`vitest.config.mts`, `jsdom`).

```bash
yarn test                         # watch mode (default)
yarn test --watch=false           # single run (CI-style)
yarn test:update                  # all Vitest tests + snapshot updates, no watch
```

Run a **subset** of tests by passing a filename fragment Vitest treats as a filter:

```bash
yarn test terraformPlanParsing.test --watch=false
```

That executes the **local Terraform plan parser** pipeline test ([`packages/excalidraw/components/terraformPlanParsing.test.ts`](./packages/excalidraw/components/terraformPlanParsing.test.ts)): it loads [`packages/backend/terraform/allplanmodules.json`](./packages/backend/terraform/allplanmodules.json) and [`packages/backend/terraform/allplanmodules.dot`](./packages/backend/terraform/allplanmodules.dot), runs `terraformPlanParsing`, and asserts the HTTP-style response and empty Excalidraw scene shape.

Other packages may define their own `yarn test` scripts under `packages/*`; run them with `yarn --cwd <path> test` when needed.

### Other commands

- **Type checking:** `yarn test:typecheck`
- **Lint / format:** `yarn fix`
- **Build packages:** `yarn build:packages`
- **Build app:** `yarn build:app`

See the main [Excalidraw documentation](https://docs.excalidraw.com) and [development guide](https://docs.excalidraw.com/docs/introduction/development) for the core editor.

---

## Upstream Excalidraw

This repo is built on [Excalidraw](https://github.com/excalidraw/excalidraw): an open-source, collaborative whiteboard with a hand-drawn look. We keep the existing Excalidraw features (canvas, tools, export, etc.) and add the Terraform import pipeline and graph-to-canvas flow on top.

- [Excalidraw](https://excalidraw.com) · [Docs](https://docs.excalidraw.com) · [License (MIT)](https://github.com/excalidraw/excalidraw/blob/master/LICENSE)
