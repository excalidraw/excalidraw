#!/usr/bin/env bash
# Bootstrap Ubuntu GPU box: verify CUDA, sync deps.
# Run ON the remote host from a RAG tool directory.
set -euo pipefail

# Run from a RAG tool directory (cwd = tool root).
ROOT="$(pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
export RAG_GPU_TOOL_ROOT="${ROOT}"
# shellcheck disable=SC1091
source "$(dirname "$0")/gpu_env.sh"

echo "=== nvidia-smi ==="
nvidia-smi

echo "=== uv sync (retrieval-experiments-gpu) ==="
if grep -q 'retrieval-experiments-gpu' pyproject.toml 2>/dev/null; then
  uv sync --extra retrieval-experiments-gpu
else
  uv sync
  uv pip install accelerate bitsandbytes 2>/dev/null || true
fi

echo "=== PyTorch CUDA ==="
uv run python -c "import torch; print('cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"

echo "Bootstrap complete."
