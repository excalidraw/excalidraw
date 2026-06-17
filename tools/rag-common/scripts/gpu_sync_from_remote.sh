#!/usr/bin/env bash
# Pull dense re-embed index + eval runs from Ubuntu GPU box to Mac.
set -euo pipefail

RAG_COMMON_SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$(cd "${RAG_COMMON_SCRIPTS}/../../.." && pwd)"

RAG_GPU_TOOL="${RAG_GPU_TOOL:-tools/graph-layout-rag}"
TOOL_ROOT="${MONOREPO_ROOT}/${RAG_GPU_TOOL}"
cd "${TOOL_ROOT}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SSH_HOST="${RAG_GPU_SSH:-${GRAPH_RAG_GPU_SSH:-desktop}}"
REMOTE_ROOT="${RAG_GPU_REMOTE_ROOT:-${GRAPH_RAG_GPU_REMOTE_ROOT:-excalidraw-tf}}"
REMOTE="${SSH_HOST}:~/${REMOTE_ROOT}"
TARGET_PROFILE="${RAG_GPU_TARGET_PROFILE:-${GRAPH_RAG_TARGET_PROFILE:-cuda-qwen0.6b-1024}}"
TOOL_REMOTE_NAME="$(basename "${RAG_GPU_TOOL}")"

mkdir -p "data/indexes/${TARGET_PROFILE}" data/eval/runs 2>/dev/null || mkdir -p "data/indexes/${TARGET_PROFILE}"

echo "Syncing from ${REMOTE} (tool=${TOOL_REMOTE_NAME}, target=${TARGET_PROFILE})"

rsync -avz --progress \
  "${REMOTE}/tools/${TOOL_REMOTE_NAME}/data/indexes/${TARGET_PROFILE}/" \
  "data/indexes/${TARGET_PROFILE}/"

rsync -avz --progress \
  "${REMOTE}/tools/${TOOL_REMOTE_NAME}/data/eval/runs/" \
  data/eval/runs/ 2>/dev/null || true

rsync -avz --progress \
  "${REMOTE}/tools/${TOOL_REMOTE_NAME}/data/eval/retrieval_indexes/" \
  data/eval/retrieval_indexes/ 2>/dev/null || true

echo "Done."
