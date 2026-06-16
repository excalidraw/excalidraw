#!/usr/bin/env bash
# Push LanceDB index + qrels from Mac to the remote Ubuntu GPU box.
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
PROFILE="${GRAPH_RAG_BASE_PROFILE:-gemini-2-structure-v1}"

echo "Syncing to ${REMOTE} (profile=${PROFILE})"

rsync -avz --progress \
  "data/indexes/${PROFILE}/" \
  "${REMOTE}/tools/graph-layout-rag/data/indexes/${PROFILE}/"

rsync -avz --progress \
  data/eval/qrels/ \
  "${REMOTE}/tools/graph-layout-rag/data/eval/qrels/"

echo "Done."
