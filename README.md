# tfdraw.dev

**A browser-only Terraform plan visualizer that turns plan output into an editable Excalidraw architecture canvas.**

Import Terraform/OpenTofu plan JSON and graph DOT files, review the generated infrastructure diagram, then edit, annotate, and export it like any other Excalidraw scene. The app does not ask for cloud credentials, upload your files to a backend, or run Terraform for you.

<p align="center">
  <a href="https://github.com/TusharSariya/excalidraw-tf/blob/master/LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
  <a href="https://github.com/TusharSariya/excalidraw-tf/actions/workflows/lint.yml">
    <img alt="Lint workflow" src="https://github.com/TusharSariya/excalidraw-tf/actions/workflows/lint.yml/badge.svg" />
  </a>
  <a href="https://github.com/TusharSariya/excalidraw-tf/actions/workflows/test.yml">
    <img alt="Tests workflow" src="https://github.com/TusharSariya/excalidraw-tf/actions/workflows/test.yml/badge.svg" />
  </a>
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22%2B-339933" />
  <a href="https://master-ainur.tushar-sariya77.workers.dev/demo">
    <img alt="Live demo" src="https://img.shields.io/badge/live-demo-0f766e" />
  </a>
</p>

<p align="center">
  <a href="https://master-ainur.tushar-sariya77.workers.dev/demo">Open live demo</a>
  |
  <a href="https://github.com/TusharSariya/excalidraw-tf">GitHub repository</a>
</p>

![Sample import: plan JSON and graph DOT rendered as an editable AWS-style diagram](docs/terraform-import-sample.png)

## What is tfdraw.dev?

tfdraw.dev is a Terraform architecture canvas built on [Excalidraw](https://excalidraw.com). It reads the files you already generate during a Terraform review:

- plan JSON from `terraform show -json`
- dependency graph DOT from `terraform graph`

Those files are parsed in the browser and converted into Excalidraw elements: resource cards, dependency arrows, module boundaries, cloud hierarchy containers, and Terraform metadata attached to elements for inspection.

The result is not a static screenshot. It is a normal Excalidraw scene you can rearrange, annotate, save locally, and export.

## Why use it?

- **Review planned changes visually.** Turn plan output into a diagram before applying infrastructure changes.
- **Keep the workflow local.** Import files directly in the browser; no app-side Terraform execution, cloud credentials, or backend upload service.
- **Edit the diagram after import.** Move resources, add notes, group systems, and export PNG/SVG using the familiar Excalidraw editor.
- **Understand relationships faster.** Dependency edges, module containers, account/region/VPC/subnet boundaries, and AWS-style cards make large plans easier to scan.
- **Use it with Terraform or OpenTofu.** The importer consumes standard JSON and DOT outputs rather than provider credentials.

## How it works

1. You run Terraform or OpenTofu locally to create a plan and graph.
2. You open the [hosted demo](https://master-ainur.tushar-sariya77.workers.dev/demo) or the local development app.
3. You select the plan JSON and graph DOT together in the **Import Terraform** dialog.
4. The browser parser builds an Excalidraw scene and replaces the current canvas.
5. You inspect, edit, save, or export the diagram locally.

The client-side import pipeline lives in [`packages/excalidraw/components/terraformPlanParsing.tsx`](./packages/excalidraw/components/terraformPlanParsing.tsx). [`packages/backend/`](./packages/backend/) currently holds fixtures and legacy reference scripts used for parity with the client pipeline; it is not required as an upload service for normal browser import.

## Quick start

Use the hosted app:

```text
https://master-ainur.tushar-sariya77.workers.dev/demo
```

Or run the project locally with **Node.js 22 or newer**. If you use `nvm`, the repo includes [`.nvmrc`](./.nvmrc).

```bash
yarn install
yarn start
```

Open the Vite URL printed by the command, usually `http://localhost:3000/`. In development, `/` opens directly into the Excalidraw editor for faster local work. Use **Import Terraform** from the menu or press **Ctrl/Cmd+Shift+K**.

## Import Terraform plan output

Generate both files from the same Terraform or OpenTofu working directory and select them together in the import dialog.

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

You can also use a local `.tfstate` file. The importer expects raw state JSON with a top-level `resources` array (same shape as `terraform state pull`).

### 4. Import files

In the hosted app, open **Import Terraform** and choose one of:

| Mode | Files |
| --- | --- |
| Plan + graph (semantic or module view) | Plan JSON + graph DOT together |
| Plan + graph + dataflow links | Plan JSON + graph DOT + optional `.tfd` (declared dataflow overlay) |
| Plan + graph + state | Plan JSON + graph DOT + optional state (enriches existing resources) |
| State only | Raw state JSON alone (semantic topology or module / ELK graph) |

| File | Expected input |
| --- | --- |
| Plan file | JSON from `terraform show -json <planfile>` or `tofu show -json <planfile>` |
| Graph file | DOT from `terraform graph -type=plan` or `tofu graph -type=plan` |
| State file | Raw state from `terraform state pull` or a `.tfstate` file |
| Dataflow links (optional) | `.tfd` text file — see [Creating `.tfd` files](#creating-tfd-files) below |

Try the included fixtures if you want a known-good trio: [`packages/backend/terraform/allplanmodules.json`](./packages/backend/terraform/allplanmodules.json), [`allplanmodules.dot`](./packages/backend/terraform/allplanmodules.dot), and [`allplanmodules.tfd`](./packages/backend/terraform/allplanmodules.tfd). For state-only or plan+state tests locally, generate `terraform_allplanmodules.tfstate` in that directory (gitignored).

### Creating `.tfd` files

A **`.tfd`** file is an optional, hand-authored overlay for **declared dataflow** (blue arrows on the **Declared data flow** layer). It does not replace plan JSON or graph DOT. IAM-inferred dataflow (grey **Data flow** layer) still comes from the plan; `.tfd` only adds the arrows you explicitly list.

**When to use it:** document app-level flows (for example “writer Lambda writes to S3, then SQS; reader consumes from queue and bucket”) in a fixed order, without encoding IAM actions in the file.

#### 1. Start from the same plan JSON you will import

Generate `plan.json` as in step 1 above. Every `bind` line must use a **full Terraform resource address** exactly as it appears in that plan (same string as `resource_changes[].address`).

List addresses from the plan:

```bash
# All managed resource addresses in the plan
jq -r '.resource_changes[] | select(.mode == "managed") | .address' plan.json | sort

# Narrow to Lambdas / S3 / SQS (example)
jq -r '.resource_changes[] | select(.type == "aws_lambda_function" or .type == "aws_s3_bucket" or .type == "aws_sqs_queue") | .address' plan.json | sort
```

Copy the addresses you care about into your `.tfd` file. If an address does not exist in the plan you import, that edge is skipped (dev builds log a warning).

#### 2. Syntax

| Line | Meaning |
| --- | --- |
| `# comment` | Ignored |
| `bind alias = <full address>` | Short name → exact plan address (RHS must contain `.`, e.g. `module.foo.aws_lambda_function.this[0]`) |
| `alias -> other` | Directed edge; `other` can be another alias or a full address |
| `module.a... -> module.b...` | Edge using full addresses on both sides (no `bind` required) |

**Order matters:** edges are drawn in file order (first line first). Use that to show sequence (for example writer → bucket, then writer → queue).

#### 3. Example (matches [`allplanmodules.tfd`](./packages/backend/terraform/allplanmodules.tfd))

```tfd
bind writer = module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]
bind reader = module.workload_reader_lambda.module.lambda.aws_lambda_function.this[0]
bind bucket = module.application_data_bucket.module.bucket.aws_s3_bucket.this[0]
bind queue  = module.application_job_queue.module.queue.aws_sqs_queue.this[0]

writer -> bucket
writer -> queue
queue -> reader
bucket -> reader
```

Save as `my-stack.tfd` (any name; `.tfd` is conventional).

#### 4. Import

In **Import Terraform**, upload **plan JSON + graph DOT** as usual, then choose the `.tfd` under **Dataflow links (.tfd)**. After import, enable **Terraform layers → Declared data flow edges** if the arrows are hidden (they are turned on automatically when you attach a `.tfd` file).

![Semantic view with declared dataflow (blue) from allplanmodules fixtures: plan JSON, graph DOT, and allplanmodules.tfd](docs/terraform-semantic-dataflow.png)

### 100-case fixture corpus (optional)

For regression testing the import pipeline, the repo can generate **100 real Terraform plan exports** (`plan.json` + `graph.dot`) from the sample stack in [`packages/backend/terraform/`](./packages/backend/terraform/). This uses a **Bootstrap · Freeze · Plan** workflow:

1. **Bootstrap (once, AWS)** — serial applies build checkpoint state files, then optionally destroy live resources.
2. **Freeze** — save `fixtures/states/state_*.json` (gitignored).
3. **Plan (repeatable, ~$0 AWS)** — run `terraform plan` against copied checkpoint state + different HCL presets; export JSON and DOT. No apply during corpus generation.

Every case is produced by the real Terraform/OpenTofu CLI (`plan` → `show -json` → `graph -plan=…`). There is no hand-edited plan JSON. **LocalStack is not used** for the full VPC/Lambda/ALB stack; use real AWS once for checkpoints, then plan-only regen.

More detail: [`packages/backend/README.md`](./packages/backend/README.md), [`packages/backend/terraform/fixtures/README.md`](./packages/backend/terraform/fixtures/README.md).

#### Prerequisites

- **Terraform** or **OpenTofu** on `PATH` (scripts default to `terraform`; set `TF_CLI=tofu` for OpenTofu).
- **Node.js 22+** and `yarn install` from repo root.
- **Bootstrap only:** AWS credentials and `packages/backend/terraform/terraform.tfvars` with a valid `aws_account_id` (or `terraform_deploy_role_arn`).

#### Layout

| Path | Purpose |
| --- | --- |
| `packages/backend/terraform/fixtures/manifest.json` | 100 recipes (committed) |
| `packages/backend/terraform/fixtures/presets/` | HCL bundles composed into `main.workload.tf` |
| `packages/backend/terraform/fixtures/states/` | Checkpoint state JSON (gitignored) |
| `packages/backend/terraform/.corpus/case-NNN/` | Generated `plan.json`, `graph.dot`, `meta.json` (gitignored) |

#### Yarn commands

| Command | Purpose |
| --- | --- |
| `yarn fixtures:manifest` | Regenerate `manifest.json` (100 cases) |
| `yarn fixtures:compose -- --preset 50-full` | Write `main.workload.tf` for local dev |
| `yarn fixtures:seed-state-070` | Copy `terraform_allplanmodules.tfstate` → `fixtures/states/state_070.json` |
| `yarn fixtures:all` | **Full pipeline:** bootstrap + destroy + 100 plans + validate |
| `yarn fixtures:bootstrap` | Phase 1 only: serial applies → checkpoint states (leaves AWS resources up) |
| `yarn fixtures:bootstrap:destroy` | Phase 1 + `terraform destroy` teardown (recommended before corpus) |
| `yarn fixtures:corpus` | Phase 2: generate `.corpus/` (default: 4 parallel workers) |
| `yarn fixtures:corpus:serial` | Phase 2 serial + skip missing states + stop on first failure |
| `yarn fixtures:corpus:validate` | Validate generated exports |
| `CORPUS_FULL=1 yarn test:app packages/excalidraw/components/terraformCorpusFixtures.test.ts` | Import test for all generated cases |

Pass extra flags after `--`, for example: `yarn fixtures:corpus -- --serial --limit 10`.

#### `run-recipes.mjs` flags

| Flag | Effect |
| --- | --- |
| `--jobs N` | Parallel workers (default `4`) |
| `--serial` | One case at a time; **stop on first failure** |
| `--continue-on-error` | With `--serial`: keep going after failures |
| `--limit N` | Run at most the first **N** cases (`case-001` … `case-00N`) |
| `--checkpoint state_070` | Only cases that use that checkpoint (e.g. after `seed-state-070`) |
| `--skip-missing-state` | Skip cases whose checkpoint file is missing (do not fail) |
| `--case case-023` | Run a single case |
| `--force` | Regenerate even if `plan.json` already exists |
| `--no-clean-tf` | Keep per-case `tf/` dir (provider plugins); default is to delete it after success |
| `--fail-fast` | Stop on first failure (enabled by default with `--serial`) |
| `--log-file path` | Append the same INFO/WARN/ERROR lines to `path` (ISO timestamps); see also `FIXTURES_LOG_FILE` |

**Logging:** Lines are printed to stdout (and mirrored to `--log-file` / `FIXTURES_LOG_FILE` if set), each prefixed with an ISO timestamp. Examples:

```bash
yarn fixtures:corpus -- --serial --limit 10 --skip-missing-state --log-file /tmp/fixtures-corpus.log
FIXTURES_LOG_FILE=/tmp/fixtures-corpus.log yarn fixtures:corpus -- --checkpoint state_070
```

Each case logs `SKIP`/`BEGIN`/`END` (including `progress=i/n` when the runner knows manifest size); the run finishes with `SUMMARY ok=… skipped=… failed=…`.

**Cleanup:** Plan-only runs do **not** create or change AWS resources. After each successful case, the runner deletes `.corpus/case-NNN/tf/` (Terraform init cache) and keeps `plan.json`, `graph.dot`, `plan.bin`, and `meta.json`. If a case **fails**, its `tf/` folder is left for debugging. Wipe everything with `rm -rf packages/backend/terraform/.corpus`.

#### Quick start (smoke test, no full bootstrap)

If you already have full-stack state as `terraform_allplanmodules.tfstate`:

```bash
yarn fixtures:seed-state-070

node packages/backend/terraform/scripts/fixture-corpus/run-recipes.mjs --case case-023 --jobs 1

yarn fixtures:corpus:validate -- --case case-023

CORPUS_FULL=1 yarn test:app packages/excalidraw/components/terraformCorpusFixtures.test.ts
```

`case-023` is **full state + config without monitoring** — the same scenario as the committed [`allplanmodules.json`](./packages/backend/terraform/allplanmodules.json) / [`.dot`](./packages/backend/terraform/allplanmodules.dot) pair (same plan shape; useful to confirm the pipeline works).

Import the generated files in the app:

- `packages/backend/terraform/.corpus/case-023/plan.json`
- `packages/backend/terraform/.corpus/case-023/graph.dot`

#### Run a small batch safely

The first cases in the manifest (`case-001` …) need `state_000`, not `state_070`. If you only ran `yarn fixtures:seed-state-070`, filter by checkpoint:

```bash
# First 10 cases that use state_070 (after seed-state-070)
yarn fixtures:corpus -- --serial --checkpoint state_070 --limit 10

# First 10 manifest cases overall — needs bootstrap for state_000, state_010, …
yarn fixtures:corpus -- --serial --limit 10 --skip-missing-state

# Serial, run all cases that have state files, continue after failures
yarn fixtures:corpus -- --serial --continue-on-error --skip-missing-state
```

#### Full corpus (all 100 cases)

**One command** (bootstrap → all plans → validate):

```bash
cd packages/backend/terraform   # optional; scripts work from repo root too
# Ensure terraform.tfvars exists (aws_account_id or terraform_deploy_role_arn)
cd ../../..                     # back to repo root

yarn fixtures:all
```

What `yarn fixtures:all` does:

1. **Bootstrap** — 8 serial applies in AWS, saves every `fixtures/states/state_*.json`, then **destroys** workload resources (ALB protection off → `terraform destroy` with artifacts-only config).
2. **Corpus** — 100 plan-only exports to `.corpus/` (8 parallel workers; cleans up each case’s `tf/` dir after success).
3. **Validate** — checks every generated `plan.json` / `graph.dot`.

Then run importer tests:

```bash
CORPUS_FULL=1 yarn test:app packages/excalidraw/components/terraformCorpusFixtures.test.ts
```

**Step by step** (same thing, more control):

```bash
yarn fixtures:bootstrap:destroy   # AWS applies + teardown
yarn fixtures:corpus --jobs 8     # plan-only, no AWS
yarn fixtures:corpus:validate
```

Safer iteration while debugging:

```bash
yarn fixtures:corpus -- --serial --limit 10
```

Share checkpoint states between machines with an encrypted tarball of `packages/backend/terraform/fixtures/states/` (not committed to git).

#### Cases that work with only `state_070`

After `yarn fixtures:seed-state-070`, many recipes that use `stateCheckpoint: "state_070"` will run (shrinks, var tweaks, noop refresh). Greenfield and incremental-add cases need `state_000`, `state_010`, … from bootstrap. List them:

```bash
node -e "
const m=require('./packages/backend/terraform/fixtures/manifest.json');
m.cases.filter(c=>c.stateCheckpoint==='state_070').forEach(c=>console.log(c.id, c.title));
"
```

## What you get on the canvas

- **AWS-style resource cards** for common services such as IAM, Lambda, S3, SQS, RDS, VPC, CloudWatch, and more.
- **Dependency arrows** rendered behind resource cards from Terraform graph relationships.
- **Semantic cloud boundaries** for account, region, VPC, subnet, and related topology.
- **Module-aware layout** so sibling modules get space and module internals stay readable.
- **Nested infrastructure containers** with staggered padding to make hierarchy visible.
- **Lambda module placement presets** for common Lambda internals such as functions, roles, inline policies, log groups, and packages.
- **Terraform details on elements**, including diffs, known-after-apply values, and selected fields.

Everything remains editable because the output is an Excalidraw scene.

## Safety model

tfdraw.dev is designed as a local-file review tool:

- The app does not request AWS, Terraform Cloud, or other cloud credentials.
- The app does not run `terraform`, `tofu`, provider plugins, or shell commands.
- Plan JSON and graph DOT are read by browser code during import.
- The normal workflow does not require uploading plans to a tfdraw backend.
- Excalidraw scenes can be saved to disk and exported from the browser.

You should still treat Terraform plan JSON as sensitive. It can contain resource names, ARNs, tags, environment data, outputs, and sometimes secrets if your configuration exposes them. Review what is in the generated files before sharing diagrams or imported scenes.

## Supported views

The import dialog supports two diagram modes:

- **Semantic view**: emphasizes account, region, VPC, subnet, and infrastructure topology. Works with plan JSON + graph DOT (planned changes) or state alone (current infrastructure snapshot).
- **Module view**: frames the graph around Terraform module structure.

Production/static builds open on a Terraform Canvas landing page with an embedded editor. Development mode opens the standard editor directly. In public mode, drawing, local persistence, load/save from disk, image export, and Terraform import remain available.

## Current limitations

- Terraform plan JSON and graph DOT must be selected together when using plan-based import.
- State-only semantic view shows deployed resources only (no create/update/delete diffs from a plan).
- The importer is strongest on AWS-shaped infrastructure today; other providers may render with generic cards or less semantic grouping.
- Public mode intentionally hides collaboration, share-link creation, Firebase-backed share loading, Excalidraw+ promotion/cloud export controls, and backend export actions.
- The special `/excalidraw-plus-export` route is preserved for the existing Excalidraw+ iframe export behavior.

## FAQ

### Does tfdraw.dev need access to my AWS account?

No. You generate Terraform/OpenTofu outputs locally and import those files in the browser.

### Does the app apply or modify infrastructure?

No. It does not run Terraform/OpenTofu and cannot apply changes. It visualizes files you provide.

### Is this a replacement for Terraform plan review?

No. It is a visual companion for review. Keep reading the plan, policy checks, CI output, and provider-specific details.

### Can I edit the imported diagram?

Yes. Imported resources, labels, arrows, and containers are regular Excalidraw elements.

### Can I use OpenTofu?

Yes, as long as you provide compatible JSON from `tofu show -json` and DOT from `tofu graph`.

### Is there a backend parser?

The active import flow is client-side. The backend package contains fixtures and legacy reference scripts used to compare behavior with the browser parser.

## Contributing / development

Install dependencies and run the app:

```bash
yarn install
yarn start
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `yarn test` | Run Vitest in watch mode |
| `yarn test --watch=false` | Run Vitest once |
| `yarn test terraformPlanParsing.test --watch=false` | Run the Terraform plan parser test subset |
| `yarn fixtures:corpus:serial` | Generate corpus cases serially (see [fixture corpus](#100-case-fixture-corpus-optional)) |
| `yarn fixtures:corpus -- --serial --limit 10 --skip-missing-state` | First 10 corpus cases, fail-fast |
| `CORPUS_FULL=1 yarn test:app packages/excalidraw/components/terraformCorpusFixtures.test.ts` | Test import for all generated `.corpus/` cases |
| `yarn test:typecheck` | Run TypeScript checks |
| `yarn test:code` | Run ESLint |
| `yarn test:other` | Run Prettier checks |
| `yarn test:update` | Run Vitest once and update snapshots |
| `yarn build:packages` | Build workspace packages |
| `yarn build:app` | Build the app |
| `yarn build:preview` | Preview the static app |

The parser test lives at [`packages/excalidraw/components/terraformPlanParsing.test.ts`](./packages/excalidraw/components/terraformPlanParsing.test.ts) and uses the fixture pair in [`packages/backend/terraform/`](./packages/backend/terraform/).

Core editor development still follows the upstream [Excalidraw documentation](https://docs.excalidraw.com) and [development guide](https://docs.excalidraw.com/docs/introduction/development).

## Deployment notes

Build the static public app:

```bash
yarn build:pages
```

The output is written to `excalidraw-app/build`. The `build:pages` script uses CI-friendly Vite settings: Sentry and product analytics are disabled, production source maps are omitted unless `VITE_PROD_SOURCEMAP=true` is set, and `vite-plugin-checker` is skipped during the Vite build. Typecheck and lint remain available through `yarn test:typecheck` and `yarn test:code`.

Create a static bundle tarball:

```bash
yarn bundle:whiteboard
```

That runs `yarn build:pages` and writes `releases/tfdraw-whiteboard-<appVersion>-<gitShortSha>.tar.gz` from `excalidraw-app/build/`. Use `yarn bundle:whiteboard:archive` if the build already exists. Pass options after `--`, for example `yarn bundle:whiteboard -- --profile=full`, `--out=dist`, or `--name=my-board`.

### Cloudflare Pages

[`pages-deploy.yml`](./.github/workflows/pages-deploy.yml) builds and deploys to Cloudflare Pages when a commit lands on `master`, or when the workflow is run manually. It runs:

```bash
yarn install --frozen-lockfile
yarn build:pages
npx wrangler@4 pages deploy excalidraw-app/build --project-name="$CF_PAGES_PROJECT_NAME"
```

Configure GitHub Actions with:

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | API token with Cloudflare Pages edit access |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Variable | `CF_PAGES_PROJECT_NAME` | Cloudflare Pages project name; if unset, CI builds and skips deploy |

For manual upload after `yarn build:pages`:

```bash
npx wrangler@4 pages deploy excalidraw-app/build --project-name=YOUR_PAGES_PROJECT_NAME
```

Use `wrangler pages deploy` for Cloudflare Pages. `wrangler deploy` targets Workers with static assets and different configuration semantics.

[`wrangler.jsonc`](./wrangler.jsonc) sets `pages_build_output_dir` to `./excalidraw-app/build` for Pages deploys and includes an `assets` block for Workers/static-assets SPA routing. The file does not run the Vite build by itself; CI or your local build must create `excalidraw-app/build` first.

If the Cloudflare Pages project is still Git-connected, disable Cloudflare automatic Git builds after GitHub Actions deploy is wired. Otherwise pushes may start a separate Cloudflare builder run in addition to the direct Wrangler upload.

## Upstream Excalidraw

This repository is built on [Excalidraw](https://github.com/excalidraw/excalidraw), the open-source whiteboard with a hand-drawn look. tfdraw.dev keeps the canvas, tools, local scene loading/saving, export behavior, and editor ergonomics, then adds the Terraform import pipeline and graph-to-canvas flow on top.

- [Excalidraw](https://excalidraw.com)
- [Excalidraw documentation](https://docs.excalidraw.com)
- [Upstream MIT license](https://github.com/excalidraw/excalidraw/blob/master/LICENSE)

## License

MIT. See [`LICENSE`](./LICENSE).
