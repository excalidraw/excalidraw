#!/usr/bin/env bash
# Wrapper for Phase 1 bootstrap (see bootstrap.mjs).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/bootstrap.mjs" "$@"
