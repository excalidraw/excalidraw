# `packages/backend`

Terraform modules and **fixture corpus** tooling for tfdraw. The Node HTTP API was removed; import runs client-side in `packages/excalidraw`.

## Layout

| Path | Purpose |
|------|---------|
| [`terraform/`](./terraform/) | IaC root (`main.base.tf`, `artifacts.tf`, composed `main.workload.tf`) |
| [`terraform/fixtures/presets/`](./terraform/fixtures/presets/) | HCL presets (module bundles per stack stage) |
| [`terraform/fixtures/manifest.json`](./terraform/fixtures/manifest.json) | 100 `checkpoint-plan` recipes |
| [`terraform/fixtures/states/`](./terraform/fixtures/states/) | Checkpoint tfstate JSON (gitignored; from bootstrap) |
| [`terraform/.corpus/`](./terraform/.corpus/) | Generated `plan.json` + `graph.dot` per case (gitignored) |
| [`terraform/scripts/fixture-corpus/`](./terraform/scripts/fixture-corpus/) | Bootstrap · Freeze · Plan tooling |

## Bootstrap · Freeze · Plan

1. **Bootstrap (once, serial, AWS)** — build real checkpoint states, then destroy live resources:

   ```bash
   yarn fixtures:bootstrap:destroy   # applies chain + terraform destroy at end
   # or the full pipeline:
   yarn fixtures:all
   ```

   Saves `fixtures/states/state_000.json` … `state_070.json`.

2. **Corpus (parallel, $0 AWS)** — plan-only from frozen state:

   ```bash
   yarn fixtures:corpus --jobs 8
   # or one-at-a-time, stop on first failure (less to clean up):
   yarn fixtures:corpus:serial
   yarn fixtures:corpus:validate
   ```

3. **Tests** — PR uses committed `allplanmodules.*`; full corpus:

   ```bash
   CORPUS_FULL=1 yarn test:app packages/excalidraw/components/terraformCorpusFixtures.test.ts
   ```

## Other commands

```bash
yarn fixtures:manifest              # regenerate manifest.json (100 cases)
yarn fixtures:compose -- --preset 50-full   # write main.workload.tf for local dev
yarn fixtures:corpus -- --case case-042 --force
yarn fixtures:corpus -- --serial --limit 10 --skip-missing-state
```

## LocalStack

Not used for the full VPC/Lambda/ALB stack — checkpoint states come from real AWS bootstrap. Plan-only regen does not call AWS when `-refresh=false`.
