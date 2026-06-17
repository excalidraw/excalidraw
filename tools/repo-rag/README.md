# Repo RAG

Full-repo retrieval for **excalidraw-tf** — AST-aware TypeScript chunking, hybrid BM25 + vector search. **Local-first** production profile: `cuda-qwen0.6b-1024` (GPU reembed from `gemini-2` secondary). Per-profile indexes live under `data/indexes/{profile}/` (legacy flat `data/lancedb/` still works when `data/indexes/` is empty).

Separate from [`tools/graph-layout-rag`](../graph-layout-rag) (external graph-drawing papers).

**Agent skill:** [.agents/skills/repo-rag/SKILL.md](../../.agents/skills/repo-rag/SKILL.md)

## Setup

Requires Python 3.11+ and [uv](https://github.com/astral-sh/uv).

```bash
cd tools/repo-rag
uv sync
cp .env.example .env
# Edit .env — set RAG_EMBED_PROFILE=cuda-qwen0.6b-1024 (default) or gemini-2 for secondary build
```

## Local-first embedding

1. **Mac:** build secondary `gemini-2` index (~$0.42, ~10k chunks): `RAG_EMBED_PROFILE=gemini-2 uv run repo-rag index --force --rebuild`
2. **GPU reembed:** `RAG_GPU_TOOL=tools/repo-rag tools/repo-rag/scripts/gpu_dense_reembed.sh`
3. **Query:** `yarn repo-rag:query "…" --embed-profile cuda-qwen0.6b-1024 --json`

The key is read from `tools/repo-rag/.env` on every CLI run (gitignored). If `.env` is missing, **`.env.example` is used as fallback**. Shell `export OPENAI_API_KEY=...` overrides both.

For secrets, prefer copying the template: `cp .env.example .env` and edit `.env` only.

## Commands (from repo root)

```bash
yarn repo-rag:index    # harvest + chunk + embed + index (incremental)
yarn repo-rag:watch    # live re-embed changed files on save (needs --extra watch)
yarn repo-rag:query "how does compound pipeline layout work" --top 8 --json
yarn repo-rag:status   # chunk counts, model, token/cost totals
```

The JSON-first explorer also exposes `search`, `symbol`, `neighbors`, `read`, `context`, and `explain`. The SQLite graph and BM25 commands remain available when embedding providers are offline.

Direct CLI:

```bash
cd tools/repo-rag
uv run repo-rag index
uv run repo-rag index --force      # re-embed all files
uv run repo-rag index --rebuild    # drop indexes and rebuild from scratch
uv run repo-rag query "terraformPipelineLayoutCompound" --top 5 --json
uv run repo-rag query "preset loader" --source-type handoff --json
uv run repo-rag harvest            # manifest only, no API calls
```

## Live watch (keep the index fresh)

`repo-rag watch` runs a foreground daemon that re-embeds changed files **as you save**, so search always reflects the current tree without a manual re-index:

```bash
cd tools/repo-rag
uv sync --extra watch          # one-time: installs watchfiles
yarn repo-rag:watch            # or: uv run --extra watch repo-rag watch
```

How it behaves:

- **Per-save reindex is incremental** — only files whose `sha256` changed are re-chunked and re-embedded (vector + BM25), typically within ~1–4s of a save. Saves are debounced.
- **The graph is deferred** — the symbol/import/call graph is a full-file scan (~6–8s), so it is _not_ rebuilt on every save; it reconciles once editing goes idle (~15s) or on the next `repo-rag index`.
- **The embed profile is pinned** to whatever the existing index was built with (read from `data/ingest_state.json`). The watcher never re-resolves the profile from the environment, so it can't silently fall back to a weaker model mid-session. Build an index first (`repo-rag index --force --rebuild --embed-profile <profile>`) before watching.
- **Git-tracked only** — like the indexer, harvest is seeded from `git ls-files`. Edits to tracked files are picked up live; a brand-new file is only indexed after `git add`.

Querying while the watcher runs is safe (LanceDB is versioned; the per-save write is quick).

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Required for OpenAI backend; optional when `RAG_EMBED_BACKEND=auto` (falls back to local) |
| `RAG_EMBED_BACKEND` | `auto` | `auto` \| `openai` \| `local` |
| `REPO_RAG_EMBED_BACKEND` | — | Override backend for repo-rag only |
| `REPO_RAG_EMBED_MODEL` | `text-embedding-3-large` | OpenAI embedding model |
| `REPO_RAG_EMBED_DIMS` | `3072` | Vector dimensions (1024 optional) |
| `REPO_RAG_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, … |
| `REPO_RAG_LOG` | off | Set `1` to append logs to `data/repo-rag.log` |
| `REPO_RAG_WORKERS` | `8` (up to 16) | Parallel workers for chunking + embed API |

## Parallel indexing

Indexing uses a **3-phase pipeline**:

1. **Parallel chunk** — read + AST-parse files concurrently
2. **Parallel embed** — multiple OpenAI embedding requests in flight
3. **Bulk upsert** — write all chunks to LanceDB + BM25 (not per-file)

```bash
yarn repo-rag --workers 12 index     # flags before subcommand
# or in .env: REPO_RAG_WORKERS=12
```

Default workers: `min(16, cpu_count * 2)`. Use `--workers 1` to disable parallelism (debugging).

## Logging / monitoring

Logs go to **stderr** by default. Useful during long indexes:

```bash
yarn repo-rag:index --log              # flags before subcommand
yarn repo-rag:index -v --log           # verbose + log file
# or set REPO_RAG_LOG=1 in .env (always logs to data/repo-rag.log)

cd tools/repo-rag && uv run repo-rag --log index
cd tools/repo-rag && uv run repo-rag -v --log query "pipeline layout" --top 5
```

Example index output:

```
2026-06-10 14:02:01 INFO repo_rag.index index start mode=incremental embed_model=text-embedding-3-large dims=3072 previously_indexed=0
2026-06-10 14:02:05 INFO repo_rag.embed embedding 142 texts in 3 batch(es) model=text-embedding-3-large dims=3072
2026-06-10 14:02:06 INFO repo_rag.embed embed batch 1/3 size=64 tokens=28450 total_tokens=28450
2026-06-10 14:02:30 INFO repo_rag.index index progress 25/876 files, 312 chunks written, 84200 tokens
2026-06-10 14:15:00 INFO repo_rag.index index done files=876 skipped=0 chunks_written=4200 total_chunks=4200 tokens=2100000 embed_requests=66 run_cost_usd=0.2730 elapsed_s=780.2
```

Set `REPO_RAG_LOG=1` in `.env` to always write the log file without passing `--log`.

Remote OpenAI indexing logs include estimated tokens, request latency, batch TPM, rolling and cumulative TPM, active and peak concurrency, progress, and ETA.

## Agent workflow

```
1. yarn repo-rag:query "<task>" --top 8 --json
2. Read full files from file_path + start_line in results
3. Cross-check docs/*-handoff.md for invariants
4. Run targeted tests from TERRAFORM_TEST_COVERAGE.md
```

## What gets indexed

- Handoff docs: `CLAUDE.md`, `README.md`, `docs/*.md`, `REGION_SUBNET_VERTICAL_BANDS_PLAN.md`
- Terraform code: `packages/excalidraw/components/terraform*`
- Core packages: `packages/{excalidraw,element,common,math,utils}/**`
- App layer: `excalidraw-app/`, `functions/`, `packages/backend/`
- Tests: `**/*.test.{ts,tsx}`

Excluded: `node_modules/`, `dist/`, snapshots, lockfiles, binaries.

## Cost (text-embedding-3-large)

- Initial full index: ~$0.26–$0.39 for this repo
- Per query: negligible
- `yarn repo-rag:status` shows cumulative tokens and estimated USD

## Gitignored data

- `data/indexes/{profile}/` — per-profile vector + BM25 + ingest state
- `data/lancedb/`, `data/bm25/` — legacy flat layout (fallback)
- `data/manifest.json`, `data/graph.sqlite`
- `.venv/`
