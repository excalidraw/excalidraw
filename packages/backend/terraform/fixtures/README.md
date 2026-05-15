# Terraform fixture corpus

- **`manifest.json`** — 100 recipes (`checkpoint-plan` against frozen state).
- **`presets/`** — HCL bundles composed into `main.workload.tf`.
- **`states/`** — `state_*.json` from `yarn fixtures:bootstrap` (gitignored).
- **`.corpus/`** (parent dir) — generated `plan.json` / `graph.dot` per case.

Quick start if you already have full-stack state:

```bash
yarn fixtures:seed-state-070   # copies terraform_allplanmodules.tfstate
yarn fixtures:corpus --jobs 8
```
