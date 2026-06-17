#!/usr/bin/env bash
# Source from GPU box scripts inside graph-layout-rag.
export RAG_GPU_TOOL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")/../../rag-common/scripts" && pwd)/gpu_env.sh"
