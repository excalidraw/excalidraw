# All-in-one Docker (UI + MCP + store)

The single-image build lives next to the three sibling repos as
`docker-all-in-one/` (parent of this `excalidraw` checkout).

```bash
cd ../..   # -> local-excalidraw/  (adjust if your layout differs)
# Prefer:
cd "$(dirname "$0")/../../.."  # from this file: local-excalidraw/

docker build -f docker-all-in-one/Dockerfile -t excalidraw-aio .
docker run --rm -p 3000:80 -p 3001:3001 -p 8080:8080 \
  -v excalidraw-store-data:/data excalidraw-aio
```

This fork's root `Dockerfile` accepts optional Vite build-args so the baked UI
can talk to a local store:

- `VITE_APP_BACKEND_V2_GET_URL` (e.g. `http://localhost:8080/api/v2/`)
- `VITE_APP_BACKEND_V2_POST_URL` (e.g. `http://localhost:8080/api/v2/post/`)

Full docs: sibling folder `docker-all-in-one/README.md`.
