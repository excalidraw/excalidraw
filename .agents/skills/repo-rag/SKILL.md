---
name: repo-rag
description: Query local full-repo RAG over excalidraw-tf code and handoff docs. Use when onboarding to this repo, finding where Terraform import/layout code lives, tracing pipeline compound layout, preset loaders, dependency-cruiser boundaries, or any "where is X implemented?" question. Hybrid BM25 + embeddings via shared rag-common profiles and a SQLite import/call graph.
---

# Repo RAG

Local hybrid search over this repository's TypeScript, tests, markdown handoffs, and architecture notes. It is the first stop for "where is this implemented?", symbol lookup, and import/caller tracing inside excalidraw-tf.

Use `graph-layout-rag` for graph drawing literature and `rag-literature-rag` for RAG methodology papers.

## First Commands

```bash
yarn repo-rag:query "compound pipeline sibling columns" --top 8 --json
yarn repo-rag:query "terraformPipelineLayoutCompound" --top 5 --json
cd tools/repo-rag && uv run repo-rag context "fix sibling column collision in compound layout" --budget 6000
cd tools/repo-rag && uv run repo-rag symbol terraformPipelineLayoutCompound
```

Query results are excerpts only. Always deep-read the returned `file_path` and `start_line` before editing.

## Agent Workflow

1. Search with `yarn repo-rag:query "<task>" --top 8 --json`.
2. Shortlist by score, `source_type`, `file_path`, symbol, and line number.
3. Use graph tools when tracing code: `symbol`, `neighbors`, `read`, or `context`.
4. Read full files and relevant handoff docs before changing code.
5. Re-index after code edits when future searches need the new state: `yarn repo-rag:index`.

## Setup And Profiles

Production query profile is `cuda-qwen0.6b-1024`, with per-profile indexes under `tools/repo-rag/data/indexes/{profile}/`.

```bash
cd tools/repo-rag
uv sync
cp .env.example .env
uv run repo-rag embed profiles
uv run repo-rag status
```

Detailed setup, embedding profiles, reranking notes, MCP server usage, and output examples live in [references/operations.md](references/operations.md).

## Validation

```bash
cd tools/repo-rag && uv run pytest
cd tools/repo-rag && uv run repo-rag --help
```
