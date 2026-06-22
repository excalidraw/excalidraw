---
name: rag-literature-rag
description: Query the local RAG methodology research corpus. Use when designing repo-rag/graph-layout-rag, choosing chunking or hybrid retrieval, researching Self-RAG, GraphRAG, agentic RAG, RAG evaluation, or reading full PDFs from the literature index.
---

# RAG Literature RAG

Local hybrid search over retrieval-augmented generation papers. Use it before changing RAG architecture, chunking, retrieval, query expansion, evaluation, or agentic search behavior.

Use `repo-rag` for project source lookup and `graph-layout-rag` for graph drawing/layout literature.

## First Commands

```bash
yarn rag-lit:query "Self-RAG reflection tokens" --tag self-correcting --json
yarn rag-lit:query "reciprocal rank fusion hybrid retrieval" --category hybrid-retrieval --json
yarn rag-lit:catalog --category graphrag
cd tools/rag-literature-rag && uv run rag-literature-rag query "HyDE hypothetical document embeddings" --top 8 --json
```

Query returns canonical paper results with evidence snippets. Deep-read the PDF before quoting or making architecture decisions.

## Agent Workflow

1. Search with `yarn rag-lit:query "<topic>" --top 8 --json`.
2. Shortlist canonical papers by title, score, category, tags, and evidence.
3. Read full PDFs through the manifest entry for the selected `doc_id`.
4. Use `yarn rag-lit:cite related <doc_id>` when citation-neighborhood expansion matters.
5. Cite report links or paper metadata when documenting decisions.

## Setup And Profiles

Production query profile is `cuda-qwen0.6b-contextual-v1` (promoted 2026-06-22; held-out nDCG@10=0.942 vs 0.630/0.667 dense baseline — see `docs/quality-campaign-2026-06-22.md`). `cuda-qwen0.6b-longrag-v1` is a viable backup; `cuda-qwen0.6b-1024` and `gemini-2-structure-v1` remain available for comparison. Indexes live under `tools/rag-literature-rag/data/indexes/{profile}/`.

```bash
cd tools/rag-literature-rag
uv sync
cp .env.example .env
uv run rag-literature-rag embed profiles
```

Detailed ingest, harvest, eval, synthetic gold, quality campaign, and troubleshooting notes live in:

- [references/operations.md](references/operations.md)
- [references/evaluation.md](references/evaluation.md)
- [references/campaigns.md](references/campaigns.md)

## Validation

```bash
cd tools/rag-literature-rag && uv run pytest tests/test_chunk_profiles.py tests/test_contextual.py tests/test_corpus_health.py tests/test_ingest_run.py tests/test_query_transforms.py
cd tools/rag-literature-rag && uv run rag-literature-rag --help
```
