# tldraw-app

Sibling frontend that renders the same backend output (`@excalidraw/backend`) on a [tldraw](https://tldraw.dev) canvas instead of Excalidraw. Useful for exploring how the Terraform graph looks under a different drawing engine without forking the backend.

## How it works

1. Reuses the existing backend at `VITE_TERRAFORM_BACKEND_URL` (defaults to `http://localhost:3000`).
2. Calls `GET /terraform/upload/:id/render/tldraw` to get a backend-generated tldraw document.
3. Loads returned `shapes` into `<Tldraw />` via `editor.createShapes(...)`.

The backend connector currently emits shape partials from `DiagramIR` using a deterministic grid layout and relationship arrows. This keeps the format stable for clients while the connector evolves toward richer tldraw-native documents.

## Run

```bash
yarn install            # from monorepo root
yarn test:tldraw        # Vitest: backend tldraw connector + allplanmodules smoke
yarn start:backend      # in one terminal — :3000
yarn start:tldraw       # in another  — :3001
```

## Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `VITE_TERRAFORM_BACKEND_URL` | `http://localhost:3000` | Where the backend lives (shared with `excalidraw-app`). |
| `VITE_TLDRAW_APP_PORT` | `3001` | Dev server port. |
