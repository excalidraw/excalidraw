#!/usr/bin/env bash
# no-private-paths — no operator path in a file anyone can read.
#
# This repository is PUBLIC. A pasted `/healthz` output, a stack trace, a shell
# transcript or a `pwd` in a fix note all carry the machine's real paths — the
# user's name, the checkout layout, sometimes a hostname. It is not a credential
# and it is not a secret, which is exactly why nobody notices it.
#
# Found the hard way: a ticket's Resolution quoted
#   {"ok":true,"root":"/home/<user>/CodeP/excalidraw"}
# and a plan was linked by a relative path reaching out of the repository into the
# private home. Neither was malicious; both were pasted output.
#
#   bin/guards/no-private-paths.sh          # check the tracked tree
#   bin/guards/no-private-paths.sh --staged # check only what is staged (a hook)
#
# Deliberate, documented exceptions are marked `guard-allow` on the line.
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# What a private path looks like: a real home directory, or a reach out of the repo.
PATTERN='/home/[a-z][a-z0-9._-]+/|/Users/[a-z][a-z0-9._-]+/|[A-Za-z]:\\Users\\'
# Placeholders are the public way to say the same thing.
ALLOWED='\$HOME|<user>|<repo root>|<path>|/home/user/'

if [ "${1:-}" = "--staged" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACMR)
else
  FILES=$(git ls-files)
fi

bad=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue
  # Lockfiles, built output and vendored trees are not ours to police.
  case "$file" in
    *node_modules/*|yarn.lock|*/build/*|desktop/app/*|*.png|*.woff2|*.map) continue ;;
  esac
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    case "$hit" in *guard-allow*) continue ;; esac
    echo "✖ $file"
    echo "    $hit"
    bad=1
  done < <(grep -InE "$PATTERN" "$file" 2>/dev/null | grep -vE "$ALLOWED" | head -3)
done <<<"$FILES"

if [ "$bad" -eq 0 ]; then
  echo "✔ no private paths in tracked files"
fi
exit $bad
