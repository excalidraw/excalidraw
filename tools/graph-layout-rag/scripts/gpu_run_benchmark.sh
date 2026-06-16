#!/usr/bin/env bash
# Run neutral-qrels benchmark for colbert/splade arms on Ubuntu (or locally).
# Pass index dirs via env or discover latest under data/eval/retrieval_indexes/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$(dirname "$0")/gpu_env.sh"

export GRAPH_RAG_QDRANT_URL="${GRAPH_RAG_QDRANT_URL:-http://127.0.0.1:6333}"
PROFILE="${GRAPH_RAG_BASE_PROFILE:-gemini-2-structure-v1}"
QRELS="${GRAPH_RAG_QRELS:-data/eval/qrels/catalog/qrels.json}"
INDEX_ROOT="data/eval/retrieval_indexes/${PROFILE}"

latest_index() {
  local kind="$1"
  local model_slug="$2"
  find "${INDEX_ROOT}" -maxdepth 1 -type d -name "${kind}-${model_slug}-*" 2>/dev/null \
    | sort \
    | tail -1
}

SPLADE_INDEX="${SPLADE_INDEX:-$(latest_index splade prithivida-Splade_PP_en_v1)}"
COLBERT_INDEX="${COLBERT_INDEX:-$(latest_index colbert jinaai-jina-colbert-v2)}"

if [[ -z "${SPLADE_INDEX}" || -z "${COLBERT_INDEX}" ]]; then
  echo "Could not find index dirs under ${INDEX_ROOT}. Set SPLADE_INDEX / COLBERT_INDEX." >&2
  exit 1
fi

echo "splade=${SPLADE_INDEX}"
echo "colbert=${COLBERT_INDEX}"

uv run graph-layout-rag eval benchmark \
  --embed-profile "${PROFILE}" \
  --qrels "${QRELS}" \
  --strategy colbert --strategy splade --strategy dense_splade \
  --colbert-index "${COLBERT_INDEX}" \
  --splade-index "${SPLADE_INDEX}" \
  --report -v

echo "Compare catalog nDCG@10 to bakeoff baselines: splade/colbert ~0.53, hybrid ~0.765"
