#!/usr/bin/env bash
set -euo pipefail
export RAG_GPU_TOOL="${RAG_GPU_TOOL:-tools/repo-rag}"
exec "$(cd "$(dirname "$0")/../../rag-common/scripts" && pwd)/gpu_dense_reembed.sh" "$@"
