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
| `cuda-qwen0.6b-1024` | **Production query** — GPU reembed from gemini secondary |
| `gemini-2-structure-v1` | Secondary cloud build (Docling, structure-aware chunks @ 3072) |
| `openai-large` | Fast cloud ingest |
| `mlx-qwen4b` | Free local ingest on Apple Silicon |

## Local-first embedding

Build `gemini-2-structure-v1` on Mac, GPU re-embed to `cuda-qwen0.6b-1024`, query locally:

```bash
RAG_EMBED_PROFILE=gemini-2-structure-v1 uv run rag-literature-rag ingest --force --rebuild
RAG_GPU_TOOL=tools/rag-literature-rag tools/rag-literature-rag/scripts/gpu_dense_reembed.sh
yarn rag-lit:query "Self-RAG reflection tokens" --top 8 --json
```

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

Default retrieval: **hybrid** (Gemini dense + Tantivy BM25 + RRF k=20).

### Eval

```bash
uv run rag-literature-rag eval corpus-health --embed-profile gemini-2-structure-v1  # read-only audit, no LLM
uv run rag-literature-rag eval validate-gold --json
yarn rag-lit:eval -- --embed-profile gemini-2-structure-v1 --report -v
```

Gold set: 42 curated agent-realistic queries in `src/rag_literature_rag/eval/gold_cases.py`. Build neutral qrels with multi-system pooling (`eval pool` → `eval judge`) before comparing strategies, and judge wins on `eval diagnostics` (hole_rate@k / bpref), never raw nDCG (pooling bias).

**Synthetic gold expansion** (`eval gen-gold`): 42 cases can't _distinguish_ retrieval methods (they cluster in a ~0.11 nDCG band). Generate a large stratified synthetic gold set to make the eval discriminate — system-blind Flash queries grounded in corpus docs, anti-leakage + de-dup filtered, then the existing pool→judge pipeline. Opt-in via `RAG_LIT_SYNTH_GOLD=1`; curated-42 stays the default.

```bash
uv run rag-literature-rag eval gen-gold --embed-profile gemini-2-structure-v1 \
  --n-catalog 300 --n-pdf 200 --hard-frac 0.2 --budget-usd 12 -v
uv run python scripts/synth_separation_report.py   # curated-vs-synthetic spread + Spearman
```

On 531 cases the method spread widens **3.5–4×** (methods separate), agrees with the human anchor (Spearman 0.83–0.94), and is pooling-unbiased (hole@10 = 0). Full writeup: [docs/eval-findings.md](docs/eval-findings.md).

## Agent skill

[`.agents/skills/rag-literature-rag/SKILL.md`](../../.agents/skills/rag-literature-rag/SKILL.md)
