#!/usr/bin/env bash
# Bootstrap Ubuntu GPU box: verify CUDA, sync deps, start Qdrant.
# Run ON the remote host (or: ssh user@host 'bash -s' < scripts/gpu_remote_bootstrap.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${PATH}"
# shellcheck disable=SC1091
source "$(dirname "$0")/gpu_env.sh"

echo "=== nvidia-smi ==="
nvidia-smi

echo "=== uv sync (retrieval-experiments-gpu) ==="
uv sync --extra retrieval-experiments-gpu

echo "=== ONNX Runtime providers ==="
uv run python -c "import onnxruntime as ort; print(ort.get_available_providers())"

echo "=== PyTorch CUDA ==="
uv run python -c "import torch; print('cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"

QDRANT_URL="${GRAPH_RAG_QDRANT_URL:-http://127.0.0.1:6333}"
if curl -sf "${QDRANT_URL}/readyz" >/dev/null 2>&1 || wget -qO- "${QDRANT_URL}/readyz" >/dev/null 2>&1; then
  echo "=== Qdrant already reachable at ${QDRANT_URL} ==="
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx graphrag-qdrant; then
  echo "=== Qdrant docker container already running ==="
elif command -v docker >/dev/null 2>&1; then
  echo "=== Starting Qdrant (docker) ==="
  docker run -d --name graphrag-qdrant --restart unless-stopped \
    -p 6333:6333 -v graphrag-qdrant-data:/qdrant/storage \
    qdrant/qdrant
else
  echo "=== Starting Qdrant (standalone binary) ==="
  QDRANT_DIR="${HOME}/.local/share/graphrag-qdrant"
  mkdir -p "${QDRANT_DIR}"
  if [[ ! -f "${QDRANT_DIR}/config.yaml" ]]; then
    cat > "${QDRANT_DIR}/config.yaml" <<EOF
storage:
  storage_path: ${QDRANT_DIR}/storage
service:
  http_port: 6333
  grpc_port: 6334
EOF
  fi
  if pgrep -f '[q]drant.*config.yaml' >/dev/null 2>&1; then
    echo "qdrant process already running"
  else
    nohup bash -lc "ulimit -n 65536; exec \"${HOME}/bin/qdrant\" --config-path \"${QDRANT_DIR}/config.yaml\"" \
      > "${QDRANT_DIR}/qdrant.log" 2>&1 &
    sleep 3
  fi
fi

cat <<'EOF'

Bootstrap complete. Next:
  export GRAPH_RAG_QDRANT_URL=http://127.0.0.1:6333
  export GRAPH_RAG_ENCODE_DEVICE=cuda
  tmux new -s graphrag-encode
  ./scripts/gpu_build_ab_indexes.sh

EOF
