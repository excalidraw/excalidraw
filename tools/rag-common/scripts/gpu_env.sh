#!/usr/bin/env bash
# Source from GPU box scripts inside a RAG tool directory.
# Usage: source "$(dirname "$0")/../rag-common/scripts/gpu_env.sh"
export PATH="${HOME}/.local/bin:${PATH}"

if [[ -z "${RAG_GPU_TOOL_ROOT:-}" ]]; then
  _script_dir="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
  if [[ "${_script_dir}" == */rag-common/scripts ]]; then
    RAG_GPU_TOOL_ROOT="$(cd "${_script_dir}/../../graph-layout-rag" && pwd)"
  else
    RAG_GPU_TOOL_ROOT="$(cd "${_script_dir}/.." && pwd)"
  fi
fi

_pyver="$(uv run python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo 3.11)"
_site="${RAG_GPU_TOOL_ROOT}/.venv/lib/python${_pyver}/site-packages"
if [[ -d "${_site}/nvidia" ]]; then
  _cuda_paths=""
  for _libdir in "${_site}"/nvidia/*/lib; do
    if [[ -d "${_libdir}" && "${_libdir}" != *"/cu13/lib" ]]; then
      _cuda_paths="${_cuda_paths:+${_cuda_paths}:}${_libdir}"
    fi
  done
  if [[ -n "${_cuda_paths}" ]]; then
    export LD_LIBRARY_PATH="${_cuda_paths}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
  fi
fi
