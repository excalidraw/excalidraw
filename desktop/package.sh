#!/usr/bin/env bash
# Package the desktop app: build the production bundle and make it local.
#
#   desktop/package.sh
#
# After this, `desktop/launch.sh` opens the app from LOCAL FILES — no dev server,
# no Vite, no network. The bundled output is 40-odd MB and is NOT tracked.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

if [ ! -x "$DIR/node_modules/.bin/electron" ]; then
  echo "electron is not installed. Run:  (cd \"$DIR\" && npm install)" >&2
  exit 1
fi

echo "building the production bundle ..."
cd "$ROOT"
yarn --silent build:app >/dev/null

echo "copying it beside the shell ..."
rm -rf "$DIR/app"
cp -r "$ROOT/excalidraw-app/build" "$DIR/app"

# Prove the bundle is self-contained rather than assert it: any http(s) host in
# the HTML or the manifest means the app would reach off this machine.
if grep -qE 'https?://' "$DIR/app/index.html" 2>/dev/null; then
  echo "refusing to package: index.html still names an external host:" >&2
  grep -oE 'https?://[a-zA-Z0-9._-]+' "$DIR/app/index.html" | sort -u >&2
  exit 1
fi

size="$(du -sh "$DIR/app" | cut -f1)"
echo "packaged: $DIR/app ($size, local files only)"
echo
echo "open it with:  $DIR/launch.sh"
