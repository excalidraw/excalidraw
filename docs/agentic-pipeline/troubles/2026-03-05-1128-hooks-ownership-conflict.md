# Trouble: hooks ownership conflict with existing Husky setup

## Documented Step
From `ai-agents-pipeline/docs/agents/adopting-in-another-repo.md` and repo README:
- Copy `mise.toml` + `lefthook.yml`
- Run `mise run hooks:install`

## Observed Failure
The command installed a Lefthook-managed `.git/hooks/pre-commit`, taking primary hook ownership. The target repo (`excalidraw`) already uses Husky.

## Evidence (command + output)
Command:
```bash
cd excalidraw
mise run hooks:install
sed -n '1,40p' .git/hooks/pre-commit
```
Output excerpt:
```text
[hooks:install] ... lefthook install
sync hooks: ✔️ (pre-commit)
...
call_lefthook run "pre-commit" "$@"
```

## Root Cause
The documented hook install flow assumes Lefthook can own git hooks. In a Husky-based repo, this changes hook ownership and may conflict with existing expectations.

## Fix Applied
Restored Husky as primary hook owner and delegated workflow linting to Lefthook from Husky:
```bash
git config core.hooksPath .husky
```
Updated `.husky/pre-commit`:
```sh
#!/bin/sh
# Keep code hooks in Husky; add workflow linting via Lefthook.
# yarn lint-staged
mise exec -- lefthook run pre-commit "$@"
```

## Validation
- `git config --get core.hooksPath` returns `.husky`.
- Running `.husky/pre-commit` with staged workflow files executes Lefthook + actionlint successfully.
