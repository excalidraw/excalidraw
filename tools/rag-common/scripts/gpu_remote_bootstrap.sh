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

extras=()
if grep -q 'retrieval-experiments-gpu' pyproject.toml 2>/dev/null; then
  extras+=(--extra retrieval-experiments-gpu)
fi
if grep -q 'docling' pyproject.toml 2>/dev/null \
  && { [[ "${RAG_GPU_INSTALL_DOCLING:-0}" == "1" ]] || grep -Eq 'PDF_BACKEND=.*docling' .env 2>/dev/null; }; then
  extras+=(--extra docling)
fi

echo "=== uv sync ${extras[*]:-(default)} ==="
if [[ "${#extras[@]}" -gt 0 ]]; then
  uv sync "${extras[@]}"
else
  uv sync
  uv pip install accelerate bitsandbytes 2>/dev/null || true
fi

if [[ "$(uname -s)" == "Linux" ]]; then
  # MLX is Apple-only. If installed in the Linux GPU venv, Transformers may
  # detect it and fail later with libmlx.so import errors during Docling runs.
  uv pip uninstall -y mlx mlx-audio mlx-embeddings mlx-lm mlx-vlm 2>/dev/null || true
fi

echo "=== PyTorch CUDA ==="
uv run python -c "import torch; print('cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"

echo "Bootstrap complete."
