# RAG Literature Evaluation

## Standard Commands

```bash
uv run rag-literature-rag eval corpus-health --embed-profile gemini-2-structure-v1
uv run rag-literature-rag eval validate-gold --json
uv run rag-literature-rag eval pool --track catalog --system bm25 --system dense --system hybrid
uv run rag-literature-rag eval judge --track catalog
uv run rag-literature-rag eval benchmark --embed-profile gemini-2-structure-v1 --qrels data/eval/qrels/catalog/qrels.json --report
uv run rag-literature-rag eval diagnostics --track catalog --embed-profile gemini-2-structure-v1 --qrels data/eval/qrels/catalog/qrels.json
```

Never expand gold labels from a single retriever. Use multi-system pool plus LLM judge, then trust diagnostics such as `hole_rate@k` and `bpref` over raw nDCG alone.

## Synthetic Gold Expansion

The curated 42-case set is too small to distinguish retrieval methods. Use system-blind Flash queries grounded in corpus docs, anti-leakage filtering, de-duplication, and the existing pool-to-judge pipeline.

Synthetic generation is opt-in:

```bash
RAG_LIT_SYNTH_GOLD=1 uv run rag-literature-rag eval gen-gold --embed-profile gemini-2-structure-v1 \
  --n-catalog 300 --n-pdf 200 --hard-frac 0.2 --budget-usd 12 -v
uv run python scripts/synth_separation_report.py
```

## Established Findings

See `tools/rag-literature-rag/docs/eval-findings.md` for the full writeup. Current working conclusions:

- Quality has been data/measurement-bound more than algorithm-bound.
- The largest lift was the full-text extraction fix, not retriever changes.
- Dense and hybrid-dense variants lead; BM25 trails; reranking, citation fusion, multi-query, ColBERT, and SPLADE-v3 lose in current evals.
- HyDE gives only a small lift and is not the default.
- On 531 synthetic cases, method spread widens and agrees with the human anchor; `hole@10 = 0` is required for promotion.
- `gemini-3.5-flash` Dynamic Shared Quota is global-endpoint-only; about 24 judge workers is the practical ceiling.
