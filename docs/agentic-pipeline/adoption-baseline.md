# Stage 1 adoption baseline (documentation-first)

Canonical source followed: `ai-agents-pipeline/docs/agents/adopting-in-another-repo.md`

## Step outcomes

| Doc step | Executed action | Outcome |
|---|---|---|
| Copy `ai-implement.yml`, `ai-review.yml`, `ai-rework.yml` | Copied all 3 files into `excalidraw/.github/workflows/` | Pass |
| Copy `.opencode/agents/` | Copied `implementer.md`, `reviewer.md`, `reworker.md` into `excalidraw/.opencode/agents/` | Pass |
| Add secrets (`SKAINET_TOKEN`, `PERSONAL_ACCESS_TOKEN`) | Not part of Stage 1 local scope | Deferred |
| Configure GitHub Actions settings | Not part of Stage 1 local scope | Deferred |
| Copy `mise.toml` and `lefthook.yml` | Copied both files into Excalidraw root | Pass |
| Run `mise install` | Initial run failed due to untrusted config; succeeded after trust | Mismatch |
| Run `mise run hooks:install` | Succeeded, but changed hook ownership in Husky repo | Mismatch |

## Troubles logged

- `docs/agentic-pipeline/troubles/2026-03-05-1127-mise-config-not-trusted.md`
- `docs/agentic-pipeline/troubles/2026-03-05-1127-mise-trust-sandbox-permission.md`
- `docs/agentic-pipeline/troubles/2026-03-05-1128-hooks-ownership-conflict.md`
