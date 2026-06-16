#!/usr/bin/env bash
# Pull experimental indexes + eval runs from Ubuntu GPU box to Mac.
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

mkdir -p data/eval/retrieval_indexes data/eval/runs

echo "Syncing from ${REMOTE}"

rsync -avz --progress \
  "${REMOTE}/tools/graph-layout-rag/data/eval/retrieval_indexes/" \
  data/eval/retrieval_indexes/

rsync -avz --progress \
  "${REMOTE}/tools/graph-layout-rag/data/eval/runs/" \
  data/eval/runs/

echo "Done."
