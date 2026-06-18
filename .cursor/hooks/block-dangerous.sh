#!/usr/bin/env bash
# beforeShellExecution hook
# Cursor pipes JSON on stdin: { "command": "...", "cwd": "...", "hook_event_name": "beforeShellExecution", ... }
# We respond on stdout with: { "permission": "allow|deny|ask", "userMessage": "...", "agentMessage": "..." }
#
# Purpose: deterministic guardrail. The model CANNOT override this — it is code, not a prompt.
# Blocks destructive git, force-push to protected branches, recursive deletes, and pipe-to-shell.
#
# Uses python3 (ubiquitous) for JSON so there is no jq dependency on the demo machine.

set -euo pipefail
input="$(cat)"

cmd="$(printf '%s' "$input" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("command",""))' 2>/dev/null || echo "")"

deny() {
  python3 - "$1" << 'PY'
import sys, json
msg = sys.argv[1]
print(json.dumps({
  "permission": "deny",
  "userMessage": "🛑 Blocked by policy hook: " + msg,
  "agentMessage": "This command is blocked by repository policy: " + msg + ". Do not retry; choose a safe alternative."
}))
PY
  exit 0
}

case "$cmd" in
  *"rm -rf"*|*"rm -fr"*)                          deny "recursive force delete (rm -rf)";;
  *"git push"*"--force"*|*"git push -f"*)         deny "force push";;
  *"git reset --hard"*)                            deny "hard reset discards work";;
  *"git clean -"*f*)                               deny "git clean wipes untracked files";;
  *"git checkout ."*)                              deny "discards all local changes";;
  *"git push"*" main"*|*"git push"*" master"*)    deny "direct push to a protected branch — open a PR instead";;
  *"curl "*"| sh"*|*"curl "*"| bash"*)            deny "pipe-to-shell from the network";;
  *"chmod -R 777"*)                                deny "world-writable permissions";;
esac

echo '{"permission":"allow"}'
exit 0
