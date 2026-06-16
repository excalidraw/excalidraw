# RAG literature RAG

Local research corpus for **core retrieval-augmented generation** literature: foundations (DPR, ColBERT, Lewis RAG), chunking, hybrid retrieval, GraphRAG, agentic RAG, and evaluation benchmarks. Forked from [graph-layout-rag](../graph-layout-rag) with domain-specific harvest, relevance, and taxonomy.

## Setup

```bash
cd tools/rag-literature-rag
uv sync
cp .env.example .env   # or reuse tools/repo-rag/.env
```

Embeddings use shared [`tools/rag-common`](../rag-common) with named profiles (`RAG_EMBED_PROFILE` or `--embed-profile`).

| Profile | When |
| --- | --- |
| `gemini-2-structure-v1` | Production: Gemini Embedding 2 @ 3072, Docling, structure-aware chunks |
| `openai-large` | Fast cloud ingest |
| `mlx-qwen4b` | Free local ingest on Apple Silicon |

## Pipeline

```bash
# From repo root
yarn rag-lit:harvest -- --deep-harvest --target-pdfs 1000 --workers 32 --resume -v
yarn rag-lit:harvest verify
yarn rag-lit:harvest enrich
yarn rag-lit:ingest -- --force --rebuild
yarn rag-lit:query "GraphRAG community summary" --top 8 --json
yarn rag-lit:catalog
```

### Harvest sources

- **Topic seeds** (~50 canonical papers): Lewis RAG, DPR, ColBERT, Self-RAG, CRAG, RAPTOR, GraphRAG, agentic surveys, RAGAS, etc.
- [awesome-generative-ai-guide RAG table](https://github.com/aishwaryanr/awesome-generative-ai-guide/blob/main/research_updates/rag_research_table.md) (core tags only)
- OpenAlex topic queries (foundations, GraphRAG, agentic, evaluation, …)
- arXiv (`cs.CL`, `cs.IR`, `cs.AI`)
- Crossref venues (ACL, EMNLP, SIGIR, WWW, NeurIPS) — strict RAG relevance gate
- Bibliography chain + forward citations from seed DOIs

Target corpus: **~800–1200 open-access PDFs** (core RAG only; no domain-specific medical/legal RAG).

### Query tags / categories

`foundations`, `dense-retrieval`, `hybrid-retrieval`, `chunking`, `query-expansion`, `reranking`, `self-correcting`, `graphrag`, `agentic`, `memory`, `long-context`, `evaluation`, `training`, `engineering`, `survey`

Default retrieval: **hybrid** (Gemini dense + Tantivy BM25 + RRF k=60).

### Eval

```bash
uv run rag-literature-rag eval validate-gold --json
yarn rag-lit:eval -- --embed-profile gemini-2-structure-v1 --report -v
```

Gold set: ~40 agent-realistic queries in `src/rag_literature_rag/eval/gold_cases.py`. Build neutral qrels with multi-system pooling before comparing strategies (see graph-layout-rag bake-off lessons).

## Agent skill

[`.agents/skills/rag-literature-rag/SKILL.md`](../../.agents/skills/rag-literature-rag/SKILL.md)
