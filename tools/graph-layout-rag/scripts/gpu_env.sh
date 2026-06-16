#!/usr/bin/env bash
# Source from GPU box scripts: . "$(dirname "$0")/gpu_env.sh"
export PATH="${HOME}/.local/bin:${PATH}"

_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_pyver="$(uv run python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo 3.11)"
_site="${_root}/.venv/lib/python${_pyver}/site-packages"
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
