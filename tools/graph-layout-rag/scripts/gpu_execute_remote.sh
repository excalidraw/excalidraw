#!/usr/bin/env bash
# Run full GPU pipeline on Ubuntu via SSH from Mac (requires working SSH auth).
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
RAG_COMMON="$(cd "${ROOT}/../rag-common" && pwd)"

echo "=== Sync repo + data to ${SSH_HOST} ==="
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
  --exclude 'data/indexes'
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
  "${REMOTE}/tools/graph-layout-rag/data/eval/qrels/"

echo "=== Remote bootstrap + build + benchmark (tmux) ==="
ssh "${SSH_HOST}" bash -lc "
  set -euo pipefail
  export PATH=\"\${HOME}/.local/bin:\${PATH}\"
  cd ~/${REMOTE_ROOT}/tools/graph-layout-rag
  chmod +x scripts/gpu_*.sh
  ./scripts/gpu_remote_bootstrap.sh
  export GRAPH_RAG_QDRANT_URL=http://127.0.0.1:6333
  export GRAPH_RAG_ENCODE_DEVICE=cuda
  tmux kill-session -t graphrag-encode 2>/dev/null || true
  tmux new-session -d -s graphrag-encode \
    \"bash -lc 'set -euo pipefail
     export PATH=\${HOME}/.local/bin:\${PATH}
     cd ~/${REMOTE_ROOT}/tools/graph-layout-rag
     ulimit -n 65536
     source scripts/gpu_env.sh
     export GRAPH_RAG_QDRANT_URL=http://127.0.0.1:6333 GRAPH_RAG_ENCODE_DEVICE=cuda
     mkdir -p data/eval/runs
     : > data/eval/gpu_pipeline.log
     gpu_log=data/eval/runs/\$(date -u +%Y%m%dT%H%M%SZ)-gpu-pipeline-nvidia-smi.csv
     ( while true; do
         nvidia-smi --query-gpu=timestamp,name,utilization.gpu,memory.used,memory.total,power.draw \
           --format=csv,noheader,nounits >> \${gpu_log} 2>/dev/null || true
         sleep 30
       done ) &
     smi_pid=\$!
     cleanup() { kill \${smi_pid} 2>/dev/null || true; wait \${smi_pid} 2>/dev/null || true; }
     trap cleanup EXIT
     status=0
     { ./scripts/gpu_build_ab_indexes.sh && ./scripts/gpu_run_benchmark.sh; } \
       2>&1 | tee -a data/eval/gpu_pipeline.log || status=\$?
     echo \${status} > data/eval/gpu_pipeline.exitcode
     if [[ \${status} -eq 0 ]]; then
       echo DONE > data/eval/gpu_pipeline.sentinel
       echo PIPELINE_DONE >> data/eval/gpu_pipeline.log
     else
       echo FAILED > data/eval/gpu_pipeline.sentinel
       echo PIPELINE_FAILED >> data/eval/gpu_pipeline.log
     fi
     grep -Ei \"CUDA out of memory|Killed|Traceback|segmentation|worker exited|memory_aborted\" \
       data/eval/gpu_pipeline.log > data/eval/gpu_pipeline.crashes 2>/dev/null || true
     exit \${status}'\"
  echo \"Started tmux session graphrag-encode. Tail: ssh ${SSH_HOST} tmux attach -t graphrag-encode\"
"

echo "=== Pull results back (skip if pipeline still running in tmux) ==="
if ssh "${SSH_HOST}" "grep -q DONE ~/${REMOTE_ROOT}/tools/graph-layout-rag/data/eval/gpu_pipeline.sentinel 2>/dev/null"; then
  "${ROOT}/scripts/gpu_sync_from_remote.sh"
  echo "Done. Check data/eval/runs/ on Mac."
else
  echo "Pipeline still running in tmux on ${SSH_HOST}. When finished, run:"
  echo "  ./scripts/gpu_sync_from_remote.sh"
fi
