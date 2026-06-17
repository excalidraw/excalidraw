#!/usr/bin/env bash
# Pull dense re-embed index + eval runs from Ubuntu GPU box to Mac.
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
TARGET_PROFILE="${GRAPH_RAG_TARGET_PROFILE:-cuda-qwen0.6b-1024}"

mkdir -p "data/indexes/${TARGET_PROFILE}" data/eval/runs

echo "Syncing from ${REMOTE} (target=${TARGET_PROFILE})"

rsync -avz --progress \
  "${REMOTE}/tools/graph-layout-rag/data/indexes/${TARGET_PROFILE}/" \
  "data/indexes/${TARGET_PROFILE}/"

rsync -avz --progress \
  "${REMOTE}/tools/graph-layout-rag/data/eval/runs/" \
  data/eval/runs/ 2>/dev/null || true

rsync -avz --progress \
  "${REMOTE}/tools/graph-layout-rag/data/eval/retrieval_indexes/" \
  data/eval/retrieval_indexes/ 2>/dev/null || true

echo "Done."
