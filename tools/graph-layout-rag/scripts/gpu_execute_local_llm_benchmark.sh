#!/usr/bin/env bash
# Sync graph-layout-rag + cuda index to the RTX 3060 Ti box and run the local LLM
# benchmark there (Ollama on GPU host, not on Mac).
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
PROFILE="${RAG_EMBED_PROFILE:-cuda-qwen0.6b-1024}"
LOCAL_LLM_MODELS="${RAG_LOCAL_LLM_MODELS:-gemma4:e4b}"
RAG_COMMON="$(cd "${ROOT}/../rag-common" && pwd)"

echo "=== Sync repo + cuda index + qrels to ${SSH_HOST} ==="
RSYNC_EXCLUDES=(
  --exclude '.venv'
  --exclude '__pycache__'
  --exclude '.pytest_cache'
  --exclude 'data/raw'
  --exclude 'data/bibliography-scan-cache'
  --exclude 'data/extract_cache'
  --exclude 'data/*.log'
  --exclude 'data/harvest*.log'
  --exclude 'data/ingest*.log'
  --exclude 'data/*.sqlite'
  --exclude 'data/*.sqlite-*'
  --exclude 'data/harvest.db'
  --exclude 'data/manifest*.json'
  --exclude 'data/harvest_checkpoint.json'
  --exclude 'data/trusted_venue_checkpoint.json'
)

rsync -avz --progress "${RSYNC_EXCLUDES[@]}" \
  "${ROOT}/" "${REMOTE}/tools/graph-layout-rag/"

rsync -avz --progress \
  --exclude '.venv' --exclude '__pycache__' \
  "${RAG_COMMON}/" "${REMOTE}/tools/rag-common/"

rsync -avz --progress \
  "data/indexes/${PROFILE}/lancedb/" \
  "${REMOTE}/tools/graph-layout-rag/data/indexes/${PROFILE}/lancedb/"

rsync -avz --progress \
  "data/indexes/${PROFILE}/ingest_state.json" \
  "${REMOTE}/tools/graph-layout-rag/data/indexes/${PROFILE}/ingest_state.json" 2>/dev/null || true

rsync -avz --progress \
  data/eval/qrels/ \
  "${REMOTE}/tools/graph-layout-rag/data/eval/qrels/" 2>/dev/null || true

echo "=== Remote bootstrap + local LLM benchmark (tmux) ==="
ssh "${SSH_HOST}" env PROFILE="${PROFILE}" LOCAL_LLM_MODELS="${LOCAL_LLM_MODELS}" REMOTE_ROOT="${REMOTE_ROOT}" bash -s <<'REMOTE'
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
cd "${HOME}/${REMOTE_ROOT}/tools/graph-layout-rag"
chmod +x scripts/gpu_*.sh
./scripts/gpu_remote_bootstrap.sh
export RAG_EMBED_PROFILE="${PROFILE}"
export RAG_LOCAL_EMBED_DEVICE=cuda
export GRAPH_RAG_ENCODE_DEVICE=cuda
export RAG_OLLAMA_HOST=http://127.0.0.1:11434
export RAG_LOCAL_LLM_MODELS="${LOCAL_LLM_MODELS}"
mkdir -p data/eval
cat > data/eval/run-local-llm-job.sh <<'JOB'
#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
cd "${HOME}/${REMOTE_ROOT}/tools/graph-layout-rag"
ulimit -n 65536
source scripts/gpu_env.sh
export RAG_EMBED_PROFILE="${PROFILE}"
export RAG_LOCAL_EMBED_DEVICE=cuda
export GRAPH_RAG_ENCODE_DEVICE=cuda
export RAG_OLLAMA_HOST=http://127.0.0.1:11434
export RAG_LOCAL_LLM_MODELS="${LOCAL_LLM_MODELS}"
mkdir -p data/eval/runs
gpu_log="data/eval/runs/$(date -u +%Y%m%dT%H%M%SZ)-local-llm-nvidia-smi.csv"
( while true; do
    nvidia-smi --query-gpu=timestamp,name,utilization.gpu,memory.used,memory.total,power.draw \
      --format=csv,noheader,nounits >> "${gpu_log}" 2>/dev/null || true
    sleep 30
  done ) &
smi_pid=$!
cleanup() { kill "${smi_pid}" 2>/dev/null || true; wait "${smi_pid}" 2>/dev/null || true; }
trap cleanup EXIT
status=0
: > data/eval/local_llm_benchmark.log
./scripts/gpu_local_llm_benchmark.sh 2>&1 | tee -a data/eval/local_llm_benchmark.log || status=$?
echo "${status}" > data/eval/local_llm_benchmark.exitcode
if [[ "${status}" -eq 0 ]]; then
  echo DONE > data/eval/local_llm_benchmark.sentinel
  echo LOCAL_LLM_PIPELINE_DONE >> data/eval/local_llm_benchmark.log
else
  echo FAILED > data/eval/local_llm_benchmark.sentinel
  echo LOCAL_LLM_PIPELINE_FAILED >> data/eval/local_llm_benchmark.log
fi
grep -Ei 'CUDA out of memory|Killed|Traceback|segmentation|worker exited|memory_aborted' \
  data/eval/local_llm_benchmark.log > data/eval/local_llm_benchmark.crashes 2>/dev/null || true
exit "${status}"
JOB
chmod +x data/eval/run-local-llm-job.sh
tmux kill-session -t graphrag-local-llm 2>/dev/null || true
tmux new-session -d -s graphrag-local-llm \
  "env REMOTE_ROOT='${REMOTE_ROOT}' PROFILE='${PROFILE}' LOCAL_LLM_MODELS='${LOCAL_LLM_MODELS}' bash data/eval/run-local-llm-job.sh"
echo "Started tmux session graphrag-local-llm. Tail: tmux attach -t graphrag-local-llm"
REMOTE

echo "=== Pull results when finished ==="
echo "  ssh ${SSH_HOST} 'cat ~/${REMOTE_ROOT}/tools/graph-layout-rag/data/eval/local_llm_benchmark.sentinel'"
echo "  ./scripts/gpu_sync_from_remote.sh"
