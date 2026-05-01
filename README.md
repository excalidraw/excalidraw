# Excalidraw Terraform

A **Terraform architecture visualizer built on [Excalidraw](https://excalidraw.com)**.

Upload a Terraform plan JSON, graph DOT, and optionally `terraform.tfstate`; the backend enriches the graph and generates an editable Excalidraw scene with AWS service icons, dependency arrows, module boxes, and account/region/VPC/subnet boundaries.

![Terraform plan imported into Excalidraw — infrastructure as an editable diagram](docs/terraform-canvas-aws-icons.png)

<p align="center">
  <a href="https://github.com/excalidraw/excalidraw/blob/master/LICENSE">
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
</p>

---

## What this fork adds

- **Terraform plan + graph import** — Upload plan JSON from `terraform show -json` and DOT from `terraform graph`; the backend builds resource nodes and dependency edges.
- **Optional state enrichment** — Upload `terraform.tfstate` to merge real deployed attributes, existing dependencies, ARNs, regions, accounts, VPC IDs, and subnet IDs into the rendered graph.
- **AWS architecture icons** — Resource cards use the bundled AWS architecture icon library, including IAM, Lambda, S3, SQS, RDS, VPC, CloudWatch, and many other services.
- **Module-aware layout** — Terraform modules are placed as layout units so sibling modules have space and module internals stay readable.
- **Nested infrastructure boundaries** — Account, region, VPC, subnet, and module containers are rendered with staggered padding so the ownership/context hierarchy is visible.
- **Lambda module preset** — Common Lambda module internals such as function, role, inline policies, log group, and package resources get stable relative placement.
- **Relationship rendering** — Planned dependencies and state-derived dependencies are drawn as arrows behind the resource cards.
- **Terraform details panel data** — Resource diffs, known-after-apply values, and selected state/config fields are stored on the Excalidraw elements for inspection.

The rest is standard Excalidraw: hand-drawn style, zoom/pan, export to PNG/SVG, and the usual editor tools.

---

## Quick start

**Run the app (frontend + backend):**

```bash
yarn install
yarn start          # Excalidraw app (e.g. Vite dev server)
# In another terminal:
node backend/index.js   # Backend on http://localhost:3000
```

Then use the **Terraform Import** flow in the app to upload:

1. **Plan file** — JSON from `terraform show -json <planfile>` (or your plan output saved as JSON).
2. **Graph file** — DOT output (e.g. from `terraform graph` or your plan’s graph representation).
3. **State file, optional** — `terraform.tfstate` for deployed-resource enrichment and existing dependency discovery.

The backend stores the upload, generates the enriched graph, and returns an Excalidraw scene that the app inserts into the canvas.

Import shortcut: `Ctrl/Cmd + Shift + K`.

---

## Development

- **Type checking:** `yarn test:typecheck`
- **Tests:** `yarn test:update`
- **Lint / format:** `yarn fix`
- **Build packages:** `yarn build:packages`
- **Build app:** `yarn build:app`

See the main [Excalidraw documentation](https://docs.excalidraw.com) and [development guide](https://docs.excalidraw.com/docs/introduction/development) for the core editor.

---

## Upstream Excalidraw

This repo is built on [Excalidraw](https://github.com/excalidraw/excalidraw): an open-source, collaborative whiteboard with a hand-drawn look. We keep the existing Excalidraw features (canvas, tools, export, etc.) and add the Terraform import pipeline and graph-to-canvas flow on top.

- [Excalidraw](https://excalidraw.com) · [Docs](https://docs.excalidraw.com) · [License (MIT)](https://github.com/excalidraw/excalidraw/blob/master/LICENSE)
