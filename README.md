# Excalidraw × Cursor — 201 Demo Scaffold

A drop-in `.cursor/` configuration for the `excalidraw/excalidraw` monorepo that turns the repo into a **governed AI engineering platform**. This is the artifact behind the Cursor 201 deep-dive: every file here exists to make a 500-engineer org's AI usage _consistent, safe, and auditable_.

## What's in here

```
AGENTS.md                         Always-on repo context (architecture, package boundaries, DoD)
.cursor/
├── rules/
│   ├── fork-only-prs.mdc          Always-on — PRs/pushes target chuysmans/excalidraw only
│   ├── react-components.mdc       Auto-attaches on **/*.tsx — React 19 + action-system conventions
│   ├── core-packages.mdc          Auto-attaches on packages/element|math|common — boundary rules
│   └── testing.mdc                Auto-attaches on *.test.* — Vitest conventions
├── commands/
│   └── ship-feature.md            /ship-feature — the ticket→plan→code→test→PR workflow
├── hooks.json                     Wires the lifecycle hooks below
├── hooks/
│   ├── block-dangerous.sh         beforeShellExecution — DENIES rm -rf, force-push, push to main…
│   ├── block-upstream-pr.sh       beforeShellExecution — DENIES PR/push to excalidraw/excalidraw
│   ├── block-upstream-mcp.sh      beforeMCPExecution — DENIES GitHub MCP PR writes to upstream
│   ├── redact-secrets.sh          beforeReadFile — withholds .env/.pem/secrets from the model
│   └── format-and-audit.sh        afterFileEdit — Prettier + appends to ai-edit-audit.log
└── mcp.json                       GitHub remote MCP server (issues + PRs) — no install, OAuth
```

## The layered mental model (what to say out loud)

> Rules and skills change **what the agent knows**. MCP changes **what the agent can do**. Hooks change **what the agent is allowed to do** — deterministically, model can't override.

## Run the demo

1. Open the excalidraw repo in Cursor with this `.cursor/` dropped in. Restart so hooks load.
2. Connect the GitHub MCP server: Cursor will prompt an OAuth login the first time the agent uses it — no PAT, no Docker. (Confirm under Settings → MCP that `github` is green.)
3. Confirm hooks are live: **Settings → Hooks** shows five registered.
4. `/ship-feature #1234` — agent reads the GitHub issue via MCP, plans in read-only, then implements.
5. Watch `react-components.mdc` auto-attach when it edits a `.tsx`.
6. Let it try a destructive git command → `block-dangerous.sh` **denies it live**.
7. Let it try `gh pr create --repo excalidraw/excalidraw` → `block-upstream-pr.sh` **denies it live**.
8. Open `.cursor/ai-edit-audit.log` → every AI-touched file, timestamped.
9. Agent opens a draft PR on **chuysmans/excalidraw**, linked to the issue ("Closes #1234").
10. Finale: a Background Agent handed a second issue pre-session returns a draft PR with BugBot review.

## Verify the hooks yourself (no Cursor needed)

```bash
echo '{"command":"git push --force origin main"}' | ./.cursor/hooks/block-dangerous.sh   # → deny
echo '{"command":"yarn test"}'                    | ./.cursor/hooks/block-dangerous.sh   # → allow
echo '{"file_path":"excalidraw-app/.env.production"}' | ./.cursor/hooks/redact-secrets.sh # → deny

echo '{"command":"gh pr create --repo excalidraw/excalidraw --title x"}' \
  | ./.cursor/hooks/block-upstream-pr.sh   # → deny
echo '{"command":"gh pr create --repo chuysmans/excalidraw --title x"}' \
  | ./.cursor/hooks/block-upstream-pr.sh   # → allow
echo '{"command":"git push upstream master"}' \
  | ./.cursor/hooks/block-upstream-pr.sh   # → deny
echo '{"command":"gh issue view 1 --repo excalidraw/excalidraw"}' \
  | ./.cursor/hooks/block-upstream-pr.sh   # → allow
```

Hooks parse JSON with `python3` (ubiquitous) — no `jq` dependency.
