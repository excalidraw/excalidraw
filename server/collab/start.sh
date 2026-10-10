#!/usr/bin/env bash
# Start the collaboration server. It binds localhost by default.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

# Per-install configuration, if present. The environment always wins over it.
# The CALLER wins over the file: `TTD_MODEL=... ./start.sh` must beat a stale
# `.env`, which is what every README here promises.
# shellcheck source=../.env-loader.sh
. "$DIR/../.env-loader.sh"
load_env_file "$DIR/.env"
exec node "$DIR/index.mjs"
