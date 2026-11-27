#!/usr/bin/env bash
set -euo pipefail

SRC="/home/dev/projects/excalidraw/"
DEST="root@192.168.1.87:/opt/excalidraw-ai/"
SSH_KEY="/home/dev/.ssh/id_ed25519_excalidraw_deploy"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o BatchMode=yes"

echo "[1/3] Syncing workspace to CT131 (192.168.1.87)..."
rsync -az --delete   --exclude=".git"   --exclude="node_modules"   --exclude=".env"   --exclude=".env.local"   --exclude="compose.prod.yml"   --exclude="nginx.conf.template"   --exclude="excalidraw-app/build"   --exclude="bin/"   -e "ssh ${SSH_OPTS}"   "${SRC}" "${DEST}"

echo "[2/3] Rebuilding & restarting excalidraw-ai container on CT131..."
ssh ${SSH_OPTS} root@192.168.1.87 "cd /opt/excalidraw-ai && docker compose -f compose.prod.yml up -d --build"

echo "[3/3] Verifying HTTP health on http://192.168.1.87:8085..."
curl -fsSI http://192.168.1.87:8085 | head -n 5
echo "Done! Synced and deployed to CT131."
