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
| `cuda-qwen0.6b-section-v1` | Chunking campaign: enrich indexed text with document/section metadata |
| `cuda-qwen0.6b-small2big-v1` | Chunking campaign: smaller child chunks (~350 target / 550 max) |
| `cuda-qwen0.6b-small2big-dual-v1` | Parent-child A/B: retrieve small child chunks, return baseline-sized parent passages |
| `cuda-qwen0.6b-contextual-v1` | Contextual Retrieval build with local LLM-generated context |
| `cuda-qwen0.6b-longrag-v1` | LongRAG/larger-unit A/B: larger section/page-span chunks (~1800 target / 2400 max) |
| `cuda-qwen0.6b-512-v1` / `cuda-qwen0.6b-768-v1` | Qwen3-0.6B reduced-dimension smoke profiles; not promoted |
| `cuda-qwen4b-1024` / `cuda-qwen4b-2560` | Qwen3-4B CUDA quality probes; skipped on RTX 3060 Ti 8 GB after OOM |
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

## Chunking and contextual experiments

The 2026-06-18 quality campaign keeps the production default unchanged and adds local-first A/B profiles:

- `cuda-qwen0.6b-section-v1`: default chunk boundaries, but indexed dense/BM25 text is prefixed with document title, year, authors, source URL, section path, categories, tags, and aliases.
- `cuda-qwen0.6b-small2big-v1`: smaller child chunks (`target=350`, `max=550`, `overlap=80`) with a distinct chunking fingerprint and chunk-cache key.
- `cuda-qwen0.6b-small2big-dual-v1`: true small-to-big retrieval. Ingest builds child chunks (`target=350`, `max=550`, `min=120`, `overlap=80`) and parent chunks (`target=800`, `max=1200`, `min=200`, `overlap=120`) from the same structural blocks. Dense retrieval searches child rows, aggregates to parent rows, and `--small-to-big` returns parent evidence with child-hit metadata. Parent BM25 lives under `bm25_parent/`.
- `cuda-qwen0.6b-contextual-v1`: default chunking plus local-LLM contextual prefixes through `rag_common.local_llm` (`RAG_LLM_BACKEND=ollama` on `desktop`).
- `cuda-qwen0.6b-longrag-v1`: larger retrieval units (`target=1800`, `max=2400`, `min=600`, `overlap=240`) for a non-generation LongRAG probe.
- `cuda-qwen0.6b-512-v1` / `cuda-qwen0.6b-768-v1`: reduced-dimension Qwen3-0.6B profiles. The 50-document smokes completed cleanly, but full-corpus benchmarks are required before recommendation.

Extraction caching has three reusable layers. Profile-specific chunk caches make reruns of the same profile fast. Backend page caches are keyed by PDF SHA, extraction backend, and extraction options, so future chunking profiles can reuse expensive Docling page extraction and only redo chunking plus embedding. Embedding cache entries are keyed by backend, model, dims, quant, title, and final indexed text, not profile name.

Build each as its own index and benchmark against synthetic qrels:

```bash
RAG_EMBED_PROFILE=cuda-qwen0.6b-section-v1 uv run rag-literature-rag ingest --force --rebuild -v
uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-section-v1 \
  --qrels data/eval/qrels/catalog/qrels.json --strategy dense --strategy bm25 --strategy hybrid --report -v
```

Parent-child A/B benchmark:

```bash
RAG_EMBED_PROFILE=cuda-qwen0.6b-small2big-dual-v1 uv run rag-literature-rag ingest --force --rebuild -v
uv run rag-literature-rag query "reciprocal rank fusion parent chunks" \
  --embed-profile cuda-qwen0.6b-small2big-dual-v1 --small-to-big --json
uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-small2big-dual-v1 \
  --qrels data/eval/qrels/catalog/qrels.json \
  --strategy dense --strategy bm25 --strategy hybrid \
  --strategy small2big_dense --strategy small2big_parent_bm25 --strategy small2big_hybrid --report -v
```

Campaign report: [docs/quality-campaign-2026-06-18.md](docs/quality-campaign-2026-06-18.md).

Current result: no campaign profile is promoted over `cuda-qwen0.6b-1024`; production stays on default `hybrid`. Section improves some nDCG scores but bpref falls and `hole@10` remains nonzero. Small2big completes cleanly at 47,219 chunks but regresses catalog/fusion quality. The dual profile builds parent evidence and improves raw small2big hybrid nDCG, but benchmark failures and diagnostic holes remain nonzero. Docsummary, contextual, LongRAG, and reduced-dimension profiles are smoke-tested only.

Next campaign order:

1. Run corpus health first; the audit reports fallback causes and qrel-heavy fallback documents.
2. Full-corpus `cuda-qwen0.6b-longrag-v1`, benchmarked on `dense`, `bm25`, and `hybrid` for catalog and PDF tracks.
3. Full-corpus `cuda-qwen0.6b-768-v1`, then `cuda-qwen0.6b-512-v1`, using the same benchmark/diagnostic gate plus index size, RSS, and build time.
4. Full `cuda-qwen0.6b-docsummary-gemma4-v1` only after the cheap full-corpus candidates pass.

Promotion requires nDCG and bpref agreement, `hole@10 = 0`, zero failures, and acceptable latency/memory. Reduced-dimension wins should be documented as cost profiles unless they also clearly improve quality.

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
uv run rag-literature-rag eval corpus-health --embed-profile cuda-qwen0.6b-1024 --track catalog --json  # read-only audit, no LLM
uv run rag-literature-rag eval corpus-health --embed-profile cuda-qwen0.6b-1024 --track pdf-deep-read --json
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
