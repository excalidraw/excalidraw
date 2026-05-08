# Backend (`@excalidraw/backend`)

Express API that turns a Terraform or OpenTofu **plan JSON**, a **`terraform graph` DOT** file, and an optional **state JSON** into a stored dependency graph you can open as an **Excalidraw** diagram (nodes, edges, and layout hints derived from the plan).

![Sample Terraform/OpenTofu diagram opened in Excalidraw](../../docs/terraform-canvas-aws-icons.png)

## How it fits together

1. **Plan JSON** (`terraform show -json` / `tofu show -json`) supplies resource metadata, changes, module paths, and references.
2. **DOT** (`terraform graph -type=plan` / `tofu graph -type=plan`) supplies adjacency; it is parsed with `graphlib-dot`.
3. **State** (optional) improves fidelity for existing resources and `depends_on` style relationships.

**Indexed resources:** plan addresses often include `[...]` for `count` / `for_each`, while graph DOT typically uses stripped resource ids. The pipeline keeps **full plan addresses** as node keys where needed and reconciles DOT edges by stripping indexes on the fly so instances are not collapsed into a single node.

## Package layout

| File | Role |
|------|------|
| `index.js` | HTTP routes, multipart upload, SQLite persistence |
| `pipeline.js` | Graph build: plan → nodes, DOT adjacency, state merge, IAM/data-flow edges, filtering |
| `diagram-ir.js` | Renderer-neutral IR (nodes/edges/groups) built from the pipeline `nodes` map |
| `connectors/` | Frontend connector registry. Excalidraw is `stable`; tldraw is `beta` and renders tldraw shape JSON |
| `excalidraw.js` | Excalidraw renderer: converts processed nodes into Excalidraw scene JSON |
| `vpc-networking-facet.js` | VPC/subnet/gateway-style facets before low-level plumbing is trimmed |
| `enrichment.js` | Hook for optional semantic labels/metadata |
| `db.js` | Drizzle + better-sqlite3 schema for uploads |

## Setup

Install dependencies from the repo root:

```bash
yarn install
```

## Run

From the repo root:

```bash
yarn start:backend
```

With auto-reload:

```bash
yarn dev:backend
```

Server starts on `http://localhost:3000`.

## Tests

From the repo root:

```bash
yarn test:backend
```

Or inside this package:

```bash
yarn workspace @excalidraw/backend test
```

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/terraform/upload` | Upload a Terraform/OpenTofu plan JSON, DOT graph, and optional state file. Returns an upload id. |
| GET | `/terraform/upload/:id` | Fetch the processed Terraform graph nodes for an upload. |
| GET | `/terraform/renderers` | Lists available frontend connectors (`excalidraw`, `tldraw`, …) and their status. |
| GET | `/terraform/upload/:id/render/:renderer` | Render the processed graph through the named connector. `:renderer` is the id from `/terraform/renderers`. |
| GET | `/terraform/upload/:id/excalidraw` | **Deprecated alias** for `/render/excalidraw`. Sets `Deprecation: true`. |
| GET | `/terraform/test-client` | Open a lightweight browser UI to upload plan+dot files and inspect VPC/subnet facet summaries from generated Excalidraw output. |

Unknown renderer ids return HTTP 404 with the available ids in the body. A
renderer that exists but isn't implemented yet returns
HTTP 501 with `{ renderer, details }`.

`POST /terraform/upload` expects multipart form fields:

| Field | Required | Description |
|-------|----------|-------------|
| `planFile` | Yes | JSON output from `terraform show -json` or `tofu show -json`. |
| `dotFile` | Yes | DOT output from `terraform graph` or `tofu graph`. |
| `stateFile` | No | Terraform/OpenTofu state JSON. Helps preserve existing resources and edges. |

## Generate Terraform Inputs

From the sample Terraform directory:

```bash
cd packages/backend/terraform

tofu plan -out=newplan
tofu show -json newplan > newplan.json
tofu graph -type=plan > newplan.dot
```

Upload `newplan.json`, `newplan.dot`, and optionally `terraform.tfstate`.

## Pluralith

Pluralith can generate a separate PDF diagram from the same Terraform/OpenTofu plan data.

Use JSON plans with OpenTofu:

```bash
cd packages/backend/terraform

tofu plan -out=newplan
tofu show -json newplan > newplan.json

pluralith graph --local-only --plan-file-json newplan.json --out-dir .
```

This avoids a common failure where Pluralith tries to run `terraform show` against an OpenTofu-generated binary plan:

```text
Couldn't show local plan
Plan read error: plan file was created by Terraform 1.11.5, but this is 1.14.7
```

Do not use `--plan-file newplan` unless the exact `terraform` binary/version Pluralith invokes can read that binary plan.

### Missing Graph Module

If Pluralith fails with:

```text
GenerateDiagram: fork/exec ~/Pluralith/bin/pluralith-cli-graphing: no such file or directory
```

install the graphing module manually. The built-in installer may fail with:

```text
parsing response failed -> GetGitHubRelease: %!w(<nil>)
```

On macOS, Pluralith currently publishes the graph module as `darwin_amd64`:

```bash
install -d ~/Pluralith/bin
curl -L \
  https://github.com/Pluralith/pluralith-cli-graphing-release/releases/download/v0.2.1/pluralith_cli_graphing_darwin_amd64_0.2.1 \
  -o ~/Pluralith/bin/pluralith-cli-graphing
chmod +x ~/Pluralith/bin/pluralith-cli-graphing
pluralith version
```

Expected:

```text
Graph Module Version: 0.2.1
```

On Apple Silicon, this binary is x86_64 and may require Rosetta.

## Rover

Rover can generate an interactive local Terraform visualization served on port `9000`.

Use the JSON plan path with OpenTofu:

```bash
cd packages/backend/terraform

tofu plan -out=newplan
tofu show -json newplan > newplan.json

docker run --rm -p 9000:9000 \
  -v "$(pwd)/newplan.json:/src/plan.json:ro" \
  im2nguyen/rover:latest \
  -planJSONPath=plan.json
```

Open:

```text
http://127.0.0.1:9000/
```

For the checked-in sample plans:

```bash
docker run --rm -p 9000:9000 \
  -v "$(pwd)/addplan.json:/src/plan.json:ro" \
  im2nguyen/rover:latest \
  -planJSONPath=plan.json

docker run --rm -p 9000:9000 \
  -v "$(pwd)/delplan.json:/src/plan.json:ro" \
  im2nguyen/rover:latest \
  -planJSONPath=plan.json
```

Avoid `-it` when running Rover from scripts or non-interactive shells:

```text
the input device is not a TTY
```

On Apple Silicon, Docker may print:

```text
WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8)
```

The image still runs under emulation. If Docker cannot connect to the OrbStack/Docker socket, start OrbStack or Docker Desktop first.

Rover may also print:

```text
No submodule configurations found...
Continuing without loading module from filesystem: lambda-writer
```

This is expected when running from a JSON plan only. Rover still builds the visualization from the plan data.

## Runtime Files

The backend creates local runtime artifacts:

| Path | Purpose |
|------|---------|
| `packages/backend/graph.db` | SQLite upload store. |
| `packages/backend/uploads/` | Temporary multer uploads. |
| `packages/backend/terraform/*.json`, `*.dot`, plan files | Sample/generated Terraform artifacts. |
