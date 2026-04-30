#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Resetting working tree to demo-baseline…"
git reset --hard demo-baseline
git clean -fd -- packages/ excalidraw-app/ .claude/ >/dev/null

echo "→ Removing demo GIFs from Desktop…"
rm -f ~/Desktop/excalidraw-*.gif ~/Downloads/excalidraw-*.gif 2>/dev/null || true

echo
echo "✓ Repo reset to demo-baseline."
echo
echo "  Manual steps before next dry run:"
echo "  1. In the Excalidraw tab (localhost:3001): Cmd+A → Backspace, then press 1"
echo "     (clears canvas and returns to selection tool)"
echo "  2. If localStorage is stale, hard-reload the tab (Cmd+Shift+R)"
echo "  3. Confirm Chrome MCP extension is connected"
echo "  4. Dev server should hot-reload automatically; if not: kill and 'yarn start'"
