#!/usr/bin/env bash
# Start the TTD bridge. Configuration comes from the environment (see README.md).
# Refuses to start without a model, so nothing is ever sent to a hosted default.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Per-install configuration, if present. The environment always wins over it, so
# `TTD_MODEL=... ./start.sh` still overrides a stale file.
# The CALLER wins over the file: `TTD_MODEL=... ./start.sh` must beat a stale
# `.env`, which is what every README here promises.
# shellcheck source=../.env-loader.sh
. "$DIR/../.env-loader.sh"
load_env_file "$DIR/.env"

if [ -z "${TTD_MODEL_BASE_URL:-}" ]; then
  echo "TTD_MODEL_BASE_URL is not set." >&2
  echo "Example: TTD_MODEL_BASE_URL=http://127.0.0.1:8080/v1 ./start.sh" >&2
  exit 1
fi

exec node "$DIR/index.mjs"
