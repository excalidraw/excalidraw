#!/usr/bin/env bash
# beforeReadFile hook
# Fires BEFORE a file's contents are sent to the model. Lets us withhold/redact secrets
# so they never enter an external LLM context. The "aha" hook for enterprise IP/secret egress.
# Uses python3 for JSON (no jq dependency).

set -euo pipefail
input="$(cat)"

file_path="$(printf '%s' "$input" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("file_path") or d.get("path") or "")' 2>/dev/null || echo "")"

case "$file_path" in
  *.env|*.env.*|*.pem|*.key|*/secrets/*|*credentials*)
    python3 - "$file_path" << 'PY'
import sys, json
p = sys.argv[1]
print(json.dumps({
  "permission": "deny",
  "userMessage": "🔒 Redaction hook blocked reading a secret file: " + p,
  "agentMessage": "This file is a secret store and is withheld from context by policy. Ask the user for any value you need."
}))
PY
    exit 0
    ;;
esac

# For non-secret files, allow. In Cursor versions that pass file content on stdin, you can
# redact inline here before returning {"permission":"allow","content": <redacted>} — e.g. strip
# sk-..., AKIA..., ghp_... tokens with sed/python before the content reaches the model.
echo '{"permission":"allow"}'
exit 0
