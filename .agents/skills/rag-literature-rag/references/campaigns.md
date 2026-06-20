# RAG Literature Campaigns

## 2026-06-18 Quality Campaign

The active local-first campaign compares `cuda-qwen0.6b-1024` against Qwen4B, section-enriched, small-to-big, contextual, summary, LongRAG, and reduced-dimension profiles.

Current status:

- No campaign profile should replace the default.
- Section improves some nDCG scores but bpref falls and `hole@10` remains nonzero.
- Small-to-big completes cleanly at 47,219 chunks but regresses catalog/fusion quality.
- The dual profile builds parent evidence and improves raw small-to-big hybrid nDCG, but benchmark failures and diagnostic holes remain nonzero.
- Docsummary, contextual, LongRAG, and reduced-dimension profiles are smoke-tested only.
- Late chunking is blocked by the current pooled-vector embedding API.
- Qwen4B CUDA profiles are skipped on the RTX 3060 Ti 8 GB setup after the Qwen4B-1024 probe OOMed.

Raw artifacts belong under:

```text
tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-*
tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-*
```

Final reports:

```text
tools/rag-literature-rag/docs/quality-campaign-2026-06-18.md
tools/rag-literature-rag/docs/embedding-patterns-agent-loop-2026-06-19.md
docs/rag/rag-quality-campaign-2026-06-18.md
docs/rag/rag-embedding-patterns-campaign-2026-06-18.md
```

Benchmark a chunking variant as a normal embed profile:

```bash
RAG_EMBED_PROFILE=cuda-qwen0.6b-section-v1 uv run rag-literature-rag ingest --force --rebuild -v
uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-section-v1 \
  --qrels data/eval/qrels/catalog/qrels.json \
  --strategy dense --strategy bm25 --strategy hybrid --report -v
```

Benchmark true small-to-big dual as both an embed profile and retrieval strategy set:

```bash
RAG_EMBED_PROFILE=cuda-qwen0.6b-small2big-dual-v1 uv run rag-literature-rag ingest --force --rebuild -v
uv run rag-literature-rag query "parent chunk retrieval" \
  --embed-profile cuda-qwen0.6b-small2big-dual-v1 --small-to-big --json
uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-small2big-dual-v1 \
  --qrels data/eval/qrels/catalog/qrels.json \
  --strategy dense --strategy bm25 --strategy hybrid \
  --strategy small2big_dense --strategy small2big_parent_bm25 --strategy small2big_hybrid --report -v
```

Promotion requires synthetic nDCG and bpref to improve with `hole@10 = 0`.

Do not rerun broad ColBERT, SPLADE, or reranker sweeps unless diagnostics show a new failure mode.
