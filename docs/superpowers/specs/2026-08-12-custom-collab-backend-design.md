# Custom Collab Backend (replacing Firebase) — Design

Date: 2026-08-12
Status: Approved by user, not yet implemented

## Context

Excalidraw's collaboration feature ("invite via link") currently relies on two
external pieces:

1. A `socket.io` signaling server (source not in this repo — the reference
   implementation is `excalidraw/excalidraw-room`), used purely to relay
   already-encrypted cursor/element updates between collaborators in a room.
2. Firebase (Firestore + Storage), used from the browser via the Firebase
   client SDK directly, to persist the encrypted scene and encrypted files so
   a room can be reloaded/reconciled later. All content is encrypted
   client-side before it ever reaches Firebase — Firebase never sees
   plaintext, and the decryption key (`roomKey`) lives only in the URL hash.

Goal: replace both pieces with a self-hosted backend for an internal tool
used by 10-20 people, deployed on a single VPS via Docker + nginx.

## Requirements (from stakeholder conversation)

- New backend lives in a new `backend/` folder in this repo (not a separate
  repo), deployed alongside the existing frontend on the same VPS.
- Scene/file data is kept forever — no auto-delete/TTL.
- Stack: Node/Express + Prisma + PostgreSQL.
- File storage: Google Cloud Storage (bucket + service account already
  provisioned; key file kept outside git, gitignored as `gcs-key.json`).
- Socket.io signaling and the REST API run in a single combined Node
  process/container (not split into two services) — acceptable given the
  10-20 user scale, no need for horizontal scaling or a Redis adapter.
- No authentication. Access control stays exactly as today: a room is
  reachable by anyone who has the invite link (`roomId` + `roomKey` in the
  URL hash); `roomKey` is never sent to the backend.
- Files are proxied through Express (client → Express → GCS), not via
  GCS signed URLs — simpler, keeps GCS credentials server-side only, and
  bandwidth cost is a non-issue at this scale.
- The "Export to Excalidraw+" feature (a different, external Excalidraw
  product) is not used and will be hidden/removed from the UI rather than
  rewired, since it shares the same Firebase functions but serves an
  unrelated purpose.
- Design doc covers deployment (docker-compose + nginx) in addition to the
  backend app itself.

## Architecture

```
┌─────────────┐      ┌────────────────────────────┐      ┌─────────────┐
│   nginx     │─────▶│  backend/ (Node container)  │─────▶│  PostgreSQL │
│ (reverse    │ HTTP │  - Express REST API         │      │  (Prisma)   │
│  proxy+TLS) │  WS  │  - socket.io (same process) │      └─────────────┘
└─────────────┘      │  - GCS client (service acct)│─────▶  Google Cloud
       ▲              └────────────────────────────┘        Storage
       │
  excalidraw-app (frontend, existing container)
```

- `backend/` is a single Node process: one `http.createServer(app)` shared by
  Express and a `socket.io` `Server` instance attached to it.
- Prisma/PostgreSQL stores scene ciphertext and file metadata (GCS object
  paths) — never binary file content.
- GCS stores encrypted file bytes. Only `backend/` holds the service account
  key; it is never exposed to the client.
- nginx is the only container with a port exposed to the internet. It proxies
  `/api/*` and `/socket.io/*` to `backend`, and serves the built frontend
  static files for everything else.
- No auth model: a room's `roomId` is the only access key server-side;
  `roomKey` (decryption key) never leaves the client.

## Data model (Prisma schema)

```prisma
model Scene {
  roomId       String      @id
  ciphertext   Bytes
  iv           Bytes
  sceneVersion Int         @default(0)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  files        SceneFile[]
}

model SceneFile {
  id        String   @id          // fileId generated client-side by Excalidraw
  roomId    String
  scene     Scene    @relation(fields: [roomId], references: [roomId])
  gcsPath   String                // e.g. files/{roomId}/{fileId}
  createdAt DateTime @default(now())

  @@index([roomId])
}
```

No user/auth tables. `roomId` is the sole partition/access key.

## REST API

All `ciphertext`/`iv` fields are base64-encoded JSON (files are small enough
that multipart upload isn't needed).

| Method | Path | Purpose | Equivalent in old `firebase.ts` |
|---|---|---|---|
| `GET` | `/api/scenes/:roomId` | Load latest scene. 404 = new room. | `loadFromFirebase` |
| `PUT` | `/api/scenes/:roomId` | Save scene. Writes only if the submitted `sceneVersion` is greater than the stored one (optimistic concurrency guard against two clients racing); otherwise no-ops and returns the currently-stored payload so the client can reconcile. | `saveToFirebase` / `isSavedToFirebase` |
| `POST` | `/api/files/:roomId` | Upload an array of `{fileId, ciphertext, iv}`. Writes each to GCS and upserts `SceneFile`. Returns `{savedFiles, erroredFiles}` per-file (a failed upload doesn't fail the whole request). | `saveFilesToFirebase` |
| `GET` | `/api/files/:roomId?ids=a,b,c` | Fetch multiple files. Returns `{loadedFiles, erroredFiles}`. | `loadFilesFromFirebase` |
| `GET` | `/health` | Docker healthcheck. | — |

## Socket.io (signaling)

The existing `excalidraw-room` protocol is a pure relay — it never inspects
payloads (already encrypted client-side). We port the same event names
verbatim into `backend/` so `excalidraw-app/collab/Portal.tsx` needs **no
code changes**, only a new `VITE_APP_WS_SERVER_URL` value:

- `join-room` (client → server): join a room.
- `new-user` (server → existing clients): a new peer joined; existing clients
  broadcast their current scene to them.
- `server-broadcast` / `server-volatile-broadcast` (client → server): element
  / cursor updates; relayed via `socket.to(roomId).emit("client-broadcast", …)`.
  Volatile variant used for cursor updates that are fine to drop.
- `room-user-change` (server → clients): updated participant list on
  join/leave.

Single-process deployment means in-memory socket.io room state is sufficient
— no Redis adapter needed.

## Frontend changes

1. New file `excalidraw-app/data/backend.ts` replacing `excalidraw-app/data/firebase.ts`,
   exporting the same 6 functions (renamed away from "Firebase", e.g.
   `saveScene`, `loadScene`, `isSceneSaved`, `saveFiles`, `loadFiles`), calling
   `fetch()` against the new REST API instead of the Firebase SDK.
2. `excalidraw-app/collab/Collab.tsx` (~line 78-84): import from `./backend`
   instead of `./firebase`.
3. `excalidraw-app/App.tsx:125`: update the `loadFilesFromFirebase` import
   to the new module/name.
4. `excalidraw-app/vite-env.d.ts`: remove `VITE_APP_FIREBASE_CONFIG`, add
   `VITE_APP_BACKEND_URL` (REST API base URL).
5. `excalidraw-app/package.json`: drop the `firebase` dependency.
6. `.env.development` / `.env.production`: remove `VITE_APP_FIREBASE_CONFIG`,
   point `VITE_APP_WS_SERVER_URL` at the self-hosted signaling server, add
   `VITE_APP_BACKEND_URL`.
7. `excalidraw-app/components/ExportToExcalidrawPlus.tsx`: this imports the
   same Firebase functions but for an unrelated purpose (exporting to the
   external Excalidraw+ product). Since that feature is not used, hide/remove
   the "Export to Excalidraw+" entry point from the UI rather than rewiring
   it to the new backend.
8. `excalidraw-app/tests/collab.test.tsx`: update mocks from `firebase.ts` to
   `backend.ts`.

## Deployment (Docker + nginx)

The existing `docker-compose.yml` is dev-only (bind-mounted source, live
reload) and the root `Dockerfile` builds the production frontend image
(static build served by `nginx:stable-alpine-slim`). Neither is modified;
instead a new **`docker-compose.prod.yml`** is added with three services on
one internal Docker network:

1. **`postgres`** — `postgres:16-alpine`, dedicated named volume for data,
   not exposed outside the network.
2. **`backend`** — built from a new `backend/Dockerfile`. Env: `DATABASE_URL`,
   `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcs-key.json`
   (mounted read-only, not baked into the image). Runs `prisma migrate deploy`
   on startup before serving.
3. **`excalidraw`** — the existing frontend image/Dockerfile, but with an
   added custom `nginx.conf` that (a) serves static files with SPA fallback
   as today, and (b) reverse-proxies `/api/*` and `/socket.io/*` to
   `http://backend:<port>` on the shared network, forwarding `Upgrade`/
   `Connection` headers so the `/socket.io/*` WebSocket upgrade works through
   the proxy.

Only `excalidraw` (nginx) exposes a port to the internet; `backend` and
`postgres` are reachable only inside the Docker network.

## Error handling

- REST API: centralized error handling middleware returns `{error}` with an
  appropriate status (404 unknown room, 409 stale `sceneVersion` conflict,
  500 otherwise). The new `backend.ts` client module handles fetch failures
  the same way the old `firebase.ts` handled SDK exceptions, so a transient
  network blip doesn't crash collaboration.
- Socket.io: relies on `socket.io-client`'s default reconnection behavior,
  already used by `Portal.tsx` — no change needed there.
- File uploads: a failed GCS write for one file is reported per-file in
  `erroredFiles`; it does not fail the whole `POST /api/files/:roomId`
  request, matching the old `saveFilesToFirebase` contract.

## Testing

- `backend/`: unit tests around the `PUT /api/scenes/:roomId` upsert-if-newer
  logic (the one piece of real business logic/race condition), against a
  Prisma test database.
- Frontend: update `excalidraw-app/tests/collab.test.tsx` mocks from
  `firebase.ts` to `backend.ts`.
- Manual: two browser tabs joining the same room against the new backend on
  local `docker-compose.prod.yml` before deploying to the VPS.

## Out of scope / explicitly deferred

- Authentication/authorization — link-based access only, as today.
- Scene/file retention policy or cleanup jobs — data is kept indefinitely.
- GCS signed-URL direct upload/download — proxying through Express was chosen
  instead; revisit only if VPS bandwidth becomes a real bottleneck.
- Horizontal scaling of the backend (multiple instances, Redis socket.io
  adapter) — not needed at 10-20 user scale.
