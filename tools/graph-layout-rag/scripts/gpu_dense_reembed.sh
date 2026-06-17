#!/usr/bin/env bash
# Dense re-embed pipeline on Ubuntu GPU: bootstrap, throughput probe, full re-embed in tmux.
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
SOURCE_PROFILE="${GRAPH_RAG_SOURCE_PROFILE:-gemini-2-structure-v1}"
TARGET_PROFILE="${GRAPH_RAG_TARGET_PROFILE:-cuda-qwen0.6b-1024}"

echo "=== Sync to ${SSH_HOST} ==="
"${ROOT}/scripts/gpu_sync_to_remote.sh"

echo "=== Remote bootstrap + probe + re-embed (tmux) ==="
ssh "${SSH_HOST}" bash -lc "
  set -euo pipefail
  export PATH=\"\${HOME}/.local/bin:\${PATH}\"
  cd ~/${REMOTE_ROOT}/tools/graph-layout-rag
  chmod +x scripts/gpu_*.sh scripts/bench_dense_embed.py
  ./scripts/gpu_remote_bootstrap.sh
  source scripts/gpu_env.sh
  export RAG_LOCAL_EMBED_DEVICE=cuda
  export RAG_CUDA_BATCH_SIZE=16
  export GRAPH_RAG_SOURCE_PROFILE=${SOURCE_PROFILE}
  export GRAPH_RAG_TARGET_PROFILE=${TARGET_PROFILE}

  echo '=== Throughput probe (512 chunks) ==='
  uv run python scripts/bench_dense_embed.py \
    --profile ${TARGET_PROFILE} \
    --source-profile ${SOURCE_PROFILE} \
    --sample 512 --batch-size 16 \
    | tee data/eval/dense_embed_probe.log

  tmux kill-session -t dense-reembed 2>/dev/null || true
  tmux new-session -d -s dense-reembed \
    'export PATH=\"\${HOME}/.local/bin:\${PATH}\"; cd ~/${REMOTE_ROOT}/tools/graph-layout-rag; \
     ulimit -n 65536; source scripts/gpu_env.sh; \
     export RAG_LOCAL_EMBED_DEVICE=cuda RAG_CUDA_BATCH_SIZE=16; \
     uv run graph-layout-rag ingest reembed \
       --source-profile ${SOURCE_PROFILE} \
       --target-profile ${TARGET_PROFILE} -v \
       2>&1 | tee -a data/dense-reembed.log; \
     echo REEMBED_DONE >> data/dense-reembed.log'
  echo \"Started tmux dense-reembed. Attach: ssh ${SSH_HOST} tmux attach -t dense-reembed\"
"

if ssh "${SSH_HOST}" "grep -q REEMBED_DONE ~/${REMOTE_ROOT}/tools/graph-layout-rag/data/dense-reembed.log 2>/dev/null"; then
  "${ROOT}/scripts/gpu_sync_from_remote.sh"
  echo "Re-embed complete. Index synced to Mac."
else
  echo "Re-embed running in tmux on ${SSH_HOST}. When done, run:"
  echo "  ./scripts/gpu_sync_from_remote.sh"
fi
