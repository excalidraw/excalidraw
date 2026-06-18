#!/usr/bin/env bash
# afterFileEdit hook
#   1) Auto-format the edited file with the repo's Prettier — every AI edit lands consistent.
#   2) Append a JSON line to an audit log — every AI-touched file recorded + timestamped.
# The answer to "how do we KNOW what the agent changed?" at enterprise scale.
# Uses python3 for JSON (no jq dependency).

set -euo pipefail
input="$(cat)"

audit_log=".cursor/ai-edit-audit.log"

read -r file_path < <(printf '%s' "$input" | python3 -c '
import sys, json
d = json.load(sys.stdin)
print(d.get("file_path") or d.get("path") or "")
' 2>/dev/null || echo "")

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.md)
    npx prettier --write "$file_path" >/dev/null 2>&1 || true
    ;;
esac

python3 - "$input" "$audit_log" <<'PY'
import json
import sys
from datetime import datetime, timezone

payload = json.loads(sys.argv[1])
audit_log = sys.argv[2]
entry = {
    "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "actor": "cursor-agent",
    "conversation": payload.get("conversation_id") or "unknown",
    "file": payload.get("file_path") or payload.get("path") or "",
}
with open(audit_log, "a", encoding="utf-8") as f:
    f.write(json.dumps(entry) + "\n")
PY

echo '{"continue":true}'
exit 0
