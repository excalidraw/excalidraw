---
name: rag-literature-rag
description: Query the local RAG methodology research corpus. Use when designing repo-rag/graph-layout-rag, choosing chunking or hybrid retrieval, researching Self-RAG, GraphRAG, agentic RAG, RAG evaluation, or reading full PDFs from the literature index.
---

# RAG literature RAG

Local hybrid search over core retrieval-augmented generation papers. Production profile: `gemini-2-structure-v1` (Gemini Embedding 2 @ 3072, Docling, structure-aware chunks).

## When to use

- Choosing **hybrid vs dense-only** retrieval, chunking strategy, or query expansion (HyDE, multi-query)
- **Self-RAG / CRAG / agentic RAG** design decisions
- **GraphRAG** vs vector-only RAG tradeoffs
- **RAG evaluation** (RAGAS, pooling bias, multi-system qrels)
- Finding primary sources before changing `tools/repo-rag` or `tools/graph-layout-rag`

## Agent workflow

```
1. Search     → yarn rag-lit:query "…" --top 8 --json
2. Shortlist  → canonical papers by score; read evidence passages
3. Deep read  → full PDF via doc_id from manifest
4. Cite       → yarn rag-lit:cite related <doc_id> (citation graph)
```

## Commands (repo root)

```bash
cd tools/rag-literature-rag && uv sync && cp .env.example .env

yarn rag-lit:harvest -- --deep-harvest --target-pdfs 1000 --resume -v
yarn rag-lit:ingest -- --force --rebuild
yarn rag-lit:query "Self-RAG reflection tokens" --tag self-correcting --json
yarn rag-lit:catalog --category graphrag
```

Direct CLI:

```bash
cd tools/rag-literature-rag
uv run rag-literature-rag query "HyDE hypothetical document embeddings" --top 8 --json
uv run rag-literature-rag ingest -v            # resume incremental ingest
uv run rag-literature-rag embed profiles
```

## Ingest

Checkpointing: resume with `ingest -v` (no `--force`). Use `--force --rebuild` only for first build or embed model change.

| Profile | Use when |
|---------|----------|
| `gemini-2-structure-v1` | **Production** — structure-aware chunks @ 3072 |
| `openai-large` | Fast cloud one-time ingest |
| `mlx-qwen4b` | Free local Apple Silicon ingest |

Set `RAG_EMBED_PROFILE=gemini-2-structure-v1` in `.env`. Query and ingest profiles must match.

**Do not query or benchmark during ingest** on a 24 GB Mac.

## Harvest

```bash
uv run rag-literature-rag harvest --deep-harvest --target-pdfs 1000 --workers 32 --resume -v
uv run rag-literature-rag harvest verify
uv run rag-literature-rag harvest enrich
```

| Flag | Purpose |
|------|---------|
| `--deep-harvest` | Caps tuned for ~1k PDF core corpus |
| `--target-pdfs 1000` | Stop when ok PDF count reaches N |
| `--resume` | Skip early seed stages |
| `--pipeline-harvest` | OpenAlex core topics only (skip broad discovery) |

## Query

Default: **hybrid** (dense + BM25 + RRF k=60). Do not add `--rerank` by default.

```bash
uv run rag-literature-rag query "reciprocal rank fusion hybrid retrieval" --category hybrid-retrieval --json
```

Categories: `foundations`, `dense-retrieval`, `graphrag`, `agentic`, `evaluation`, `engineering`, `survey`, … (see README).

## Eval

```bash
uv run rag-literature-rag eval corpus-health --embed-profile gemini-2-structure-v1  # read-only, no LLM
uv run rag-literature-rag eval validate-gold --json
uv run rag-literature-rag eval pool --track catalog --system bm25 --system dense --system hybrid
uv run rag-literature-rag eval judge --track catalog
uv run rag-literature-rag eval benchmark --embed-profile gemini-2-structure-v1 --qrels data/eval/qrels/catalog/qrels.json --report
uv run rag-literature-rag eval diagnostics --track catalog --embed-profile gemini-2-structure-v1 --qrels data/eval/qrels/catalog/qrels.json
```

Never expand gold labels from a single retriever (pooling bias). Use multi-system pool + LLM judge, and judge wins on `eval diagnostics` (hole_rate@k / bpref), not raw nDCG.

### Synthetic gold expansion (`eval gen-gold`)

The 42-case curated set **cannot distinguish retrieval methods** (they cluster in a ~0.11 nDCG band). To make the eval discriminate, generate a large stratified synthetic gold set: system-blind Flash queries grounded in corpus docs, anti-leakage + de-dup filtered, then the existing pool→judge pipeline. Opt-in via `RAG_LIT_SYNTH_GOLD=1`; curated-42 stays the default.

```bash
uv run rag-literature-rag eval gen-gold --embed-profile gemini-2-structure-v1 \
  --n-catalog 300 --n-pdf 200 --hard-frac 0.2 --budget-usd 12 -v   # ~$10 flash, budget-gated
uv run python scripts/synth_separation_report.py                    # curated-vs-synthetic spread + Spearman
```

### Established results (do not re-litigate — see `docs/eval-findings.md`)

- **Quality is data/measurement-bound, not algorithm-bound.** Biggest win was the full-text extraction fix (+0.23 nDCG, ~10× chunks), not any retriever.
- **Method ranking is stable:** dense ≈ hybrid_dense2 lead, hybrid close, **bm25 trails**. Reranking, citation fusion, multi_query, ColBERT/SPLADE-v3 all **lose**; HyDE only +0.02. Default stays **hybrid**.
- On 531 synthetic cases the method spread widens **3.5–4×**, agrees with the human anchor (Spearman 0.83–0.94), pooling-unbiased (hole@10 = 0). `hybrid_category` overfits the 42 (0.35 vs 0.63) — a strategy the small set hid.
- **Quota:** `gemini-3.5-flash` is global-endpoint-only under Dynamic Shared Quota — no per-project limit to raise, regional round-robin can't work; ~24 judge workers is the clean ceiling.

## Paths

- Manifest: `tools/rag-literature-rag/data/manifest.json`
- Indexes: `tools/rag-literature-rag/data/indexes/{profile}/`
- Skill sibling: [graph-layout-rag](../graph-layout-rag/SKILL.md) for graph-drawing corpus
