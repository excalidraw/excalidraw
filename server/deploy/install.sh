#!/usr/bin/env bash
# deploy — put the fork's services on a server, as the server already runs things.
#
#   server/deploy/install.sh <host> [user]
#
# What it does, and why in this shape:
#   · the APP is built here (Vite inlines VITE_APP_* at build time) and the static
#     output is copied — the server needs no yarn and no build step;
#   · the SERVICES are plain Node and copied as source, with `npm install
#     --omit=dev socket.io` run on the server for the room server's one dependency;
#   · each runs as a systemd USER service, which is the pattern the server already
#     uses (whynot-homepage.service, aiassetvault.service);
#   · everything binds the TAILNET address, not 0.0.0.0 — reachable by the team,
#     not by the LAN, and not public.
#
# Re-running is safe: it rebuilds, re-copies and restarts.
set -euo pipefail

HOST="${1:?usage: install.sh <host> [user]}"
USER_NAME="${2:-zerwizserver}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Configuration — one place. Override with env.
#
# Checked explicitly rather than with `${VAR:?}`: a missing value has to stop the
# deploy with a sentence, and a plain check is one line you can read.
TAILNET_IP="${EXCALIDRAW_TAILNET_IP:-}"
TAILNET_NAME="${EXCALIDRAW_TAILNET_NAME:-}"
for pair in "EXCALIDRAW_TAILNET_IP:$TAILNET_IP" "EXCALIDRAW_TAILNET_NAME:$TAILNET_NAME"; do
  if [ -z "${pair#*:}" ]; then
    echo "install.sh: ${pair%%:*} is required (the host's tailnet address / name)" >&2
    exit 2
  fi
done
# What the BAKED-IN urls use. The tailnet IP by default, not the name: a browser
# with Secure DNS (DoH) resolves a MagicDNS name publicly, does not reach the
# tailnet, and reports ERR_CONNECTION_REFUSED while `curl` on the same machine
# works — the same name, two different answers. An IP needs no resolver.
# HTTPS on the tailnet NAME, because that is where `tailscale serve` can hold a
# real certificate. A browser exposes `crypto.subtle` only in a SECURE CONTEXT,
# and a room key is generated with it — so plain HTTP on an IP cannot run
# collaboration at all. Measured: `Cannot read properties of undefined (reading
# 'generateKey')`.
PUBLIC_HOST="${EXCALIDRAW_PUBLIC_HOST:-$TAILNET_NAME}"
PUBLIC_SCHEME="https"

# EACH SERVICE MAY LIVE AT ITS OWN ADDRESS. A Cloudflare tunnel gives one
# hostname per service on 443 — three paths will not do, because cloudflared does
# not rewrite a path and socket.io needs a root path. `tailscale serve`, by
# contrast, allows HTTPS on only 443/8443/10000, so the same host carries ports.
# Both shapes are one line each here rather than a rewrite.
APP_URL="${EXCALIDRAW_APP_URL:-$PUBLIC_SCHEME://$PUBLIC_HOST}"
TICKETS_URL="${EXCALIDRAW_TICKETS_URL:-$PUBLIC_SCHEME://$PUBLIC_HOST:${EXCALIDRAW_HTTPS_BOARD_PORT:-8443}}"
COLLAB_URL="${EXCALIDRAW_COLLAB_URL:-$PUBLIC_SCHEME://$PUBLIC_HOST:${EXCALIDRAW_HTTPS_COLLAB_PORT:-10000}}"
AI_URL="${EXCALIDRAW_AI_URL:-}"

# THE BRIDGE IS DEPLOYED ONLY WHEN THERE IS A MODEL BEHIND IT — it refuses to
# start without one, and an app pointed at a bridge that is not there is worse
# than an app that says it has no model.
MODEL_URL="${EXCALIDRAW_MODEL_URL:-}"
MODEL_ID="${EXCALIDRAW_MODEL:-}"
APP_PORT="${EXCALIDRAW_APP_PORT:-7311}"
COLLAB_PORT="${EXCALIDRAW_COLLAB_PORT:-7312}"
BRIDGE_PORT="${EXCALIDRAW_BRIDGE_PORT:-7313}"
BOARD_PORT="${EXCALIDRAW_BOARD_PORT:-7314}"
REMOTE_DIR="${EXCALIDRAW_REMOTE_DIR:-/home/$USER_NAME/excalidraw}"
SSH="ssh -o BatchMode=yes -l $USER_NAME $HOST"

say() { printf '  %s\n' "$*"; }

echo "deploying the fork to $USER_NAME@$HOST:$REMOTE_DIR (tailnet-only)"

# ── 1. Build the app here ────────────────────────────────────────────────────
say "building the app with this host's addresses baked in"
cd "$ROOT"
VITE_APP_PUBLIC_URL="$APP_URL/" \
VITE_APP_COLLAB_SERVER="$COLLAB_URL" \
VITE_APP_AI_BACKEND="$AI_URL" \
VITE_APP_TICKETS_API="$TICKETS_URL" \
yarn --silent build:app >/dev/null
say "built: $(du -sh excalidraw-app/build | cut -f1)"

# ── 2. Make room on the server ───────────────────────────────────────────────
$SSH "mkdir -p '$REMOTE_DIR'/{app,server,bin,state} '$REMOTE_DIR/units'"

# ── 3. The static app ────────────────────────────────────────────────────────
say "copying the app"
rsync -az --delete -e "ssh -o BatchMode=yes -l $USER_NAME" \
  "$ROOT/excalidraw-app/build/" "$HOST:$REMOTE_DIR/app/"

# ── 4. The services (plain Node, no build) ───────────────────────────────────
say "copying the room server, the board and the bridge"
for svc in collab tickets ttd-bridge; do
  rsync -az --delete -e "ssh -o BatchMode=yes -l $USER_NAME" \
    --exclude node_modules --exclude '*.test.mjs' \
    "$ROOT/server/$svc/" "$HOST:$REMOTE_DIR/server/$svc/"
done

# The tickets the board reads. Without these the board answers happily and
# reports zero — a green health check over an empty shelf.
say "copying the ticket ledger"
rsync -az --delete -e "ssh -o BatchMode=yes -l $USER_NAME" \
  "$ROOT/tickets/" "$HOST:$REMOTE_DIR/tickets/"

# ── 5. The static server, written on the server so it is small and explicit ──
$SSH "cat > '$REMOTE_DIR/bin/static-server.mjs'" <<'NODE'
#!/usr/bin/env node
/**
 * A small static server for the built app. Serves files, falls back to
 * index.html for an unknown path (a single-page app), and refuses to escape the
 * root. No dependency: this is a deployment detail, not a product feature.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(process.env.APP_ROOT ?? ".");
const PORT = Number(process.env.APP_PORT ?? 7311);
const HOST = process.env.APP_HOST ?? "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // A single-page app: an unknown path is the app, not a 404.
    file = join(ROOT, "index.html");
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": file.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`app on http://${HOST}:${PORT} serving ${ROOT}`);
});
NODE

say "installing the room server's one dependency (socket.io)"
$SSH "cd '$REMOTE_DIR/server/collab' && npm install --omit=dev --silent socket.io >/dev/null 2>&1 && node -e \"require.resolve('socket.io')\" && echo 'socket.io ok'"

# ── 6. systemd user units — the server's own pattern ─────────────────────────
# Resolve node ON THE SERVER. Resolving it here bakes in this laptop's path and
# systemd answers `203/EXEC` — which names nothing useful unless you read the journal.
REMOTE_NODE="$($SSH 'command -v node')"
[ -n "$REMOTE_NODE" ] || { echo "no node on $HOST" >&2; exit 3; }
say "writing systemd user units (node: $REMOTE_NODE)"

write_unit() {  # <name> <description> <exec> <env lines>
  local name=$1 description=$2 exec=$3 env=$4
  $SSH "cat > '$REMOTE_DIR/units/$name.service'" <<UNIT
[Unit]
Description=$description
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
ExecStart=$exec
Restart=always
RestartSec=3
Environment=NODE_ENV=production
$env

[Install]
WantedBy=default.target
UNIT
}

write_unit excalidraw-app "Excalidraw app (built, static) :$APP_PORT" \
  "$REMOTE_NODE $REMOTE_DIR/bin/static-server.mjs" \
  "Environment=APP_ROOT=$REMOTE_DIR/app
Environment=APP_PORT=$APP_PORT
Environment=APP_HOST=127.0.0.1"

write_unit excalidraw-collab "Excalidraw room server (encrypted relay only) :$COLLAB_PORT" \
  "$REMOTE_NODE $REMOTE_DIR/server/collab/index.mjs" \
  "Environment=COLLAB_PORT=$COLLAB_PORT
Environment=COLLAB_HOST=127.0.0.1
Environment=COLLAB_ORIGINS=$APP_URL
Environment=COLLAB_APP_URL=$APP_URL
Environment=COLLAB_MEMBERS=$REMOTE_DIR/state/members.json
Environment=COLLAB_ACCESS_LOG=$REMOTE_DIR/state/access.log"

if [ -n "$MODEL_URL" ]; then
  write_unit excalidraw-bridge "Excalidraw text-to-diagram bridge :$BRIDGE_PORT" \
    "$REMOTE_NODE $REMOTE_DIR/server/ttd-bridge/index.mjs" \
    "Environment=TTD_MODEL_BASE_URL=$MODEL_URL
Environment=TTD_MODEL=$MODEL_ID
Environment=TTD_BRIDGE_PORT=$BRIDGE_PORT
Environment=TTD_BRIDGE_HOST=127.0.0.1
Environment=TTD_BRIDGE_ORIGINS=$APP_URL"
  say "the bridge will be deployed against $MODEL_URL ($MODEL_ID)"
else
  say "NO bridge: set EXCALIDRAW_MODEL_URL (and EXCALIDRAW_MODEL) to deploy one"
fi

write_unit excalidraw-board "Excalidraw tickets board (read-only) :$BOARD_PORT" \
  "$REMOTE_NODE $REMOTE_DIR/server/tickets/index.mjs" \
  "Environment=TICKETS_PORT=$BOARD_PORT
Environment=TICKETS_HOST=127.0.0.1
Environment=TICKETS_REPO_ROOT=$REMOTE_DIR
Environment=TICKETS_ORIGINS=$APP_URL
Environment=TICKETS_APP_URL=$APP_URL"

# ── 7. Enable and start ──────────────────────────────────────────────────────
#
# The unit list is built HERE, in the caller's shell, and then interpolated into
# the remote command. A variable assigned inside a double-quoted remote string is
# the caller's shell expanding it, not the server's — which produced
# "UNITS: unbound variable" and a half-run deploy.
UNITS="excalidraw-app excalidraw-collab excalidraw-board"
if [ -n "$MODEL_URL" ]; then
  UNITS="$UNITS excalidraw-bridge"
fi
say "enabling and starting: $UNITS"

# NOTE: no backticks in the string below. It is double-quoted, so the LOCAL shell
# would run them and the command would arrive mangled — which is what happened.
$SSH "mkdir -p ~/.config/systemd/user && cp '$REMOTE_DIR/units/'*.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable $UNITS 2>&1 | tail -3
# RESTART, not enable --now: for a unit already running --now does nothing and the
# service keeps the OLD environment, so a re-deploy would silently change nothing
# while reporting success.
systemctl --user restart $UNITS; systemctl --user --no-pager --lines=0 status $UNITS 2>&1 | grep -E 'Active|●' | head"

# ── 8. The TLS terminator — a CHOICE, and the one that makes the app a SECURE CONTEXT ─
#
# Cloudflare is the default because it is the door the TEAM can reach: the tailnet
# certifies the tailnet NAME, and team members have no tailnet access. Set
# EXCALIDRAW_TLS=tailscale to add the tailnet door as well — useful for the
# operator, and it must not replace the public one.
case "${EXCALIDRAW_TLS:-cloudflare}" in
  tailscale)
    say "also serving over HTTPS on the tailnet (tailscale serve)"
    $SSH "tailscale serve --bg --https=443 http://127.0.0.1:$APP_PORT >/dev/null 2>&1 || true
tailscale serve --bg --https=8443 http://127.0.0.1:$BOARD_PORT >/dev/null 2>&1 || true
tailscale serve --bg --https=10000 http://127.0.0.1:$COLLAB_PORT >/dev/null 2>&1 || true
tailscale serve status 2>&1 | head -8" ;;
  *)
    say "TLS is the Cloudflare tunnel's job (see the tunnel step in README.md)" ;;
esac

# ── 9. Prove it answers ──────────────────────────────────────────────────────
say "checking"
# Loopback proves the SERVICES; the HTTPS door proves the CERTIFICATE.
[ -n "$MODEL_URL" ] && $SSH "printf '    local  %-30s ' 127.0.0.1:$BRIDGE_PORT/healthz; curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 http://127.0.0.1:$BRIDGE_PORT/healthz"
for probe in "127.0.0.1:$APP_PORT/" "127.0.0.1:$COLLAB_PORT/healthz" "127.0.0.1:$BOARD_PORT/healthz"; do
  printf '    local  %-30s ' "$probe"
  $SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://$probe" 2>/dev/null || printf 'no-answer'
  echo
done
for probe in "${APP_URL#https://}/" "${TICKETS_URL#https://}/healthz" "${COLLAB_URL#https://}/healthz"; do
  printf '    https  %-30s ' "$probe"
  $SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://$probe" 2>/dev/null || printf 'no-answer'
  echo
done

echo
echo "done. The app is at $APP_URL/"
echo "      board $TICKETS_URL  ·  collab $COLLAB_URL"
echo "      HTTPS is not decoration: collaboration needs crypto.subtle, which a"
echo "      browser only exposes in a secure context."
# The AI backend is deliberately EMPTY unless the operator supplies one: the app
# must say "no model configured" rather than claim one, and the bridge is not
# deployed here (it refuses to start without a model).
echo "The bridge is NOT deployed: it refuses to start without a model, and this host"
echo "has only an embedding model in Ollama. Point it at one, then add a unit — or set"
echo "EXCALIDRAW_AI_URL when the bridge runs somewhere the app can reach."
