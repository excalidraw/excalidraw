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
| Run `mise install` | Tools installed and validated with `actionlint` | Pass |
| Hook wiring for existing Husky repo | Kept Husky as owner and invoked Lefthook via `.husky/pre-commit` | Pass |
