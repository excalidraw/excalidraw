#!/usr/bin/env bash
# afterFileEdit hook
#   1) Auto-format the edited file with the repo's Prettier — every AI edit lands consistent.
#   2) Append a JSON line to an audit log — every AI-touched file recorded + timestamped.
# The answer to "how do we KNOW what the agent changed?" at enterprise scale.
# Uses python3 for JSON (no jq dependency).

set -euo pipefail
input="$(cat)"

read -r file_path conversation_id < <(printf '%s' "$input" | python3 -c '
import sys, json
d = json.load(sys.stdin)
print((d.get("file_path") or d.get("path") or ""), (d.get("conversation_id") or "unknown"))
' 2>/dev/null || echo " unknown")

audit_log=".cursor/ai-edit-audit.log"

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.md)
    npx prettier --write "$file_path" >/dev/null 2>&1 || true
    ;;
esac

ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
printf '{"ts":"%s","actor":"cursor-agent","conversation":"%s","file":"%s"}\n' \
  "$ts" "$conversation_id" "$file_path" >> "$audit_log"

echo '{"continue":true}'
exit 0
