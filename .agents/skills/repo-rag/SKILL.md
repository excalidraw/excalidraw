---
name: repo-rag
description: Query local full-repo RAG over excalidraw-tf code and handoff docs. Use when onboarding to this repo, finding where Terraform import/layout code lives, tracing pipeline compound layout, preset loaders, dependency-cruiser boundaries, or any "where is X implemented?" question. Hybrid BM25 + embeddings via shared rag-common profiles (OpenAI, Gemini Embedding 2, local MLX). SQLite import/call graph for symbol lookup and neighbors. After search, read full source files from file_path + start_line.
---

# Repo RAG

Local hybrid search (BM25 + vector) over **this repo's** TypeScript, tests, and markdown handoffs. AST-chunked at function/class boundaries. **Production query profile:** `cuda-qwen0.6b-1024` (GPU reembed from `gemini-2` secondary). Per-profile indexes under `data/indexes/{profile}/`.

A **SQLite import/call graph** (`data/graph.sqlite`) powers `symbol`, `neighbors`, `read`, `context`, and `explain` — useful for tracing callers and related files without re-querying vectors.

**Not** graph-drawing literature — use skill `graph-layout-rag` / `yarn graph-rag:query` for Sugiyama, ELK, compound-graph papers.

## When to use

- Onboarding: "how does terraform import work?", "where is pipeline layout?"
- Exact symbols: `terraformPipelineLayoutCompound`, `layoutTerraformFromSources`, `terraformSceneApply`
- Handoff docs: preset SQLite hydrate, D1 cache, compound vs classic pipeline
- Architecture: import boundaries (`terraformLayoutCore` must not import UI)
- Tracing imports/callers: `neighbors`, `context` after a hybrid seed hit
- Before reading 100+ `terraform*.ts` files — **search first**

## When NOT to use

- Graph layout algorithm research → `graph-layout-rag`
- Code changed since last index → re-index first (`yarn repo-rag:index`)
- No index yet → run setup + index once (see below)

## Agent workflow (recommended)

```
1. Search    → yarn repo-rag:query "<task>" --top 8 --json
2. Shortlist → pick by score, source_type, file_path; note start_line
3. Graph     → uv run repo-rag symbol|neighbors|context … (see Explorer below)
4. Deep read → Read full file(s) at file_path (+ start_line for context)
5. Invariants → cross-check docs/*-handoff.md for constraints
6. Tests     → run targets from TERRAFORM_TEST_COVERAGE.md
```

For multi-file tasks, prefer **`context`** (hybrid seeds + 1-hop graph, token-budgeted) before manually chasing imports.

**Query returns excerpts only** (~600 chars). Always deep-read source for edits.

## One-time setup

```bash
cd tools/repo-rag && uv sync
cp .env.example .env   # RAG_EMBED_PROFILE=cuda-qwen0.6b-1024 by default
# Build secondary once: RAG_EMBED_PROFILE=gemini-2 uv run repo-rag index --force --rebuild
# GPU reembed: RAG_GPU_TOOL=tools/repo-rag tools/repo-rag/scripts/gpu_dense_reembed.sh
yarn repo-rag:status   # confirm chunks_lance > 0 and graph counts
```

Key persists in `tools/repo-rag/.env` (gitignored). Requires network for cloud embed index + query.

## Embedding profiles

List profiles: `cd tools/repo-rag && uv run repo-rag embed profiles`

| Profile | Backend | Dims | Use when |
| --- | --- | --- | --- |
| `cuda-qwen0.6b-1024` | local | 1024 | **Production query** — GPU reembed |
| `gemini-2` | gemini | 3072 | Secondary cloud build (~$0.42 this repo) |
| `openai-large` | openai | 1024 | Smaller OpenAI vectors |
| `gemini` | gemini | 768 | `gemini-embedding-001` (older) |
| `mlx-qwen4b` | local | 1024 | Free Apple Silicon ingest |
| `qwen3-code` | local | 2560 | Code-specialized Qwen3-4B native dims |

Set profile in `.env` or pass on **both** index and query:

```bash
RAG_EMBED_PROFILE=gemini-2 uv run repo-rag index --force --rebuild
RAG_EMBED_PROFILE=cuda-qwen0.6b-1024 uv run repo-rag query "compound pipeline" --top 8 --json
```

**Per-profile indexes:** `data/indexes/{profile}/` (lancedb + bm25 + ingest_state.json). Legacy flat `data/lancedb/` still works when `data/indexes/` is empty.

**Gemini-2 cost (this repo, ~2M tokens):** ~$0.42 standard API, ~$0.21 Batch API. Set `GEMINI_EMBED_COST_PER_MILLION=0.20` in `.env` for accurate `status` cost display (default assumes gemini-001 pricing).

## Commands (from repo root)

```bash
yarn repo-rag:query "compound pipeline sibling columns" --top 8 --json
yarn repo-rag:query "terraformPipelineLayoutCompound" --top 5 --json
yarn repo-rag:query "preset loader D1 cache" --source-type handoff --json
yarn repo-rag:query "dependency-cruiser terraformLayoutCore" --path-contains pipeline --json

yarn repo-rag:status
yarn repo-rag:index              # incremental (changed files only)
yarn repo-rag:index --force      # re-embed all
```

Global CLI flags go **before** the subcommand:

```bash
yarn repo-rag --workers 12 index   # parallel chunk + embed
yarn repo-rag -v --log index       # verbose + data/repo-rag.log
```

Or in `.env`: `REPO_RAG_WORKERS=12`, `REPO_RAG_LOG=1`

### Explorer (JSON-first; direct CLI)

No yarn shortcuts — run from `tools/repo-rag`:

```bash
uv run repo-rag search "pipeline layout compound" --top 8   # hybrid JSON (alias of query --json)
uv run repo-rag symbol terraformPipelineLayoutCompound     # exact symbol / file lookup
uv run repo-rag neighbors terraformPipelineLayoutCompound --depth 2
uv run repo-rag read terraformPipelineLayoutCompound       # entity + surrounding source lines
uv run repo-rag context "fix sibling column collision in compound layout" --budget 6000
uv run repo-rag explain packages/excalidraw/components/terraformPipelineLayoutCompound.ts
uv run repo-rag eval benchmark                               # Hit@k / MRR / nDCG@k + latency JSON
uv run repo-rag eval benchmark --compare                     # rerank off vs on, with metric delta
```

`symbol`, `neighbors`, `read`, and graph portions of `context` work from the SQLite graph alone. Hybrid `query`/`search` still need a matching embed index (or will fail if none built).

## Query filters

| Flag | Values | Use |
| --- | --- | --- |
| `--source-type` | `handoff`, `terraform`, `code`, `app`, `test`, `doc` | Narrow corpus |
| `--package` | `@excalidraw/excalidraw`, `excalidraw-app`, … | Package scope |
| `--path-contains` | substring | e.g. `pipeline`, `terraformTopology` |
| `--embed-profile` | profile name | Must match index (see `embed profiles`) |
| `--rerank` / `--no-rerank` | flag | Cross-encoder rerank fused candidates (default: `RAG_RERANK_ENABLED` env, off) |
| `--top` | N | Default 8 |

### Reranking (precision boost, opt-in)

"Retrieve wide, rerank narrow": after RRF, a local cross-encoder (`bge-reranker-v2-m3`, MPS/CPU, no API) can reorder candidates. Enable per-query with `--rerank` or globally with `RAG_RERANK_ENABLED=1`. Degrades to a plain top-k slice if the model/dep is unavailable. Adds a `rerank_score` to JSON output.

- **Measured on this repo (gemini-2 index):** reranking lifts MRR 0.637→0.684 / nDCG 0.68→0.70 **but only because** search feeds the reranker `file_path + symbol + text`; on raw chunk text alone it _hurt_ (nDCG→0.61). It ~2× latency — keep it off by default, use for precision-sensitive lookups.
- Re-validate after any embed-profile or query-set change: `RAG_RERANK_ENABLED=1 uv run repo-rag eval benchmark --compare`.

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
| --- | --- | --- |
| Handoffs | `CLAUDE.md`, `README.md`, `docs/*.md`, `REGION_SUBNET_VERTICAL_BANDS_PLAN.md` | `handoff` |
| Terraform | `packages/excalidraw/components/terraform*` | `terraform` |
| Core | `packages/{excalidraw,element,common,math,utils}/**` | `code` |
| App / backend | `excalidraw-app/`, `functions/`, `packages/backend/` | `app` |
| Tooling / CI | `tools/`, `scripts/`, `dev-docs/`, `.github/workflows/` | `code` / `doc` / `handoff` |
| Tests | `**/*.test.{ts,tsx}` | `test` |

Excluded: `node_modules/`, `dist/`, snapshots, `tools/*/data/`, `packages/backend/terraform/` fixtures.

Typical index: **~876 files**, **~10k chunks**, **~2M embed tokens**.

## Contextual Retrieval (opt-in, index-time)

Anthropic's Contextual Retrieval: prepend an LLM-generated 1-2 sentence situating blurb to each chunk before embedding **and** BM25 (contextual embeddings + contextual BM25). ~35–49% fewer retrieval failures in Anthropic's eval.

```bash
uv sync --extra contextual            # Claude SDK for the LLM path (else heuristic)
ANTHROPIC_API_KEY=... uv run repo-rag index --force --rebuild --contextual
```

Uses `claude-haiku-4-5` with prompt caching on the file body (cheap). Without a key it falls back to a deterministic heuristic (the file's leading comment). Gated, default off, recorded in `ingest_state`. Re-validate the lift with `eval benchmark --compare` after rebuilding.

## MCP server (agentic seed→navigate)

Expose repo-rag to an agent so it can iterate (search → symbol/neighbors → read) instead of one-shotting:

```bash
uv sync --extra mcp
uv run repo-rag mcp            # stdio; tools: search, symbol, neighbors, context, read
```

The index stays the fast seed + graph layer; the agent drives the loop. This is the 2026 agentic-search pattern (don't replace the index — make it iterable).

## Re-index after edits

```bash
yarn repo-rag:index   # SHA256 incremental — only changed files
```

After changing embed profile/model/dims, use `--force --rebuild`.

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
- [docs/pipeline-semantic-placement-agent-handoff.md](../../../docs/pipeline-semantic-placement-agent-handoff.md) — semantic topology / placement audit
- [docs/terraform-pipeline-compound-import-guide.md](../../../docs/terraform-pipeline-compound-import-guide.md) — compound algorithm phases
- [docs/terraform-pipeline-import-debug-handoff.md](../../../docs/terraform-pipeline-import-debug-handoff.md) — import flow + profiler
- [docs/pipeline-compound-layout-agent-handoff.md](../../../docs/pipeline-compound-layout-agent-handoff.md) — compound layout code map
- [docs/terraform-import-presets-agent-handoff.md](../../../docs/terraform-import-presets-agent-handoff.md) — presets + fixtures
- [packages/excalidraw/components/TERRAFORM_TEST_COVERAGE.md](../../../packages/excalidraw/components/TERRAFORM_TEST_COVERAGE.md) — test map

## Pair with graph-layout-rag

| Question type                                 | Tool                      |
| --------------------------------------------- | ------------------------- |
| Where is X in this codebase?                  | **repo-rag** (this skill) |
| Why is pipeline tall? Sugiyama? ELK compound? | **graph-layout-rag**      |

Use `gemini-2` on both if you want the same embedding model family; chunking still differs (AST/code vs PDF structure-aware).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `No results` | Run `yarn repo-rag:index`; check `yarn repo-rag:status` |
| `OPENAI_API_KEY is required` | Set key in `tools/repo-rag/.env`, or use `RAG_EMBED_BACKEND=local` / `mlx-qwen4b` |
| Embed model/profile mismatch | `yarn repo-rag:index --force --rebuild` with matching `--embed-profile` |
| Gemini auth errors | Set `GEMINI_API_KEY` or `GOOGLE_API_KEY`; Vertex: `GOOGLE_GENAI_USE_VERTEXAI=true` |
| Slow first index | Normal; use `--workers 12` or `REPO_RAG_WORKERS=12` |
| Monitor progress | `REPO_RAG_LOG=1` or `yarn repo-rag -v --log index` |

## Related docs

- [tools/repo-rag/README.md](../../../tools/repo-rag/README.md) — setup, cost, parallelism
- [tools/repo-rag/docs/SOTA-2026-code-retrieval.md](../../../tools/repo-rag/docs/SOTA-2026-code-retrieval.md) — research synthesis, reranking findings, roadmap
- [CLAUDE.md](../../../CLAUDE.md) — monorepo overview + repo-rag pointer
- [tools/repo-rag/eval/queries.json](../../../tools/repo-rag/eval/queries.json) — eval query set

## Do not

- Commit `tools/repo-rag/.env`, `data/lancedb/`, `data/bm25/`, or `data/graph.sqlite`
- Treat query `excerpt` as full source — always Read the file
- Use repo-rag for external layout papers — use graph-layout-rag
- Mix embed profiles between index and query without rebuilding
