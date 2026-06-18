#!/usr/bin/env bash
# Local verification for fork-only PR hooks (run: ./scripts/verify-fork-hooks.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PR_HOOK="$ROOT/.cursor/hooks/block-upstream-pr.sh"
MCP_HOOK="$ROOT/.cursor/hooks/block-upstream-mcp.sh"

run_hook() {
  local hook="$1" payload="$2" expect="$3"
  local out
  out="$(printf '%s' "$payload" | "$hook")"
  local perm
  perm="$(printf '%s' "$out" | python3 -c 'import sys,json; print(json.load(sys.stdin)["permission"])')"
  if [[ "$perm" == "$expect" ]]; then
    echo "OK  $expect  $hook"
  else
    echo "FAIL expected=$expect got=$perm payload=$payload"
    echo "    output: $out"
    exit 1
  fi
}

echo "block-upstream-pr.sh"
run_hook "$PR_HOOK" '{"command":"gh pr create --repo excalidraw/excalidraw --title x"}' deny
run_hook "$PR_HOOK" '{"command":"git push upstream master"}' deny
run_hook "$PR_HOOK" '{"command":"gh pr create --repo chuysmans/excalidraw --title x"}' allow
run_hook "$PR_HOOK" '{"command":"gh issue view 1 --repo excalidraw/excalidraw"}' allow
run_hook "$PR_HOOK" '{"command":"git push origin feat/my-branch"}' allow

echo "block-upstream-mcp.sh"
run_hook "$MCP_HOOK" '{"toolName":"create_pull_request","arguments":{"owner":"excalidraw","repo":"excalidraw","title":"x"}}' deny
run_hook "$MCP_HOOK" '{"toolName":"create_pull_request","arguments":{"owner":"chuysmans","repo":"excalidraw","title":"x"}}' allow
run_hook "$MCP_HOOK" '{"toolName":"issue_read","arguments":{"owner":"excalidraw","repo":"excalidraw","issue_number":1}}' allow

echo "All hook checks passed."
