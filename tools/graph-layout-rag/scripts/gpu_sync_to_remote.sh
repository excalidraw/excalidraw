#!/usr/bin/env bash
# Push source index + code to Ubuntu GPU box for dense re-embed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SSH_HOST="${GRAPH_RAG_GPU_SSH:-desktop}"
REMOTE_ROOT="${GRAPH_RAG_GPU_REMOTE_ROOT:-excalidraw-tf}"
REMOTE="${SSH_HOST}:~/${REMOTE_ROOT}"
SOURCE_PROFILE="${GRAPH_RAG_SOURCE_PROFILE:-gemini-2-structure-v1}"
RAG_COMMON="$(cd "${ROOT}/../rag-common" && pwd)"

echo "Syncing dense re-embed payload to ${SSH_HOST} (source=${SOURCE_PROFILE})"

RSYNC_EXCLUDES=(
  --exclude '.venv'
  --exclude '__pycache__'
  --exclude '.pytest_cache'
  --exclude 'data/raw'
  --exclude 'data/bibliography-scan-cache'
  --exclude 'data/*.log'
  --exclude 'data/harvest*.log'
  --exclude 'data/ingest*.log'
  --exclude 'data/*.sqlite'
  --exclude 'data/*.sqlite-*'
  --exclude 'data/harvest.db'
  --exclude 'data/harvest_checkpoint.json'
  --exclude 'data/trusted_venue_checkpoint.json'
)

rsync -avz --progress "${RSYNC_EXCLUDES[@]}" \
  "${ROOT}/" "${REMOTE}/tools/graph-layout-rag/"

rsync -avz --progress \
  --exclude '.venv' --exclude '__pycache__' \
  "${RAG_COMMON}/" "${REMOTE}/tools/rag-common/"

rsync -avz --progress \
  "data/indexes/${SOURCE_PROFILE}/" \
  "${REMOTE}/tools/graph-layout-rag/data/indexes/${SOURCE_PROFILE}/"

echo "Done."
