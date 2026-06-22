#!/usr/bin/env bash
# RAPTOR 50-doc smoke on Ubuntu GPU: sync code + corpus, bootstrap, ingest in tmux.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RAG_COMMON="$(cd "${ROOT}/../rag-common" && pwd)"
RAG_GPU_TOOL="${RAG_GPU_TOOL:-tools/rag-literature-rag}"
SSH_HOST="${RAG_GPU_SSH:-desktop}"
REMOTE_ROOT="${RAG_GPU_REMOTE_ROOT:-excalidraw-tf}"
TARGET_PROFILE="${RAG_GPU_TARGET_PROFILE:-cuda-qwen0.6b-raptor-gemma4-v1}"
DOC_LIMIT="${RAG_GPU_RAPTOR_SMOKE_LIMIT:-50}"
RUN_DIR="${RAG_GPU_RAPTOR_RUN_DIR:-data/eval/runs/20260621-raptor-cuda-smoke}"
CUDA_BATCH="${RAG_CUDA_BATCH_SIZE:-8}"
REMOTE="${SSH_HOST}:~/${REMOTE_ROOT}/tools/rag-literature-rag"
SYNC_CORPUS="${RAG_GPU_SYNC_CORPUS:-1}"
PULL_ON_DONE="${RAG_GPU_PULL_ON_DONE:-0}"

export RAG_GPU_TOOL

echo "=== Sync code to ${SSH_HOST} (${RAG_GPU_TOOL}) ==="
"${RAG_COMMON}/scripts/gpu_sync_to_remote.sh" 2>/dev/null || \
  RAG_GPU_TOOL="${RAG_GPU_TOOL}" "${ROOT}/scripts/gpu_sync_to_remote.sh"

if [[ "${SYNC_CORPUS}" == "1" ]]; then
  echo "=== Sync manifest + PDFs + extract_cache to ${SSH_HOST} ==="
  rsync -avz --progress data/manifest.json "${REMOTE}/data/"
  rsync -avz --progress data/raw/pdf/ "${REMOTE}/data/raw/pdf/"
  if [[ -d data/extract_cache ]]; then
    rsync -avz --progress data/extract_cache/ "${REMOTE}/data/extract_cache/" || true
  fi
fi

echo "=== Remote bootstrap + RAPTOR smoke ingest (tmux) ==="
ssh "${SSH_HOST}" bash -s -- \
  "${REMOTE_ROOT}" "${TARGET_PROFILE}" "${DOC_LIMIT}" "${RUN_DIR}" "${CUDA_BATCH}" "${SSH_HOST}" <<'REMOTE'
set -euo pipefail
REMOTE_ROOT="$1"
TARGET_PROFILE="$2"
DOC_LIMIT="$3"
RUN_DIR="$4"
CUDA_BATCH="$5"
SSH_HOST="$6"

export PATH="${HOME}/.local/bin:${PATH}"
cd "${HOME}/${REMOTE_ROOT}/tools/rag-literature-rag"
chmod +x scripts/gpu_*.sh 2>/dev/null || true

if ! curl -sf http://127.0.0.1:11434/api/tags | grep -qi gemma4; then
  echo "Pulling gemma4:e4b for Ollama..."
  ollama pull gemma4:e4b
fi

RAG_GPU_INSTALL_DOCLING=1 bash ../rag-common/scripts/gpu_remote_bootstrap.sh
uv sync --extra docling --extra raptor --extra retrieval-experiments-gpu

source ../rag-common/scripts/gpu_env.sh
export RAG_LIT_PDF_BACKEND=docling
export RAG_LIT_EXTRACT_WORKERS=1
export RAG_LIT_DOCLING_DEVICE=cpu
export RAG_LIT_DOCLING_THREADS=4
export RAG_LOCAL_EMBED_DEVICE=cuda
export RAG_CUDA_BATCH_SIZE="${CUDA_BATCH}"
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export LD_LIBRARY_PATH="${PWD}/.venv/lib/python3.11/site-packages/nvidia/cu13/lib:${LD_LIBRARY_PATH:-}"
export RAG_EMBED_PROFILE="${TARGET_PROFILE}"
export RAG_LIT_RAPTOR_OLLAMA_MODEL=gemma4:e4b
export RAG_LIT_RAPTOR_OLLAMA_HOST=http://127.0.0.1:11434

uv run python -c "import torch; print('cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"

mkdir -p "${RUN_DIR}"
JOB_SCRIPT="${RUN_DIR}/run-raptor-smoke.sh"
cat > "${JOB_SCRIPT}" <<'JOB'
#!/usr/bin/env bash
set -euo pipefail
: "${REMOTE_ROOT:?}"
: "${TARGET_PROFILE:?}"
: "${DOC_LIMIT:?}"
: "${RUN_DIR:?}"
: "${CUDA_BATCH:?}"

export PATH="${HOME}/.local/bin:${PATH}"
cd "${HOME}/${REMOTE_ROOT}/tools/rag-literature-rag"
ulimit -n 65536
source ../rag-common/scripts/gpu_env.sh
export RAG_LIT_PDF_BACKEND=docling
export RAG_LIT_EXTRACT_WORKERS=1
export RAG_LIT_DOCLING_DEVICE=cpu
export RAG_LIT_DOCLING_THREADS=4
export RAG_LOCAL_EMBED_DEVICE=cuda
export RAG_CUDA_BATCH_SIZE="${CUDA_BATCH}"
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export LD_LIBRARY_PATH="${PWD}/.venv/lib/python3.11/site-packages/nvidia/cu13/lib:${LD_LIBRARY_PATH:-}"
export RAG_EMBED_PROFILE="${TARGET_PROFILE}"
export RAG_LIT_RAPTOR_OLLAMA_MODEL=gemma4:e4b
export RAG_LIT_RAPTOR_OLLAMA_HOST=http://127.0.0.1:11434

gpu_log="${RUN_DIR}/nvidia-smi.csv"
( while true; do
    nvidia-smi --query-gpu=timestamp,name,utilization.gpu,memory.used,memory.total,power.draw \
      --format=csv,noheader,nounits >> "${gpu_log}" 2>/dev/null || true
    sleep 30
  done ) &
smi_pid=$!
cleanup() { kill "${smi_pid}" 2>/dev/null || true; wait "${smi_pid}" 2>/dev/null || true; }
trap cleanup EXIT

status=0
uv run rag-literature-rag ingest --force --rebuild --limit "${DOC_LIMIT}" -v \
  2>&1 | tee "${RUN_DIR}/ingest.log" || status=$?
printf '%s\n' "${status}" > "${RUN_DIR}/ingest.exitcode"
if [[ "${status}" -eq 0 ]]; then
  printf '%s\n' DONE > "${RUN_DIR}/ingest.sentinel"
else
  printf '%s\n' FAILED > "${RUN_DIR}/ingest.sentinel"
fi
grep -Ei "CUDA out of memory|Killed|Traceback|segmentation|worker exited|memory_aborted" \
  "${RUN_DIR}/ingest.log" > "${RUN_DIR}/ingest.crashes" 2>/dev/null || true
exit "${status}"
JOB
chmod +x "${JOB_SCRIPT}"

quote() { printf "%q" "$1"; }
tmux kill-session -t raptor-smoke 2>/dev/null || true
tmux new-session -d -s raptor-smoke \
  "env REMOTE_ROOT=$(quote "${REMOTE_ROOT}") TARGET_PROFILE=$(quote "${TARGET_PROFILE}") DOC_LIMIT=$(quote "${DOC_LIMIT}") RUN_DIR=$(quote "${RUN_DIR}") CUDA_BATCH=$(quote "${CUDA_BATCH}") bash $(quote "${JOB_SCRIPT}")"
echo "Started tmux raptor-smoke on ${SSH_HOST}. Attach: ssh ${SSH_HOST} tmux attach -t raptor-smoke"
REMOTE

if [[ "${PULL_ON_DONE}" == "1" ]]; then
  echo "Waiting for remote ingest to finish..."
  while ! ssh "${SSH_HOST}" "test -f ~/${REMOTE_ROOT}/tools/rag-literature-rag/${RUN_DIR}/ingest.sentinel"; do
    sleep 60
  done
  if ssh "${SSH_HOST}" "grep -q DONE ~/${REMOTE_ROOT}/tools/rag-literature-rag/${RUN_DIR}/ingest.sentinel"; then
    RAG_GPU_TARGET_PROFILE="${TARGET_PROFILE}" RAG_GPU_SYNC_CACHES_BACK=1 \
      "${ROOT}/scripts/gpu_sync_from_remote.sh"
    rsync -avz --progress \
      "${REMOTE}/${RUN_DIR}/" \
      "${ROOT}/${RUN_DIR}/"
    echo "RAPTOR smoke complete. Index synced to Mac."
  else
    echo "RAPTOR smoke failed on ${SSH_HOST}. Check: ssh ${SSH_HOST} tmux attach -t raptor-smoke"
    exit 1
  fi
else
  echo "RAPTOR smoke running in tmux on ${SSH_HOST}."
  echo "When done, pull index:"
  echo "  cd tools/rag-literature-rag"
  echo "  RAG_GPU_TARGET_PROFILE=${TARGET_PROFILE} RAG_GPU_SYNC_CACHES_BACK=1 ./scripts/gpu_sync_from_remote.sh"
  echo "  rsync -avz ${REMOTE}/${RUN_DIR}/ ${ROOT}/${RUN_DIR}/"
fi
