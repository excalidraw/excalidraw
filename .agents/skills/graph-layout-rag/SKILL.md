---
name: graph-layout-rag
description: Query the local graph drawing / layout theory RAG corpus. Topic search returns canonical papers with ranked evidence passages; cite related expands from a known paper through the citation graph. Use for Terraform pipeline layout height, Sugiyama/dot layering, neato stress majorization, ELK/Mermaid/dagre, compound grouping, layer reassignment, graph layout literature, and full-PDF deep reading.
---

# Graph Layout RAG

Local hybrid search over graph drawing and layout literature. Use it before citing layout algorithms or changing Terraform layout behavior based on Sugiyama, dot, ELK, dagre, compound graph, packing, routing, or stress majorization claims.

Use `repo-rag` for project source lookup and `rag-literature-rag` for RAG methodology research.

## First Commands

```bash
yarn graph-rag:query "network simplex rank assignment dot" --top 8 --json
yarn graph-rag:query "compound graph layout constraints" --top 8 --json
cd tools/graph-layout-rag && uv run graph-layout-rag query "layer reassignment Sugiyama" --tag hierarchical --json
```

Query returns canonical paper rows with ranked evidence snippets. Deep-read the PDF before quoting, proving an algorithm, or making a design decision.

## Agent Workflow

1. Search by topic with `yarn graph-rag:query "<topic>" --top 8 --json`.
2. Shortlist canonical papers by title, score, tags, page, and evidence.
3. Use `canonical_doc_id`, `doc_id`, or `alias_doc_ids` to locate the PDF or citation neighborhood.
4. Read the full source for precise algorithms and page-specific claims.
5. Cite `source_url`, title, page, and relevant evidence in the answer or implementation note.

## Setup And Profiles

Production query profile is `cuda-qwen0.6b-1024`, built from the `gemini-2-structure-v1` secondary index. Indexes live under `tools/graph-layout-rag/data/indexes/{profile}/`.

```bash
cd tools/graph-layout-rag
uv sync
cp .env.example .env
uv run graph-layout-rag embed profiles
```

Detailed ingest, harvest, profile, citation graph, GPU sync, local LLM, and campaign notes live in:

- [references/operations.md](references/operations.md)
- [references/campaigns.md](references/campaigns.md)

## Validation

```bash
cd tools/graph-layout-rag && uv run pytest tests/test_chunk_profiles.py tests/test_contextual.py tests/test_corpus_health.py tests/test_query_smoke.py
cd tools/graph-layout-rag && uv run graph-layout-rag --help
```
