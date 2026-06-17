#!/usr/bin/env bash
# Local LLM transform benchmark on the Ubuntu RTX 3060 Ti box.
# Ollama serves HyDE/multi-query on localhost; cuda-qwen0.6b-1024 handles dense embed.
#
# Run ON the GPU host (after sync), or from Mac via:
#   ./scripts/gpu_execute_local_llm_benchmark.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$(dirname "$0")/gpu_env.sh"

# Preserve explicit embed profile from caller (tmux / execute script) over .env defaults.
_SAVED_EMBED_PROFILE="${RAG_EMBED_PROFILE:-}"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -n "${_SAVED_EMBED_PROFILE}" ]]; then
  export RAG_EMBED_PROFILE="${_SAVED_EMBED_PROFILE}"
fi

PROFILE="${RAG_EMBED_PROFILE:-cuda-qwen0.6b-1024}"
export RAG_EMBED_PROFILE="${PROFILE}"
export RAG_LOCAL_EMBED_DEVICE="${RAG_LOCAL_EMBED_DEVICE:-cuda}"
export GRAPH_RAG_ENCODE_DEVICE="${GRAPH_RAG_ENCODE_DEVICE:-cuda}"
export RAG_CUDA_BATCH_SIZE="${RAG_CUDA_BATCH_SIZE:-8}"

# Ollama on the GPU box (not the Mac). Benchmark workers call localhost:11434.
export RAG_OLLAMA_HOST="${RAG_OLLAMA_HOST:-http://127.0.0.1:11434}"
export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-1}"
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-2m}"

LOG="${ROOT}/data/eval/local_llm_benchmark.log"
mkdir -p data/eval/runs

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "${LOG}"; }

check_ollama() {
  if curl -sf "${RAG_OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
    log "Ollama OK at ${RAG_OLLAMA_HOST}"
    return 0
  fi
  log "ERROR: Ollama not reachable at ${RAG_OLLAMA_HOST}"
  log "One-time on desktop (requires sudo): curl -fsSL https://ollama.com/install.sh | sh"
  log "Then: sudo systemctl enable --now ollama   # or: ollama serve"
  exit 1
}

check_index() {
  local idx="data/indexes/${PROFILE}"
  if [[ ! -d "${idx}/lancedb" ]]; then
    log "ERROR: missing index at ${idx}/lancedb — run GPU reembed first."
    exit 1
  fi
  log "Index OK: ${idx}"
}

check_gold() {
  log "Validating gold set..."
  if ! uv run graph-layout-rag eval validate-gold --json 2>&1 | tee -a "${LOG}"; then
    log "ERROR: gold validation failed — fix missing doc refs before benchmarking"
    exit 1
  fi
  log "Gold validation OK"
}

slugify() {
  echo "$1" | tr ':/.' '____' | tr '[:upper:]' '[:lower:]'
}

run_benchmark_track() {
  local arm="$1"
  local track="$2"
  local qrels="data/eval/qrels/${track}/qrels.json"
  if [[ ! -f "${qrels}" ]]; then
    log "skip ${arm}/${track}: missing ${qrels}"
    return 0
  fi

  local ts
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  local run_dir="data/eval/runs/${ts}-local-llm-${arm}-${track}"
  log ">>> benchmark ${arm} track=${track} -> ${run_dir}"

  uv run graph-layout-rag eval benchmark \
    --embed-profile "${PROFILE}" \
    --track "${track}" \
    --qrels "${qrels}" \
    --strategy hybrid \
    --strategy hyde \
    --strategy hybrid_auto_hyde \
    --strategy multi_query \
    --llm-transforms \
    --top 20 \
    --run-dir "${run_dir}" \
    --min-available-gb 2.0 \
    --max-process-rss-gb 12.0 \
    --report -v 2>&1 | tee -a "${LOG}"

  log ">>> diagnostics ${arm}/${track}"
  uv run graph-layout-rag eval diagnostics \
    --track "${track}" \
    --embed-profile "${PROFILE}" \
    --qrels "${qrels}" \
    --strategy hybrid \
    --strategy hyde \
    --strategy hybrid_auto_hyde \
    --strategy multi_query \
    -o "${run_dir}/diagnostics.json" 2>&1 | tee -a "${LOG}" || true
}

run_ollama_arm() {
  local model="$1"
  local arm
  arm="$(slugify "${model}")"
  export RAG_LLM_BACKEND=ollama
  export RAG_OLLAMA_MODEL="${model}"

  log "=== Pull Ollama model: ${model} ==="
  ollama pull "${model}" 2>&1 | tee -a "${LOG}" || {
    log "WARN: ollama pull failed for ${model}; skipping arm"
    return 0
  }

  for track in catalog pdf-deep-read; do
    run_benchmark_track "${arm}" "${track}"
  done

  log "=== Unload ${model} (free VRAM for next arm) ==="
  ollama stop "${model}" 2>/dev/null || true
}

run_baseline() {
  export RAG_LLM_BACKEND=gemini
  local ts
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  for track in catalog pdf-deep-read; do
    local qrels="data/eval/qrels/${track}/qrels.json"
    [[ -f "${qrels}" ]] || continue
    local run_dir="data/eval/runs/${ts}-baseline-hybrid-${track}"
    log ">>> baseline hybrid (no LLM) track=${track}"
    uv run graph-layout-rag eval benchmark \
      --embed-profile "${PROFILE}" \
      --track "${track}" \
      --qrels "${qrels}" \
      --strategy hybrid \
      --top 20 \
      --run-dir "${run_dir}" \
      --min-available-gb 2.0 \
      --report -v 2>&1 | tee -a "${LOG}"
  done
}

run_cloud_hyde() {
  if [[ "${RUN_CLOUD_CONTROL:-0}" != "1" ]]; then
    log "skip cloud HyDE control (set RUN_CLOUD_CONTROL=1 to enable)"
    return 0
  fi
  export RAG_LLM_BACKEND=gemini
  export GRAPH_RAG_EVAL_LLM_MODEL="${GRAPH_RAG_EVAL_LLM_MODEL:-gemini-2.5-flash}"
  for track in catalog pdf-deep-read; do
    local qrels="data/eval/qrels/${track}/qrels.json"
    [[ -f "${qrels}" ]] || continue
    local ts
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    local run_dir="data/eval/runs/${ts}-hyde-cloud-gemini-${track}"
    log ">>> cloud HyDE control track=${track}"
    uv run graph-layout-rag eval benchmark \
      --embed-profile "${PROFILE}" \
      --track "${track}" \
      --qrels "${qrels}" \
      --strategy hyde \
      --llm-transforms \
      --top 20 \
      --run-dir "${run_dir}" \
      --min-available-gb 2.0 \
      --report -v 2>&1 | tee -a "${LOG}"
  done
}

MODELS=(
  "gemma4:e2b"      # smoke: smallest Gemma 4 edge tier; validates Ollama+cuda co-load
  "gemma4:e4b"      # balanced: ~3GB VRAM — co-loads with cuda embed
  "qwen3.5:9b"      # max quality; tight on 8GB — run last
)

log "=== Local LLM benchmark start (profile=${PROFILE}) ==="
check_index
check_ollama
check_gold

run_baseline

for model in "${MODELS[@]}"; do
  run_ollama_arm "${model}"
done

run_cloud_hyde

log "=== Local LLM benchmark complete. Results: data/eval/runs/ ==="
echo "LOCAL_LLM_BENCHMARK_DONE" >> "${LOG}"
