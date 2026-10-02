# Deployment

Two processes plus MongoDB:

```
browser ──HTTPS──▶ reverse proxy (nginx) ──▶ static web app
                                          └─▶ API server :3100  (REST · WebSocket · public API · MCP) ──▶ MongoDB
                                                                                                     └─▶ object storage (fs | S3)
```

The web app is a static bundle. The API is a single self-contained file (`server/dist/server.mjs`, bundled with esbuild) — no `node_modules` at runtime.

## Option A — Docker Compose

> Not run in the environment this repo was developed in (no Docker there). The compose file, Dockerfiles and nginx config are validated for syntax; the **server bundle they run was booted and exercised for real** (HTTP, auth, scenes, WebSocket, MCP) and the nginx CSP was verified in a browser. Treat the first `up --build` on your machine as the integration test.

```bash
cp .env.workspace.example .env.workspace     # set SESSION_SECRET and PUBLIC_ORIGIN
docker compose -f docker-compose.workspace.yml --env-file .env.workspace up -d --build
open http://localhost:8080
```

| Service | Role |
| --- | --- |
| `mongo` | MongoDB 7 with a health check; published on `127.0.0.1:27017` only, so **Compass** connects to `mongodb://127.0.0.1:27017`. |
| `server` | The bundled API. `NODE_ENV=production`, so it refuses placeholder secrets / insecure cookies. Images live in the `workspace-storage` volume (or S3). |
| `web` | nginx: static app, CSP/security headers, WebSocket-aware proxy for `/api`, `/public`, `/mcp`. |

Put TLS in front of `web` (a load balancer, Caddy, Traefik, or a `listen 443 ssl` block in `deploy/nginx.conf`). Cookies are `Secure` in production, so HTTPS is required for sign-in unless you deliberately opt out with `ALLOW_INSECURE_COOKIES=true` on a trusted LAN.

## Option B — Without Docker

```bash
yarn install
yarn --cwd server build                      # -> server/dist/server.mjs
yarn --cwd workspace-app build               # -> workspace-app/build   (serve as static files)

# API (systemd unit, pm2, …)
NODE_ENV=production \
HOST=127.0.0.1 PORT=3100 \
MONGODB_URI=mongodb://127.0.0.1:27017 \
SESSION_SECRET=… ALLOWED_ORIGINS=https://draw.example.com \
TRUST_PROXY=1 STORAGE_PATH=/var/lib/excalidraw-workspace \
node server/dist/server.mjs
```

Serve `workspace-app/build` from nginx/Caddy with a SPA fallback to `index.html`, and proxy `/api/` (with `Upgrade`/`Connection` headers for WebSockets and buffering off for AI streaming), `/public/`, `/mcp` and `/health` to the API. `deploy/nginx.conf` is a complete reference.

## Configuration that matters in production

| Setting | Why |
| --- | --- |
| `SESSION_SECRET`, `ENCRYPTION_KEY` | Long random values; **back them up**. Losing `SESSION_SECRET` breaks share links and signs everyone out; losing `ENCRYPTION_KEY` makes stored AI keys unreadable. |
| `ALLOWED_ORIGINS` | Exactly the origin(s) users open. Anything else is refused for cookie-authenticated calls. |
| `TRUST_PROXY` | Number of proxies in front (`1` behind nginx). Without it every client looks like the proxy's IP and rate limits collapse. |
| `MONGODB_URI` | Use a dedicated user, auth and TLS for anything but localhost. |
| `STORAGE_PROVIDER=s3` + `S3_*` | Recommended for multiple API instances or containers you recreate. Works with AWS S3, MinIO, R2, Ceph. |
| `API_RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_MAX` | Tune to your traffic. |
| `ENABLE_*` | Switch features off entirely (their routes are not registered). |

## Scaling notes

- **The realtime hub is in-memory per API process.** Run one API instance, or route all connections for a scene to the same instance (sticky by scene id). Everything else (REST, MongoDB writes) is stateless; scene saves are optimistic-concurrency safe across instances.
- MongoDB indexes cover the dashboard, sharing and audit queries (see [DATABASE.md](DATABASE.md)); dashboards page results and never load drawing data.
- Large scenes are capped (10 MB) and images are stored outside the database.

## Operations

- **Health**: `GET /health` → `{ "ok": true }` (used by the container health checks).
- **Logs**: structured JSON on stdout. Credentials are redacted, share tokens scrubbed from URLs, request bodies and scene content are never logged. Browsers report save/socket/export/AI failures to `POST /api/v1/telemetry` (class + short message only) so they appear in the same log (`client-reported failure`).
- **Backups**: `mongodump` **and** the storage location (volume or bucket), together.
- **Trash**: purged after `TRASH_RETENTION_DAYS` (30) by an hourly sweep, including the scenes' images.
- **Upgrades**: schema/index changes are additive and applied at startup.
- **MCP for desktop clients**: `server/bin/mcp-stdio.mjs` (see [API.md](API.md#mcp)); ship it wherever the client runs.
