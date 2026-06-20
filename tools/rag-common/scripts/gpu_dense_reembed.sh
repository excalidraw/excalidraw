#!/usr/bin/env bash
# Dense re-embed pipeline on Ubuntu GPU: bootstrap, throughput probe, full re-embed in tmux.
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
TOOL_REMOTE_NAME="$(basename "${RAG_GPU_TOOL}")"

case "${RAG_GPU_TOOL}" in
  tools/repo-rag)
    SOURCE_PROFILE="${RAG_GPU_SOURCE_PROFILE:-gemini-2}"
    REEMBED_CMD="${RAG_REEMBED_CMD:-repo-rag reembed}"
    ENV_PREFIX="${RAG_REEMBED_ENV_PREFIX:-REPO_RAG_}"
    ;;
  tools/rag-literature-rag)
    SOURCE_PROFILE="${RAG_GPU_SOURCE_PROFILE:-gemini-2-structure-v1}"
    REEMBED_CMD="${RAG_REEMBED_CMD:-rag-literature-rag ingest reembed}"
    ENV_PREFIX="${RAG_REEMBED_ENV_PREFIX:-RAG_LIT_}"
    ;;
  *)
    SOURCE_PROFILE="${RAG_GPU_SOURCE_PROFILE:-gemini-2-structure-v1}"
    REEMBED_CMD="${RAG_REEMBED_CMD:-graph-layout-rag ingest reembed}"
    ENV_PREFIX="${RAG_REEMBED_ENV_PREFIX:-GRAPH_RAG_}"
    ;;
esac

TARGET_PROFILE="${RAG_GPU_TARGET_PROFILE:-${GRAPH_RAG_TARGET_PROFILE:-cuda-qwen0.6b-1024}}"
CUDA_BATCH="${RAG_CUDA_BATCH_SIZE:-8}"

export RAG_GPU_TOOL RAG_GPU_SOURCE_PROFILE="${SOURCE_PROFILE}" RAG_GPU_TARGET_PROFILE="${TARGET_PROFILE}"

echo "=== Sync to ${SSH_HOST} (${RAG_GPU_TOOL}) ==="
"${RAG_COMMON_SCRIPTS}/gpu_sync_to_remote.sh"

echo "=== Remote bootstrap + probe + re-embed (tmux) ==="
ssh "${SSH_HOST}" bash -s -- \
  "${REMOTE_ROOT}" "${TOOL_REMOTE_NAME}" "${SOURCE_PROFILE}" "${TARGET_PROFILE}" \
  "${CUDA_BATCH}" "${ENV_PREFIX}" "${REEMBED_CMD}" "${SSH_HOST}" <<'REMOTE'
set -euo pipefail
REMOTE_ROOT="$1"
TOOL_REMOTE_NAME="$2"
SOURCE_PROFILE="$3"
TARGET_PROFILE="$4"
CUDA_BATCH="$5"
ENV_PREFIX="$6"
REEMBED_CMD="$7"
SSH_HOST="$8"

export PATH="${HOME}/.local/bin:${PATH}"
cd "${HOME}/${REMOTE_ROOT}/tools/${TOOL_REMOTE_NAME}"
chmod +x scripts/gpu_*.sh 2>/dev/null || true
bash ../rag-common/scripts/gpu_remote_bootstrap.sh
source ../rag-common/scripts/gpu_env.sh
export RAG_LOCAL_EMBED_DEVICE=cuda
export RAG_CUDA_BATCH_SIZE="${CUDA_BATCH}"
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export LD_LIBRARY_PATH="${PWD}/.venv/lib/python3.11/site-packages/nvidia/cu13/lib:${LD_LIBRARY_PATH:-}"

LANCE_DIR="data/indexes/${SOURCE_PROFILE}/lancedb"
if [[ ! -d "${LANCE_DIR}" ]]; then LANCE_DIR="data/lancedb"; fi

echo '=== Throughput probe (512 chunks) ==='
mkdir -p data/eval/runs
uv run python -m rag_common.bench_dense_embed \
  --profile "${TARGET_PROFILE}" \
  --lance-dir "${LANCE_DIR}" \
  --env-prefix "${ENV_PREFIX}" \
  --sample 512 --batch-size "${CUDA_BATCH}" \
  | tee data/eval/dense_embed_probe.log

JOB_SCRIPT="data/eval/run-dense-reembed-job.sh"
cat > "${JOB_SCRIPT}" <<'JOB'
#!/usr/bin/env bash
set -euo pipefail
: "${REMOTE_ROOT:?}"
: "${TOOL_REMOTE_NAME:?}"
: "${SOURCE_PROFILE:?}"
: "${TARGET_PROFILE:?}"
: "${CUDA_BATCH:?}"
: "${REEMBED_CMD:?}"

export PATH="${HOME}/.local/bin:${PATH}"
cd "${HOME}/${REMOTE_ROOT}/tools/${TOOL_REMOTE_NAME}"
ulimit -n 65536
source ../rag-common/scripts/gpu_env.sh
export RAG_LOCAL_EMBED_DEVICE=cuda
export RAG_CUDA_BATCH_SIZE="${CUDA_BATCH}"
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export LD_LIBRARY_PATH="${PWD}/.venv/lib/python3.11/site-packages/nvidia/cu13/lib:${LD_LIBRARY_PATH:-}"
mkdir -p data/eval/runs
: > data/dense-reembed.log
gpu_log="data/eval/runs/$(date -u +%Y%m%dT%H%M%SZ)-dense-reembed-nvidia-smi.csv"
( while true; do
    nvidia-smi --query-gpu=timestamp,name,utilization.gpu,memory.used,memory.total,power.draw \
      --format=csv,noheader,nounits >> "${gpu_log}" 2>/dev/null || true
    sleep 30
  done ) &
smi_pid=$!
cleanup() { kill "${smi_pid}" 2>/dev/null || true; wait "${smi_pid}" 2>/dev/null || true; }
trap cleanup EXIT
status=0
# shellcheck disable=SC2086
uv run ${REEMBED_CMD} \
  --source-profile "${SOURCE_PROFILE}" \
  --target-profile "${TARGET_PROFILE}" -v \
  2>&1 | tee -a data/dense-reembed.log || status=$?
printf '%s\n' "${status}" > data/dense-reembed.exitcode
if [[ "${status}" -eq 0 ]]; then
  printf '%s\n' DONE > data/dense-reembed.sentinel
  printf '%s\n' REEMBED_DONE >> data/dense-reembed.log
else
  printf '%s\n' FAILED > data/dense-reembed.sentinel
  printf '%s\n' REEMBED_FAILED >> data/dense-reembed.log
fi
grep -Ei "CUDA out of memory|Killed|Traceback|segmentation|worker exited|memory_aborted" \
  data/dense-reembed.log > data/dense-reembed.crashes 2>/dev/null || true
exit "${status}"
JOB
chmod +x "${JOB_SCRIPT}"

quote() { printf "%q" "$1"; }
tmux kill-session -t dense-reembed 2>/dev/null || true
tmux new-session -d -s dense-reembed \
  "env REMOTE_ROOT=$(quote "${REMOTE_ROOT}") TOOL_REMOTE_NAME=$(quote "${TOOL_REMOTE_NAME}") SOURCE_PROFILE=$(quote "${SOURCE_PROFILE}") TARGET_PROFILE=$(quote "${TARGET_PROFILE}") CUDA_BATCH=$(quote "${CUDA_BATCH}") REEMBED_CMD=$(quote "${REEMBED_CMD}") bash $(quote "${JOB_SCRIPT}")"
echo "Started tmux dense-reembed. Attach: ssh ${SSH_HOST} tmux attach -t dense-reembed"
REMOTE

if ssh "${SSH_HOST}" "grep -q DONE ~/${REMOTE_ROOT}/tools/${TOOL_REMOTE_NAME}/data/dense-reembed.sentinel 2>/dev/null"; then
  "${RAG_COMMON_SCRIPTS}/gpu_sync_from_remote.sh"
  echo "Re-embed complete. Index synced to Mac."
else
  echo "Re-embed running in tmux on ${SSH_HOST}. When done, run:"
  echo "  RAG_GPU_TOOL=${RAG_GPU_TOOL} ${RAG_COMMON_SCRIPTS}/gpu_sync_from_remote.sh"
fi
