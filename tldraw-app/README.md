# tldraw-app

Sibling frontend that renders the same backend output (`@excalidraw/backend`)
on a [tldraw](https://tldraw.dev) canvas instead of Excalidraw. Useful for
exploring how the Terraform graph looks under a different drawing engine
without forking the backend.

## How it works

1. Reuses the existing backend at `VITE_TERRAFORM_BACKEND_URL` (defaults to
   `http://localhost:3000`).
2. Calls `GET /terraform/upload/:id/render/excalidraw` to get the prepared
   scene (this is the connector seam in `packages/backend/connectors/`).
3. Converts the Excalidraw scene to tldraw shape partials client-side via
   `src/excalidrawToTldraw.ts` and feeds them to `<Tldraw />`.

This converter is **first-pass**: rectangles, ellipses, diamonds, text, arrows,
and lines map across; freedraw / images / icons are dropped; tldraw's
constrained color palette means strokes get bucketed.

When the backend grows a real `connectors/tldraw.js`, this converter goes away
and the canvas just loads tldraw documents directly.

## Run

```bash
yarn install            # from monorepo root
yarn test:tldraw        # Vitest: textAlign mapping + allplanmodules pipeline smoke
yarn start:backend      # in one terminal — :3000
yarn start:tldraw       # in another  — :3001
```

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `VITE_TERRAFORM_BACKEND_URL` | `http://localhost:3000` | Where the backend lives (shared with `excalidraw-app`). |
| `VITE_TLDRAW_APP_PORT` | `3001` | Dev server port. |
