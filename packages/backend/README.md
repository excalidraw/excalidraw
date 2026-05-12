# `packages/backend`

The **Node.js HTTP API** that used to live in this package (upload routes, SQLite, layout pipeline server) has been removed to keep the monorepo smaller.

**Terraform for local development** stays in [`terraform/`](./terraform/): modules, variables, plan/graph fixtures (`allplanmodules.json`, `.dot`, etc.), and scripts you run with the Terraform or OpenTofu CLI.

Terraform import and graph layout in the app are handled in **`packages/excalidraw`** (client-side). This folder is for maintaining and applying the infrastructure-as-code that matches your diagrams, not for a running backend process.
