#!/usr/bin/env bash
# Run neutral-qrels benchmark for colbert/splade arms on Ubuntu (or locally).
# Pass index dirs via env or discover latest under data/retrieval-indexes/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$(dirname "$0")/gpu_env.sh"

export GRAPH_RAG_QDRANT_URL="${GRAPH_RAG_QDRANT_URL:-http://127.0.0.1:6333}"
PROFILE="${GRAPH_RAG_BASE_PROFILE:-gemini-2-structure-v1}"
QRELS="${GRAPH_RAG_QRELS:-data/eval/qrels/catalog/qrels.json}"
INDEX_ROOT="data/retrieval-indexes/${PROFILE}"

latest_index() {
  local kind="$1"
  local model_slug="$2"
  find "${INDEX_ROOT}" -maxdepth 1 -type d -name "${kind}-${model_slug}-*" 2>/dev/null \
    | sort \
    | tail -1
}

# Pick the newest *successfully built* index per kind (an index without
# index_meta.json is an aborted/OOM build and must be skipped). Defaults target
# the models that actually fit the 8 GB GPU; override SPLADE_MODEL/COLBERT_MODEL
# or SPLADE_INDEX/COLBERT_INDEX to benchmark a specific build.
latest_valid_index() {
  local kind="$1" model_slug="$2"
  find "${INDEX_ROOT}" -maxdepth 1 -type d -name "${kind}-${model_slug}-*" 2>/dev/null \
    | sort \
    | while read -r d; do [[ -f "${d}/index_meta.json" ]] && echo "${d}"; done \
    | tail -1
}

SPLADE_MODEL="${SPLADE_MODEL:-naver-splade-v3-distilbert}"
COLBERT_MODEL="${COLBERT_MODEL:-colbert-ir-colbertv2.0}"
SPLADE_INDEX="${SPLADE_INDEX:-$(latest_valid_index splade "${SPLADE_MODEL}")}"
COLBERT_INDEX="${COLBERT_INDEX:-$(latest_valid_index colbert "${COLBERT_MODEL}")}"

# The CLI takes one --retrieval-index per run (kind inferred from index_meta.json).
# colbert/splade encode locally (no Gemini); hybrid needs Gemini ADC creds, so it
# only runs where credentials exist (the Mac), not necessarily the GPU box.
run_one() {
  local index_dir="$1"; shift
  [[ -z "${index_dir}" ]] && { echo "skip: no valid index for $*" >&2; return 0; }
  echo ">>> benchmark --retrieval-index ${index_dir} (${*})"
  uv run graph-layout-rag eval benchmark \
    --embed-profile "${PROFILE}" --qrels "${QRELS}" \
    --retrieval-index "${index_dir}" --report -v "$@"
}

run_one "${COLBERT_INDEX}" --strategy colbert
run_one "${SPLADE_INDEX}" --strategy splade --strategy dense_splade

echo "Compare catalog nDCG@10 to baselines: colbertv2.0 ~0.55, splade ~0.44, hybrid ~0.765 (hybrid wins)"
