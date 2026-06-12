---
name: repo-rag
description: Query local full-repo RAG over excalidraw-tf code and handoff docs. Use when onboarding to this repo, finding where Terraform import/layout code lives, tracing pipeline compound layout, preset loaders, dependency-cruiser boundaries, or any "where is X implemented?" question. Hybrid BM25 + embeddings (OpenAI text-embedding-3-large, local MiniLM fallback). After search, read full source files from file_path + start_line.
---

# Repo RAG

Local hybrid search (BM25 + vector) over **this repo's** TypeScript, tests, and markdown handoffs. AST-chunked at function/class boundaries. Embeddings: OpenAI `text-embedding-3-large` by default; `RAG_EMBED_BACKEND=auto` falls back to local `all-MiniLM-L6-v2` without a valid API key.

**Not** graph-drawing literature — use skill `graph-layout-rag` / `yarn graph-rag:query` for Sugiyama, ELK, compound-graph papers.

## When to use

- Onboarding: "how does terraform import work?", "where is pipeline layout?"
- Exact symbols: `terraformPipelineLayoutCompound`, `layoutTerraformFromSources`, `terraformSceneApply`
- Handoff docs: preset SQLite hydrate, D1 cache, compound vs classic pipeline
- Architecture: import boundaries (`terraformLayoutCore` must not import UI)
- Before reading 100+ `terraform*.ts` files — **search first**

## When NOT to use

- Graph layout algorithm research → `graph-layout-rag`
- Code changed since last index → re-index first (`yarn repo-rag:index`)
- No index yet → run setup + index once (see below)

## Agent workflow (recommended)

```
1. Search   → yarn repo-rag:query "<task>" --top 8 --json
2. Shortlist → pick by score, source_type, file_path; note start_line
3. Deep read → Read full file(s) at file_path (+ start_line for context)
4. Invariants → cross-check docs/*-handoff.md for constraints
5. Tests      → run targets from TERRAFORM_TEST_COVERAGE.md
```

**Query returns excerpts only** (~600 chars). Always deep-read source for edits.

## One-time setup

```bash
cd tools/repo-rag && uv sync
cp .env.example .env   # OPENAI_API_KEY optional with RAG_EMBED_BACKEND=auto
yarn repo-rag:index    # OpenAI ~$0.30 first run; local fallback is free
yarn repo-rag:status   # confirm chunks_lance > 0
```

Key persists in `tools/repo-rag/.env` (gitignored). Requires network for index + query.

## Commands (from repo root)

```bash
yarn repo-rag:query "compound pipeline sibling columns" --top 8 --json
yarn repo-rag:query "terraformPipelineLayoutCompound" --top 5 --json
yarn repo-rag:query "preset loader D1 cache" --source-type handoff --json
yarn repo-rag:query "dependency-cruiser terraformLayoutCore" --path-contains pipeline --json

yarn repo-rag:status
yarn repo-rag:index              # incremental (changed files only)
yarn repo-rag:index --force      # re-embed all (via: cd tools/repo-rag && uv run repo-rag index --force)
```

Global CLI flags go **before** the subcommand:

```bash
yarn repo-rag --workers 12 index   # parallel chunk + embed
yarn repo-rag -v --log index       # verbose + data/repo-rag.log
```

Or in `.env`: `REPO_RAG_WORKERS=12`, `REPO_RAG_LOG=1`

## Query filters

| Flag | Values | Use |
|------|--------|-----|
| `--source-type` | `handoff`, `terraform`, `code`, `app`, `test`, `doc` | Narrow corpus |
| `--package` | `@excalidraw/excalidraw`, `excalidraw-app`, … | Package scope |
| `--path-contains` | substring | e.g. `pipeline`, `terraformTopology` |
| `--top` | N | Default 8 |

## Query output (`--json`)

```json
{
  "query": "compound pipeline layout",
  "results": [
    {
      "score": 0.032,
      "file_path": "packages/excalidraw/components/terraformPipelineLayoutCompound.ts",
      "symbol": "layoutCompoundPipeline",
      "source_type": "terraform",
      "package": "@excalidraw/excalidraw",
      "start_line": 42,
      "chunk_id": "packages/excalidraw/components/terraformPipelineLayoutCompound.ts:3",
      "excerpt": "export function layoutCompoundPipeline(...",
      "tags": ["terraform", "pipeline"]
    }
  ]
}
```

## Indexed corpus

| Tier | Paths | `source_type` |
|------|-------|---------------|
| Handoffs | `CLAUDE.md`, `README.md`, `docs/*.md`, `REGION_SUBNET_VERTICAL_BANDS_PLAN.md` | `handoff` |
| Terraform | `packages/excalidraw/components/terraform*` | `terraform` |
| Core | `packages/{excalidraw,element,common,math,utils}/**` | `code` |
| App | `excalidraw-app/`, `functions/` | `app` |
| Tests | `**/*.test.{ts,tsx}` | `test` |

Excluded: `node_modules/`, `dist/`, snapshots, `packages/backend/terraform/` fixtures.

## Re-index after edits

```bash
yarn repo-rag:index   # SHA256 incremental — only changed files
```

After changing embed model/dims, use `--force` or `--rebuild`.

## Example queries

```bash
yarn repo-rag:query "terraform import pipeline flow scene apply" --top 8 --json
yarn repo-rag:query "terraformPipelineLayoutCompound sibling columns" --top 5 --json
yarn repo-rag:query "KV layout cache preset import" --source-type handoff --json
yarn repo-rag:query "semantic topology placement subnet" --path-contains terraformTopology --json
yarn repo-rag:query "layout worker client parity" --top 5 --json
```

## Pair with handoff docs

After RAG hits, read these for invariants (not always in top snippets):

- [docs/terraform-pipeline-import-agent-guide.md](../../../docs/terraform-pipeline-import-agent-guide.md) — **start here**: pipeline import + Compact/Full, Classic/Compound, Stacked/Packed
- [docs/terraform-pipeline-compound-import-guide.md](../../../docs/terraform-pipeline-compound-import-guide.md) — compound algorithm phases
- [docs/terraform-pipeline-import-debug-handoff.md](../../../docs/terraform-pipeline-import-debug-handoff.md) — import flow + profiler
- [docs/pipeline-compound-layout-agent-handoff.md](../../../docs/pipeline-compound-layout-agent-handoff.md) — compound layout code map
- [docs/terraform-import-presets-agent-handoff.md](../../../docs/terraform-import-presets-agent-handoff.md) — presets + fixtures
- [packages/excalidraw/components/TERRAFORM_TEST_COVERAGE.md](../../../packages/excalidraw/components/TERRAFORM_TEST_COVERAGE.md) — test map

## Pair with graph-layout-rag

| Question type | Tool |
|---------------|------|
| Where is X in this codebase? | **repo-rag** (this skill) |
| Why is pipeline tall? Sugiyama? ELK compound? | **graph-layout-rag** |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No results` | Run `yarn repo-rag:index`; check `yarn repo-rag:status` |
| `OPENAI_API_KEY is required` | Set key in `tools/repo-rag/.env` |
| Embed model mismatch | `yarn repo-rag:index --force` |
| Slow first index | Normal; use `--workers 12` or `REPO_RAG_WORKERS=12` |
| Monitor progress | `REPO_RAG_LOG=1` or `yarn repo-rag -v --log index` |

## Related docs

- [tools/repo-rag/README.md](../../../tools/repo-rag/README.md) — setup, cost, parallelism
- [CLAUDE.md](../../../CLAUDE.md) — monorepo overview + repo-rag pointer
- [tools/repo-rag/eval/queries.json](../../../tools/repo-rag/eval/queries.json) — eval query set

## Do not

- Commit `tools/repo-rag/.env`, `data/lancedb/`, or `data/bm25/`
- Treat query `excerpt` as full source — always Read the file
- Use repo-rag for external layout papers — use graph-layout-rag
