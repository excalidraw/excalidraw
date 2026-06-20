# Graph Layout RAG Operations

## Ingest

Checkpointing is automatic after each document batch. Resume interrupted ingest without `--force`:

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag ingest -v 2>&1 | tee -a data/ingest-run.log
```

Use `--force --rebuild` for first full build or after changing embed model, dimensions, backend, or chunk profile.

| Goal | Command |
| --- | --- |
| First build / new embed model | `uv run graph-layout-rag ingest --force --rebuild -v` |
| Resume after interrupt | `uv run graph-layout-rag ingest -v` |
| Re-embed all, keep table | `uv run graph-layout-rag ingest --force` |
| Drop table and start fresh | `uv run graph-layout-rag ingest --rebuild` |

Query and ingest profiles must match.

## Harvest

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag harvest --deep-harvest --target-pdfs 2000 --workers 48 --resume -v
uv run graph-layout-rag harvest verify
uv run graph-layout-rag ingest --force
```

Useful flags:

| Flag | Purpose |
| --- | --- |
| `--deep-harvest` | OpenAlex, arXiv, bibliography, retry, and DOI passes |
| `--target-pdfs 2000` | Stop once enough OK PDFs are present |
| `--target 2800` | Catalog entry ceiling |
| `--workers 48` | Global PDF download budget |
| `--resume` | Skip seed stages and continue discovery |
| `harvest verify` | Validate OK PDFs on disk |
| `--log-file PATH` | Defaults to `data/harvest.log` |

## Embedding Profiles

List profiles:

```bash
uv run graph-layout-rag embed profiles
```

Common profiles:

| Profile | Use when |
| --- | --- |
| `cuda-qwen0.6b-1024` | Production query profile |
| `gemini-2-structure-v1` | Secondary cloud build with structure-aware chunks |
| `openai-large` | Fast cloud ingest |
| `mlx-qwen4b` | Free Apple Silicon ingest |
| `cuda-qwen0.6b-section-v1` | Section metadata A/B |
| `cuda-qwen0.6b-small2big-v1` | Small-to-big chunking A/B |
| `cuda-qwen0.6b-contextual-v1` | Contextual chunk A/B |
| `cuda-qwen4b-1024` / `cuda-qwen4b-2560` | Qwen3-4B CUDA probes |

Per-profile indexes live under `data/indexes/{profile}/`. Use `uv run graph-layout-rag embed indexes` to list local builds.

## Query Behavior

Default retrieval is hybrid: dense + Tantivy BM25 + reciprocal-rank fusion. Results are grouped by canonical paper identity after retrieval.

```bash
uv run graph-layout-rag query "network simplex rank assignment dot" --top 8 --json
uv run graph-layout-rag query "compound graph layout" --tag compound --json
uv run graph-layout-rag query "orthogonal routing separation constraints" --pdf-only --json
```

Filter flags include `--tag`, `--category`, `--pdf-only`, `--source`, and `--year-min`. `--max-per-doc` controls evidence passages per canonical paper result.

Do not add `--rerank` by default; existing benchmarks found lower quality and higher memory pressure.

## Citation Graph

Use related-paper expansion when starting from a known paper:

```bash
uv run graph-layout-rag cite related gansner-tse93 --json
```

Use `canonical_doc_id` for deduplication and evaluation. `doc_id` identifies the winning indexed row, and `alias_doc_ids` can resolve local PDF aliases.

## GPU And Local LLM

Shared GPU helpers live in `tools/rag-common/scripts`. Tool-local scripts are wrappers for stable existing commands.

Local Ollama HyDE and eval LLM arms run on the GPU box, not on the Mac:

```bash
RAG_LLM_BACKEND=ollama
RAG_OLLAMA_HOST=http://127.0.0.1:11434
RAG_OLLAMA_MODEL=gemma4:e4b
RAG_EMBED_PROFILE=cuda-qwen0.6b-1024
RAG_LOCAL_EMBED_DEVICE=cuda
```

The measured production default remains plain hybrid without LLM expansion. See [docs/rag/README.md](../../../../docs/rag/README.md) for report links.
