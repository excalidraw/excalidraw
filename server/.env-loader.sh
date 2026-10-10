#!/usr/bin/env bash
# Load a service's `.env` WITHOUT overriding the caller's environment.
#
# `set -a; . .env` would let the file win, which is the opposite of what every
# README here promises — `TTD_MODEL=... ./start.sh` must beat a stale file. So each
# key is set only when the caller did not set it.
#
#   . "$(dirname "$0")/../.env-loader.sh"
#   load_env_file "$DIR/.env"
set -u

load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  local key value current
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    # Trim, and drop one layer of surrounding quotes.
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    case "$value" in
      \"*\") value="${value#\"}"; value="${value%\"}" ;;
      \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    case "$key" in ''|*[!A-Za-z0-9_]*) continue ;; esac
    eval "current=\${$key-__unset__}"
    if [ "$current" = "__unset__" ]; then
      export "$key=$value"
    fi
  done <"$file"
}
