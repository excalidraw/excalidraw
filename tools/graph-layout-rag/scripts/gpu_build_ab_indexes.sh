#!/usr/bin/env bash
# Build the A/B experimental index matrix on the Ubuntu GPU box.
# Requires: gpu_remote_bootstrap.sh, LanceDB rsync'd, GRAPH_RAG_QDRANT_URL set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$(dirname "$0")/gpu_env.sh"

export GRAPH_RAG_QDRANT_URL="${GRAPH_RAG_QDRANT_URL:-http://127.0.0.1:6333}"
export GRAPH_RAG_ENCODE_DEVICE="${GRAPH_RAG_ENCODE_DEVICE:-cuda}"
# Qdrant/RocksDB needs more than default 1024 fds during large upserts.
ulimit -n 65536 2>/dev/null || ulimit -n 4096 2>/dev/null || true
PROFILE="${GRAPH_RAG_BASE_PROFILE:-gemini-2-structure-v1}"

RUN="uv run graph-layout-rag eval build-retrieval-index \
  --base-profile ${PROFILE} --encode-device cuda"

echo "QDRANT=${GRAPH_RAG_QDRANT_URL} PROFILE=${PROFILE}"

build() {
  local kind="$1" model="$2" batch="$3"
  echo ""
  echo ">>> ${kind} ${model} (batch=${batch})"
  ${RUN} --kind "${kind}" --model "${model}" --batch-size "${batch}"
}

# baseline (skip if GRAPH_RAG_GPU_SKIP_SPLADE_BASELINE=1)
if [[ "${GRAPH_RAG_GPU_SKIP_SPLADE_BASELINE:-0}" != "1" ]]; then
  build splade "prithivida/Splade_PP_en_v1" 16
fi
build colbert "answerdotai/answerai-colbert-small-v1" 8

# colbert upgrades (fastembed)
build colbert "colbert-ir/colbertv2.0" 8
build colbert "jinaai/jina-colbert-v2" 4

# splade-v3 (pytorch sparse)
build splade "naver/splade-v3" 16
build splade "naver/splade-v3-distilbert" 16

echo ""
echo "All indexes built. Sync back to Mac: scripts/gpu_sync_from_remote.sh"
