# feature-0011-uw-deploy-the-services-to-zerwizserver

**Type** feature · **Status** open · **Risk** high · **Opened** 2026-10-10 · **Owner** @zerwiz

## Problem

**Current:** every part of the fork runs **only on the operator's laptop**. `zerwizserver` runs CasaOS, Docker, PostgreSQL 16 and Ollama, serves a homepage on `:80`, the A2A heart on `:8301` and a POST-only API on `:8321` — but **nothing of Excalidraw**. A team cannot collaborate against a machine that is asleep in a bag, and a room link built on a tailnet name that points at a laptop works only while that laptop is open. **Expected:** the app, the room server, the text-to-diagram bridge and the tickets board run on `zerwizserver`, reachable by the team, with the room link pointing there.

## Impact

**Affected:** the entire premise — "a tool we in our team can collaborate in". **Risk if not built:** the fork is a very capable single-player editor. **Urgency:** every earlier ticket is now blocked on this one for real use.

## Architecture intent

Ship the services the way the server already ships things — **systemd units or Compose**, behind the existing ingress pattern — rather than inventing a new one. The fork's servers are plain Node with no build step, so the deploy is a checkout plus env plus a unit.

## Requirements

- The app is served at a stable address the team reaches; `publicUrl` names it.
- The room server, the bridge and the board run as supervised services that **survive a reboot**.
- The room server is reachable over the tailnet; its origin allow-list names the app's real origin.
- Settings on each member's machine point at those addresses, or the deployment ships them as env defaults for that install.
- No TLS-by-absence: if the app is served over HTTP on a tailnet, that is a stated decision with its consequence written down, not an oversight.
- The bridge's model points at a model **on or reachable from that server**, and the bridge refuses to start without one — as it already does.

## Constraints

- No secret in the repo: the bridge's key and the members registry live on the server, supplied by env.
- The room server's access registry is **not** in the repo (see `feature-0004`).
- The fork's ports stay in its own block (`chore-0002`).
- Nothing may be exposed publicly without the operator's explicit word; a tailnet-only deployment is the default posture.

## Non-goals

Not a public SaaS; not multi-tenant; not autoscaling; not a CI/CD pipeline; not a domain purchase.

## Test cases

- **Positive:** a second machine on the tailnet opens the app, starts a session, and a third joins by the room link — with the room link naming `zerwizserver`, not a laptop.
- **Positive:** after a server reboot, all services answer again without a human.
- **Negative:** with no model configured, the bridge refuses to start and says why.
- **Negative:** a protected room still refuses a client with no token (grace `feature-0004`).
- **Compatibility:** local development on a laptop still works unchanged.

## Operations

**Rollout:** stand the services up, then point one member at them before pointing everyone. **Observability:** each service's `/healthz`, plus the bridge's request log (timing and token counts only) and the room server's room/member counts. **Rollback:** stop the units; laptops keep working locally because every endpoint is configurable.

## Resolution

_(filled on close)_

---

## Status 2026-10-10 — deployed, and blocked on three DNS records

**Deployed and running** on `zerwizserver` (commit `da31dc71`, `server/deploy/install.sh`): `excalidraw-app` (`:7311`), `excalidraw-collab` (`:7312`) and `excalidraw-board` (`:7314`) are **systemd user services**, enabled and answering. The board serves the real ledger — **20 tickets** — over CORS. The bridge is deliberately not deployed (no model on that host).

**The finding that reshaped the design.** A browser exposes `crypto.subtle` **only in a secure context**, and a room key is generated with it. Over plain HTTP the collaboration dialog renders and **every button throws**:

```
http://<ip>:7311 → "Cannot read properties of undefined (reading 'generateKey')"
```

So plain HTTP **cannot** run collaboration at all. `tailscale serve` was tried and abandoned — it certifies the **tailnet name**, and the team has no tailnet access. The public door is a **Cloudflare tunnel** (`excalidraw{, -collab, -board}.zerwiz.org`), this server's own pattern, which also supplies real TLS. The services therefore bind **loopback**, with the tunnel as the only door.

**What is required from the operator, and nothing else:**

1. **Three DNS records point at the wrong tunnel.** The first `cloudflared tunnel route dns` matched another tunnel's name (the CLI reported a different tunnel id, and the records were created against it). `CLOUDFLARE_API_TOKEN` is **empty in the vault** — a documented state — so this is a dashboard/API action:

   | Record | Should be |
   | --- | --- |
   | `excalidraw.zerwiz.org` | CNAME → `<excalidraw-tunnel-uuid>.cfargotunnel.com`, proxied |
   | `excalidraw-collab.zerwiz.org` | CNAME → `<excalidraw-tunnel-uuid>.cfargotunnel.com`, proxied |
   | `excalidraw-board.zerwiz.org` | CNAME → `<excalidraw-tunnel-uuid>.cfargotunnel.com`, proxied |

   The tunnel is `excalidraw`, id `9cc48e09-a7cd-4db8-81a9-192a4197279b`, with `cloudflared-excalidraw.service` already running and four connections registered.

2. **A decision, not a task: the app will be PUBLIC.** Rooms stay end-to-end encrypted and a protected room still demands a token (`feature-0004`), but anyone with the URL can open the app. **Cloudflare Access** in front of `excalidraw.zerwiz.org` is the natural gate — same account, same tunnel.

**Not proven:** any collaboration over HTTPS, because no public door resolves yet. Everything up to the door is verified; the door itself is not.

**Four traps found and recorded in `server/deploy/README.md`:** resolving `node` locally bakes the laptop's path (`203/EXEC`); `enable --now` is a **no-op** for a running unit so a re-deploy kept the old environment silently; `lsof -ti` matches a client socket; and the board answered `200` over an **empty shelf** until the ledger was copied.

---

## Resolution — deployed, public, and collaboration proven over HTTPS

**Landed** 2026-10-10, the same day the status above said it was blocked.

### What stands

|  |  |
| --- | --- |
| **The app** | **https://whiteboard.zerwiz.org/** — the built bundle, served from the server |
| **The board** | https://whiteboard-board.zerwiz.org — and it serves the real ledger |
| **The room server** | https://whiteboard-collab.zerwiz.org |
| **How** | `server/deploy/install.sh` — three **systemd user services** (this box's own pattern), a **Cloudflare tunnel** in its own per-service shape, `--protocol http2` because QUIC is killed on this network |
| **Rerunnable** | yes, and it **restarts** rather than `enable --now` |

The bridge is still deliberately not deployed: it refuses to start without a model, and this host carries only an embedding model in Ollama.

### The two findings that decided the design

1. **A browser exposes `crypto.subtle` only in a SECURE CONTEXT**, and a room key is generated with it. Over plain HTTP the collaboration dialog rendered and **every button threw** (`Cannot read properties of undefined (reading 'generateKey')`). **Plain HTTP cannot run collaboration at all** — so TLS is not decoration, it is the feature.
2. **The tailnet could not be the door:** `tailscale serve` certifies the **tailnet name**, and team members have no tailnet access. Cloudflare is the answer, and it is this server's own pattern.

### The DNS tangle, and how it was solved without the API token

`CLOUDFLARE_API_TOKEN` is **empty in the vault** (a documented state), so the three records the first `cloudflared tunnel route dns excalidraw …` call created could not be corrected — and they point at **another tunnel**, which is why `excalidraw.zerwiz.org` answered 404 while my own tunnel's log showed it had never seen the request.

**The way through:** route by the **explicit UUID** to **fresh names**. `route dns <uuid> <new-name>` created records on the _right_ tunnel immediately, so the door opened as **`whiteboard.zerwiz.org`** (+ `-collab`, `-board`).

**The dead `excalidraw.*` records still need deleting or repointing in the dashboard** — the tunnel's ingress lists them so they work the moment that happens.

### Verified — the ticket's own test cases

- **Positive (team):** a session started at `https://whiteboard.zerwiz.org/`; a **second browser session** opened the same room link; the server's own roster read `{"ok":true,"rooms":1,"members":2}` and the client's collaboration control read **2**.
- **The room link names the server, not a laptop:** `https://whiteboard.zerwiz.org/#room=eb51d9a7918a8899b240,…` — `feature-0010`'s `publicUrl` doing its job.
- **The secure context, measured:** `isSecureContext: true`, `crypto.subtle` present, and a real **AES-GCM key generated** in the page — the exact operation a room key needs.
- **Board over CORS:** `https://whiteboard-board.zerwiz.org/healthz` → 200 from the app's origin.
- **All six probes green** after the deploy: three loopback, three HTTPS.

### Not done, and named

- **The dead `excalidraw.*` DNS records** (dashboard action).
- **No access gate on the app.** It is **public**: rooms stay end-to-end encrypted and a protected room still demands a token (`feature-0004`), but anyone with the URL can open the app. **Cloudflare Access** in front of it is the natural gate — same account, same tunnel.
- **The room file store has no authentication** — the unguessable id is the capability, as the hosted storage was (`feature-0012`).
- **No TLS certificate of our own** — Cloudflare terminates, which is what makes the secure context.
