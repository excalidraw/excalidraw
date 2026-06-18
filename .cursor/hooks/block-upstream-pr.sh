#!/usr/bin/env bash
# beforeShellExecution hook
# Blocks PR/push writes targeting excalidraw/excalidraw (upstream).
# All PRs and pushes must go to chuysmans/excalidraw (origin/fork).
#
# Cursor pipes JSON on stdin: { "command": "...", ... }
# Responds: { "permission": "allow|deny", "userMessage": "...", "agentMessage": "..." }

set -euo pipefail
input="$(cat)"

result="$(python3 - "$input" << 'PY'
import json
import re
import sys

ALLOWED_REPO = "chuysmans/excalidraw"
BLOCKED_REPO = "excalidraw/excalidraw"
BLOCKED_URL = "github.com/excalidraw/excalidraw"

try:
    data = json.loads(sys.argv[1])
except (json.JSONDecodeError, IndexError):
    print("allow")
    sys.exit(0)

cmd = data.get("command", "") or ""


def deny(msg):
    print(json.dumps({"action": "deny", "message": msg}))
    sys.exit(0)


def allow():
    print("allow")
    sys.exit(0)


if not cmd.strip():
    allow()

targets_upstream = BLOCKED_REPO in cmd or BLOCKED_URL in cmd

if re.search(r"\bgit push\b.*\bupstream\b", cmd):
    deny("git push to upstream is blocked — push to origin (chuysmans/excalidraw) only")

if re.search(r"\bgit push\b", cmd) and targets_upstream:
    deny("git push to excalidraw/excalidraw is blocked — use origin (chuysmans/excalidraw)")

pr_write = re.search(
    r"\bgh pr (create|merge|edit|ready|review|close|reopen|comment)\b", cmd
)
gh_api_pulls_write = re.search(r"\bgh api\b.*\bpulls\b", cmd) and re.search(
    r"\b(-X\s+POST|-X\s+PATCH|-X\s+PUT|-f\b|--method\s+(POST|PATCH|PUT))\b", cmd, re.I
)

if targets_upstream and (pr_write or gh_api_pulls_write):
    deny("PR writes to excalidraw/excalidraw are blocked — use --repo chuysmans/excalidraw")

if re.search(r"\bgh pr create\b", cmd):
    repo_match = re.search(r"--repo\s+(\S+)", cmd)
    if repo_match:
        repo = repo_match.group(1).strip("'\"")
        if repo != ALLOWED_REPO:
            deny(f"gh pr create --repo must be {ALLOWED_REPO}, got {repo!r}")

allow()
PY
)"

if [[ "$result" == allow ]]; then
  echo '{"permission":"allow"}'
  exit 0
fi

message="$(printf '%s' "$result" | python3 -c 'import sys,json; print(json.load(sys.stdin)["message"])')"
python3 - "$message" << 'PY'
import sys, json
msg = sys.argv[1]
print(json.dumps({
  "permission": "deny",
  "userMessage": "🛑 Blocked by fork policy: " + msg,
  "agentMessage": "This command is blocked by fork-only PR policy: " + msg + ". Target chuysmans/excalidraw only. Do not retry against excalidraw/excalidraw."
}))
PY
exit 0
