# `packages/backend`

Terraform for **staging multi-state** (AWS) and **Cloudflare** (Pages/DNS). The Node HTTP API was removed; import runs client-side in `packages/excalidraw`.

## Layout

| Path | Purpose |
| --- | --- |
| [`terraform/staging-multi-state/`](./terraform/staging-multi-state/) | 25 independent stack roots (network, datastores, APIs, messaging, `pipeline.tfd`) |
| [`terraform/cloudflare/`](./terraform/cloudflare/) | Cloudflare zone, DNS, Pages, Workers (plan exports for import tests) |
| [`terraform/modules/`](./terraform/modules/) | Shared modules used by staging stacks |
| [`terraform/import-presets.catalog.json`](./terraform/import-presets.catalog.json) | Built-in import preset manifest (`staging-multi-state-expanded`) |

## Staging multi-state

Each stack under `staging-multi-state/<stack-id>/` is its own Terraform root. Export plan + graph per stack, then hydrate the dev preset DB:

```bash
yarn hydrate:terraform-preset staging-multi-state-expanded
# or: yarn seed:terraform-presets
```

See [`terraform/staging-multi-state/README.md`](./terraform/staging-multi-state/README.md) and [`terraform/staging-multi-state/ARCHITECTURE.md`](./terraform/staging-multi-state/ARCHITECTURE.md).

## Cloudflare

Plan/dot exports live under `terraform/cloudflare/` (gitignored blobs). Re-export after changing `resources.tf` / `main.tf`, then re-seed presets if you embed Cloudflare in the test DB.

## Import presets

The app loads presets from SQLite (dev) or Cloudflare D1 (Pages). The committed test fixture is `packages/excalidraw/test-fixtures/terraform-import-presets.db`.

```bash
yarn verify:terraform-presets-test-db
yarn export:terraform-presets-test-db   # after catalog / fixture changes
yarn push:terraform-presets-d1:preview  # hosted preview D1
```
