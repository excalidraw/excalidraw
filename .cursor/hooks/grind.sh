# This is the grind loop. Runs typecheck first, then tests. 
# If either fails, it sends the error output back to the agent 
# with a followup_message and the agent keeps working.
# If both pass, it returns empty JSON and the agent is done. ~30 lines.

#!/bin/bash
# grind.sh — The agent doesn't get to say it's done. Your CI standards do.
# Runs checks after the agent finishes. If anything fails, sends it back.

set -euo pipefail

MAX_ITERATIONS=5

INPUT=$(cat)
STATUS=$(echo "$INPUT" | jq -r '.status // "unknown"')
LOOP_COUNT=$(echo "$INPUT" | jq -r '.loop_count // 0')

# Only check on normal completion
if [ "$STATUS" != "completed" ] || [ "$LOOP_COUNT" -ge "$MAX_ITERATIONS" ]; then
  echo '{}'
  exit 0
fi

# ── Run your checks (adjust these to match your project) ─────
ERRORS=$(yarn test:typecheck 2>&1) || {
  TRIMMED=$(echo "$ERRORS" | head -40)
  FOLLOWUP="[Grind · Pass $((LOOP_COUNT + 1))/$MAX_ITERATIONS] Typecheck failed. Fix these errors:\n\n$TRIMMED"
  echo "{\"followup_message\": $(echo "$FOLLOWUP" | jq -Rs .)}"
  exit 0
}

ERRORS=$(yarn test:app --watch=false 2>&1) || {
  TRIMMED=$(echo "$ERRORS" | head -40)
  FOLLOWUP="[Grind · Pass $((LOOP_COUNT + 1))/$MAX_ITERATIONS] Tests failed. Fix without modifying test files:\n\n$TRIMMED"
  echo "{\"followup_message\": $(echo "$FOLLOWUP" | jq -Rs .)}"
  exit 0
}

# All checks passed — agent is done
echo '{}'
