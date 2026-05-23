# `packages/backend`

Terraform modules and **fixture corpus** tooling for tfdraw. The Node HTTP API was removed; import runs client-side in `packages/excalidraw`.

## Layout

| Path | Purpose |
| --- | --- |
| [`terraform/`](./terraform/) | IaC root (`main.base.tf`, `artifacts.tf`, composed `main.workload.tf`) |
| [`terraform/fixtures/presets/`](./terraform/fixtures/presets/) | HCL presets (module bundles per stack stage) |
| [`terraform/fixtures/manifest.json`](./terraform/fixtures/manifest.json) | 100 `checkpoint-plan` recipes |
| [`terraform/fixtures/states/`](./terraform/fixtures/states/) | Checkpoint tfstate JSON (gitignored; from bootstrap) |
| [`terraform/.corpus/`](./terraform/.corpus/) | Generated `plan.json` + `graph.dot` per case (gitignored) |
| [`terraform/scripts/fixture-corpus/`](./terraform/scripts/fixture-corpus/) | Bootstrap · Freeze · Plan tooling |

More fixture notes: [`terraform/fixtures/README.md`](./terraform/fixtures/README.md).

## Bootstrap · Freeze · Plan

For regression testing the import pipeline, the repo can generate **100 real Terraform plan exports** (`plan.json` + `graph.dot`) from the sample stack. Workflow:

1. **Bootstrap (once, AWS)** — serial applies build checkpoint state files, then optionally destroy live resources.
2. **Freeze** — save `fixtures/states/state_*.json` (gitignored).
3. **Plan (repeatable, ~$0 AWS)** — run `terraform plan` against copied checkpoint state + different HCL presets; export JSON and DOT. No apply during corpus generation.

Every case is produced by the real Terraform/OpenTofu CLI (`plan` → `show -json` → `graph -plan=…`). There is no hand-edited plan JSON. **LocalStack is not used** for the full VPC/Lambda/ALB stack; use real AWS once for checkpoints, then plan-only regen.

### Prerequisites

- **Terraform** or **OpenTofu** on `PATH` (scripts default to `terraform`; set `TF_CLI=tofu` for OpenTofu).
- **Node.js 22+** and `yarn install` from repo root.
- **Bootstrap only:** AWS credentials and `packages/backend/terraform/terraform.tfvars` with a valid `aws_account_id` (or `terraform_deploy_role_arn`).

### Yarn commands

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

### `run-recipes.mjs` flags

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

### Quick start (smoke test, no full bootstrap)

If you already have full-stack state as `terraform_allplanmodules.tfstate`:

```bash
yarn fixtures:seed-state-070

node packages/backend/terraform/scripts/fixture-corpus/run-recipes.mjs --case case-023 --jobs 1

yarn fixtures:corpus:validate -- --case case-023

CORPUS_FULL=1 yarn test:app packages/excalidraw/components/terraformCorpusFixtures.test.ts
```

`case-023` is **full state + config without monitoring** — the same scenario as the committed [`allplanmodules.json`](./terraform/allplanmodules.json) / [`.dot`](./terraform/allplanmodules.dot) pair (same plan shape; useful to confirm the pipeline works).

Import the generated files in the app:

- `packages/backend/terraform/.corpus/case-023/plan.json`
- `packages/backend/terraform/.corpus/case-023/graph.dot`

### Run a small batch safely

The first cases in the manifest (`case-001` …) need `state_000`, not `state_070`. If you only ran `yarn fixtures:seed-state-070`, filter by checkpoint:

```bash
# First 10 cases that use state_070 (after seed-state-070)
yarn fixtures:corpus -- --serial --checkpoint state_070 --limit 10

# First 10 manifest cases overall — needs bootstrap for state_000, state_010, …
yarn fixtures:corpus -- --serial --limit 10 --skip-missing-state

# Serial, run all cases that have state files, continue after failures
yarn fixtures:corpus -- --serial --continue-on-error --skip-missing-state
```

### Full corpus (all 100 cases)

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

### Cases that work with only `state_070`

After `yarn fixtures:seed-state-070`, many recipes that use `stateCheckpoint: "state_070"` will run (shrinks, var tweaks, noop refresh). Greenfield and incremental-add cases need `state_000`, `state_010`, … from bootstrap. List them:

```bash
node -e "
const m=require('./packages/backend/terraform/fixtures/manifest.json');
m.cases.filter(c=>c.stateCheckpoint==='state_070').forEach(c=>console.log(c.id, c.title));
"
```

## LocalStack

Not used for the full VPC/Lambda/ALB stack — checkpoint states come from real AWS bootstrap. Plan-only regen does not call AWS when `-refresh=false`.
