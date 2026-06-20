# RAG Tooling Index

This repo has three local RAG corpora plus one shared support package.

## Corpora

| Corpus | Skill | CLI | Purpose |
| --- | --- | --- | --- |
| Repo code and handoffs | `.agents/skills/repo-rag` | `yarn repo-rag:*` | Find implementation locations, exact symbols, callers, imports, and Terraform pipeline handoff docs. |
| Graph layout literature | `.agents/skills/graph-layout-rag` | `yarn graph-rag:*` | Find primary sources for graph drawing, Sugiyama/dot, ELK, compound graphs, routing, packing, and layout theory. |
| RAG literature | `.agents/skills/rag-literature-rag` | `yarn rag-lit:*` | Find papers and reports for RAG chunking, retrieval, query expansion, GraphRAG, Self-RAG, agentic RAG, and evaluation. |

## Shared Infrastructure

`tools/rag-common` is the canonical home for reusable RAG infrastructure:

- embedding profile loading and shared `embed_profiles.toml`
- OpenAI, Gemini, MLX, CUDA/local embedding helpers
- local LLM helpers
- rerank helpers
- GPU sync, remote bootstrap, and dense reembed scripts
- dense embedding benchmark helpers

Tool-local scripts should stay as thin compatibility wrappers when existing commands depend on them.

## Production Profiles

| Tool | Production query profile | Secondary or build profile |
| --- | --- | --- |
| `repo-rag` | `cuda-qwen0.6b-1024` | `gemini-2` |
| `graph-layout-rag` | `cuda-qwen0.6b-1024` | `gemini-2-structure-v1` |
| `rag-literature-rag` | `cuda-qwen0.6b-1024` | `gemini-2-structure-v1` |

All tools store generated indexes under `tools/<tool>/data/indexes/{profile}/`. These indexes, manifests, caches, raw PDFs, logs, SQLite graph files, and eval runs are local-only and ignored by git.

## Reports

Top-level RAG reports:

- [Graph layout quality campaign, 2026-06-18](graph-layout-rag-quality-campaign-2026-06-18.md)
- [RAG quality campaign, 2026-06-18](rag-quality-campaign-2026-06-18.md)
- [RAG embedding patterns campaign, 2026-06-18](rag-embedding-patterns-campaign-2026-06-18.md)

Related graph-layout reports still at `docs/`:

- [Graph layout local LLM benchmark](../graph-layout-rag-local-llm-benchmark-2026.md)
- [Graph layout retrieval benchmark assessment](../graph-layout-rag-retrieval-benchmark-assessment.md)
- [Graph layout search eval and SOTA](../graph-layout-rag-search-eval-and-sota-2026.md)
- [Graph layout SOTA architectures](../graph-layout-rag-sota-architectures-2026.md)
- [Graph layout architecture bakeoff](../graph-layout-rag-architecture-bakeoff-2026.md)

Tool-local reports:

- [RAG literature eval findings](../../tools/rag-literature-rag/docs/eval-findings.md)
- [RAG literature quality campaign](../../tools/rag-literature-rag/docs/quality-campaign-2026-06-18.md)
- [RAG literature embedding patterns agent loop](../../tools/rag-literature-rag/docs/embedding-patterns-agent-loop-2026-06-19.md)

## Validation

Focused test and smoke commands:

```bash
cd tools/rag-common && uv run pytest
cd tools/repo-rag && uv run pytest && uv run repo-rag --help
cd tools/graph-layout-rag && uv run pytest tests/test_chunk_profiles.py tests/test_contextual.py tests/test_corpus_health.py tests/test_query_smoke.py && uv run graph-layout-rag --help
cd tools/rag-literature-rag && uv run pytest tests/test_chunk_profiles.py tests/test_contextual.py tests/test_corpus_health.py tests/test_ingest_run.py tests/test_query_transforms.py && uv run rag-literature-rag --help
```
