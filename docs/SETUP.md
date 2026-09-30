# Local setup

## Prerequisites

- **Node.js ≥ 20** and **Yarn 1.x** (the repo is a Yarn-classic workspace: `npm i -g yarn`).
- **MongoDB 6 or 7** listening on `127.0.0.1:27017`. Nothing else: no Docker, no PostgreSQL.
  - macOS (Homebrew): `brew services start mongodb-community@7.0`
  - Linux / other: `mongod --dbpath ~/mongo-data`, or `docker compose up -d mongo` (see [DEPLOYMENT.md](DEPLOYMENT.md))
- Optional: **MongoDB Compass** to inspect the data. Connect to `mongodb://127.0.0.1:27017` and open the `excalidraw_workspace` database.

## First run

```bash
yarn install                                   # installs every workspace

cp server/.env.example server/.env             # then edit SESSION_SECRET (see below)
openssl rand -base64 48                        # paste the output into SESSION_SECRET

yarn dev:all                                   # API on :3100 + web app on :3002
```

Open <http://localhost:3002>, choose **Create an account**, and you land on your dashboard with a personal workspace already created. Create a scene and draw; every change autosaves to MongoDB.

You can also run the two halves separately:

```bash
yarn dev:server        # Fastify API + realtime + MCP     -> http://127.0.0.1:3100
yarn dev:workspace     # Vite web app (proxies /api, /public, /mcp to the API) -> http://localhost:3002
```

The database, collections, validators and indexes are created automatically on server start (`server/src/db.ts › initializeSchema`). There is no migration step.

## Configuration

All server settings are environment variables, documented in `server/.env.example`. The ones you will touch first:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI`, `MONGODB_DB` | Where the data lives (default `mongodb://127.0.0.1:27017`, `excalidraw_workspace`). |
| `SESSION_SECRET` | ≥ 32 random characters. Signs/keys session lookups, share tokens and API keys. Changing it signs everyone out and invalidates share-link tokens. |
| `ENCRYPTION_KEY` | Optional separate key for secrets stored at rest (AI provider keys). Defaults to `SESSION_SECRET`. Changing it makes stored AI keys unreadable (re-enter them). |
| `ALLOWED_ORIGINS` | Browser origins allowed to call the API with cookies. Must include the web app's origin. |
| `STORAGE_PROVIDER` | `local` (default, `STORAGE_PATH`) or `s3` (any S3-compatible bucket). |
| `ENABLE_*` | Feature flags (see [ARCHITECTURE.md](ARCHITECTURE.md#feature-flags)). |
| `AI_*` | Optional instance-wide AI defaults. Workspace admins can also configure AI in the UI. |

`workspace-app/.env` blanks the upstream URLs (library browser, AI backend) so the editor never reaches for hosted services.

## Tests and checks

```bash
yarn test:server                                   # 170+ API/realtime/security tests (needs MongoDB)
npx vitest run workspace-app --watch=false         # client unit tests
yarn test:typecheck                                # tsc over the whole monorepo
npx eslint --max-warnings=0 --ext .ts,.tsx server workspace-app
yarn --cwd workspace-app build                     # production build of the web app
yarn test:e2e                                      # browser journeys (needs the stack running, see e2e/README.md)
```

The server tests create a throw-away database per test file (`ew_test_<random>`) and drop it afterwards, so they never touch your `excalidraw_workspace` data.

## Troubleshooting

- **`ECONNREFUSED 127.0.0.1:27017`** — MongoDB is not running. Start it (see prerequisites).
- **`SESSION_SECRET must be at least 32 chars`** — edit `server/.env`.
- **Login works but every request is `401`/`403`** — the web app must be opened on an origin listed in `ALLOWED_ORIGINS`, and API calls must go through the same origin (the Vite proxy does this in dev).
- **Live collaboration shows "reconnecting"** — the WebSocket at `/api/v1/collab/...` is not being proxied. In dev the Vite proxy has `ws: true`; behind your own proxy see [DEPLOYMENT.md](DEPLOYMENT.md).
- **Wiping local data** — drop the database: `mongosh excalidraw_workspace --eval "db.dropDatabase()"` and delete `server/storage/`.
