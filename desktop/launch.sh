#!/usr/bin/env bash
# Open the Excalidraw desktop app.
#
# PACKAGED when a bundle is present (desktop/app), which needs no dev server and
# nothing off this machine. Otherwise the DEV shell, which expects the dev server.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$DIR/app/index.html" ]; then
  exec "$DIR/node_modules/.bin/electron" "$DIR"
fi

exec "$DIR/start.sh"
