#!/usr/bin/env bash
# beforeMCPExecution hook
# Blocks GitHub MCP PR-write tools targeting excalidraw/excalidraw (upstream).
# Read tools (issue_read, pull_request_read, list, search) are allowed.
#
# Cursor pipes JSON on stdin with MCP call details.
# Responds: { "permission": "allow|deny", "userMessage": "...", "agentMessage": "..." }

set -euo pipefail
input="$(cat)"

result="$(python3 - "$input" << 'PY'
import json
import re
import sys

ALLOWED_REPO = "chuysmans/excalidraw"
BLOCKED_REPO = "excalidraw/excalidraw"

PR_WRITE_PATTERNS = re.compile(
    r"(pull_request.*create|create.*pull_request|pull_request.*update|"
    r"update.*pull_request|merge.*pull_request|pull_request.*merge|"
    r"pull_request_create|create_pull_request|update_pull_request|"
    r"merge_pull_request|pull_request_write|pull_request$)",
    re.I,
)

READ_PATTERNS = re.compile(
    r"(issue_read|pull_request_read|pull_request_get|get_pull_request|"
    r"list_pull|search_|get_issue|issue_get|repo_get|list_issue|read_)",
    re.I,
)


def deny(msg):
    print(json.dumps({"action": "deny", "message": msg}))
    sys.exit(0)


def allow():
    print("allow")
    sys.exit(0)


try:
    data = json.loads(sys.argv[1])
except (json.JSONDecodeError, IndexError):
    allow()

tool_name = (
    data.get("toolName")
    or data.get("tool_name")
    or data.get("name")
    or ""
)
arguments = data.get("arguments") or data.get("args") or data.get("input") or {}
if isinstance(arguments, str):
    try:
        arguments = json.loads(arguments)
    except json.JSONDecodeError:
        arguments = {"raw": arguments}

args_json = json.dumps(arguments)

if READ_PATTERNS.search(tool_name):
    allow()

if not PR_WRITE_PATTERNS.search(tool_name):
    allow()

targets_upstream = (
    BLOCKED_REPO in args_json
    or (
        re.search(r'"owner"\s*:\s*"excalidraw"', args_json)
        and re.search(r'"repo"\s*:\s*"excalidraw"', args_json)
    )
    or re.search(r'"repository"\s*:\s*"excalidraw/excalidraw"', args_json)
)

if targets_upstream:
    deny(
        "GitHub MCP PR write to excalidraw/excalidraw is blocked — "
        f"use {ALLOWED_REPO} only"
    )

repo = arguments.get("repo") or arguments.get("repository")
owner = arguments.get("owner")
if isinstance(repo, str) and "/" in repo:
    owner_from_repo, repo_name = repo.split("/", 1)
    owner = owner or owner_from_repo
    repo = repo_name

if owner and repo:
    full = f"{owner}/{repo}"
elif isinstance(arguments.get("repo") or arguments.get("repository"), str):
    full = arguments.get("repo") or arguments.get("repository")
else:
    full = None

if full == ALLOWED_REPO:
    allow()

if full:
    deny(f"GitHub MCP PR write must target {ALLOWED_REPO}, got {full!r}")

deny(f"GitHub MCP PR write must explicitly target {ALLOWED_REPO}")
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
  "agentMessage": "This MCP call is blocked by fork-only PR policy: " + msg + ". Target chuysmans/excalidraw only."
}))
PY
exit 0
