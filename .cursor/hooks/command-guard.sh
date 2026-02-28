#!/bin/bash
# command-guard.sh — Blocks dangerous commands before they execute.

set -euo pipefail

COMMAND=$(cat | jq -r '.command // ""')

BLOCKED=(
  "rm -rf"
  "git push --force"
  "git reset --hard"
)

for pattern in "${BLOCKED[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "{
      \"continue\": true,
      \"permission\": \"deny\",
      \"userMessage\": \"⛔ Blocked by team policy: '$pattern' is not allowed.\",
      \"agentMessage\": \"Command blocked. '$pattern' is restricted by team policy. Find a safer alternative.\"
    }"
    exit 0
  fi
done

echo '{"continue": true, "permission": "allow"}'
