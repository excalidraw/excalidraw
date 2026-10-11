# Deploy — putting the fork's services on a server

```bash
EXCALIDRAW_TAILNET_IP=<the host's tailnet address> \
EXCALIDRAW_TAILNET_NAME=<the host's tailnet name> \
  server/deploy/install.sh <host> [user]
```

Builds the app here (Vite inlines `VITE_APP_*` at build time), copies it and the plain-Node services, writes **systemd user units** — the pattern this server already uses — and proves each answers. Re-running is safe.

---

## What it lays down

| Piece                      | Where                            | Door    |
| -------------------------- | -------------------------------- | ------- |
| the app (built, static)    | `<remote>/app`                   | `:7311` |
| room server                | `<remote>/server/collab`         | `:7312` |
| ticket board               | `<remote>/server/tickets`        | `:7314` |
| the ledger the board reads | `<remote>/tickets`               | —       |
| a small static server      | `<remote>/bin/static-server.mjs` | —       |

Units: `excalidraw-app`, `excalidraw-collab`, `excalidraw-board` (user scope, `Restart=always`).

The **bridge is deliberately not deployed**: it refuses to start without a model, and this host carries only an embedding model in Ollama. Point `TTD_MODEL_BASE_URL` at one and add a unit.

## Why HTTPS is not optional

A browser exposes **`crypto.subtle` only in a secure context** — HTTPS, or `localhost`. A room key is generated with it, so:

```
http://<ip>:7311          →  crypto.subtle undefined
                             "Cannot read properties of undefined (reading 'generateKey')"
                             the collaboration dialog renders, and every button throws
```

That is not a decoration problem; **plain HTTP cannot run collaboration at all**. Measured on this deployment. So the services bind **loopback**, and a TLS terminator is the only door in.

## The public door — Cloudflare tunnel

`tailscale serve` was tried first and abandoned: it gives a certificate only on the **tailnet name**, and team members do not have tailnet access. Cloudflare is the right answer, it is the pattern this server already uses, and it gives real TLS.

```bash
cloudflared tunnel create excalidraw
UUID=$(cloudflared tunnel list | awk '/ excalidraw /{print $1}')
for h in excalidraw.zerwiz.org excalidraw-collab.zerwiz.org excalidraw-board.zerwiz.org; do
  cloudflared tunnel route dns "$UUID" "$h"
done
```

`~/.cloudflared/config-excalidraw.yml` — **three hostnames, not three paths**: cloudflared does not rewrite a path, so a path-routed service would receive a prefix it does not serve, and socket.io needs a root path anyway.

```yaml
protocol: http2
tunnel: <uuid>
credentials-file: $HOME/.cloudflared/<uuid>.json
ingress:
  - hostname: excalidraw.zerwiz.org
    service: http://127.0.0.1:7311
  - hostname: excalidraw-collab.zerwiz.org
    service: http://127.0.0.1:7312
  - hostname: excalidraw-board.zerwiz.org
    service: http://127.0.0.1:7314
  - service: http_status:404
```

Then `cloudflared-excalidraw.service`, copied from `cloudflared-aiassetvault.service` — including `--protocol http2`, because **QUIC is killed on this network** and every tunnel here survives on http2.

**The app is built with the public HTTPS addresses** (`$PUBLIC_SCHEME://$PUBLIC_HOST`), which defaults to the tailnet name; set `EXCALIDRAW_PUBLIC_HOST` to the public hostname when the tunnel is the door.

## Traps this cost real time on

- **Resolve `node` ON THE SERVER.** Resolving it locally bakes this laptop's mise path into the unit, and systemd answers `203/EXEC` — a number that names nothing.
- **`systemctl enable --now` is a no-op for a running unit.** A re-deploy silently kept the old environment while reporting success. Use `restart`.
- **`lsof -ti :PORT` matches a CLIENT socket too** — a stop that probes the port then reaps it will find itself. `-sTCP:LISTEN`.
- **A browser with Secure DNS resolves a MagicDNS name publicly** and never reaches the tailnet, reporting `ERR_CONNECTION_REFUSED` while `curl` on the same machine works. An IP needs no resolver; a public name needs real DNS.
- **`cloudflared tunnel route dns <name>` can route to the wrong tunnel** when the name fuzzy-matches an existing one. Route by **UUID** and check the CNAME's target, not the exit code.
- **A health check over an empty shelf is green.** The board answered `200` while reporting zero tickets, because the ledger had not been copied.
- **`dig` on this laptop resolves nothing under the zone** — test with `curl`, not with DNS tools.

## Still owed

The three DNS records created during the first attempt point at the **wrong tunnel** (the CLI matched another one). Correcting them needs the Cloudflare API or the dashboard — `CLOUDFLARE_API_TOKEN` is **empty in the vault**, which is a documented state, so this is a one-minute operator action:

| Record                         | Should be                                  |
| ------------------------------ | ------------------------------------------ |
| `excalidraw.zerwiz.org`        | CNAME → `<uuid>.cfargotunnel.com`, proxied |
| `excalidraw-collab.zerwiz.org` | CNAME → `<uuid>.cfargotunnel.com`, proxied |
| `excalidraw-board.zerwiz.org`  | CNAME → `<uuid>.cfargotunnel.com`, proxied |

**And a decision**: the app will be **public**. Rooms stay end-to-end encrypted and a protected room still demands a token, but the app itself is open to anyone with the URL. Cloudflare Access in front of `excalidraw.zerwiz.org` is the natural gate — it is the same account and the same tunnel.
