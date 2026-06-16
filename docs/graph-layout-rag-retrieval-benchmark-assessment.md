# Graph Layout RAG Retrieval Benchmark Assessment

## Decision

The default query strategy is **hybrid retrieval**:

```text
Gemini dense retrieval + Tantivy BM25 + reciprocal rank fusion (RRF k=60)
```

Do not enable local reranking by default. Use `--no-hybrid` only for deliberate dense-only comparisons.

## Measured Results

Benchmark: `tools/graph-layout-rag/data/eval/runs/current-index-pareto-20260613/benchmark.json`

Hardware: Apple M4 Pro, 14 cores, 24 GB unified memory.

| Strategy | Track | MRR | nDCG@10 | p95 latency | Peak RSS |
| --- | --- | --: | --: | --: | --: |
| Hybrid | Catalog | 0.769 | 0.758 | 1.25 s | 1.02 GB |
| Dense only | Catalog | 0.713 | 0.673 | 1.24 s | 0.97 GB |
| BM25 only | Catalog | 0.717 | 0.699 | 57 ms | 0.64 GB |
| Hybrid | PDF deep-read | 0.758 | 0.756 | 1.31 s | 1.04 GB |
| MiniLM rerank | Catalog | 0.657 | 0.599 | 1.64 s | 1.16 GB |
| BGE rerank | Catalog | Aborted | Aborted | Aborted | Swap guard triggered |

RRF `k=100` scored `0.759` nDCG@10 versus `0.758` for the default `k=60`. That difference is too small to treat as meaningful, so the simpler existing `k=60` configuration remains the default.

## Confidence

### High confidence

- The reported metrics were produced by the checked-in benchmark implementation.
- Hybrid retrieval outperformed dense-only retrieval on the current gold set.
- BM25 is a strong low-latency fallback.
- The BGE reranker can create unsafe swap pressure on this 24 GB machine.
- The tested local rerankers did not improve retrieval quality.

### Moderate confidence

- Hybrid retrieval is the best current default for graph-layout research queries.
- The current latency and memory measurements are representative of this machine when ingest and other model-heavy workloads are not running.

### Low confidence

- Small differences between hybrid variants are meaningful.
- The measured scores predict performance for all future user queries.
- The current ranking of strategies will remain unchanged after expanding the corpus or gold set.

## Limitations

- The benchmark contains 30 queries and 23 unique relevant documents.
- The gold labels are manually curated and may favor known terminology.
- Ten original PDF-only cases had no retrievable PDF label; the benchmark now separates catalog and PDF deep-read tracks to avoid impossible evaluation.
- Strategies were measured once, so confidence intervals and run-to-run latency variance are not available.
- There is no hidden holdout set.
- Aggregate metrics do not replace manual inspection of failures and top results.

## Required Evidence Before Changing the Default

Change the hybrid default only when a candidate strategy:

1. Improves both catalog and PDF deep-read quality on an expanded holdout set.
2. Shows a material improvement, not a sub-`0.01` metric fluctuation.
3. Remains within the benchmark memory guards on the 24 GB M4 Pro.
4. Does not create unacceptable latency or cloud cost.
5. Passes manual review of failure cases and representative real research queries.

Recommended next confidence improvements:

- Expand to at least 100 queries.
- Add a hidden holdout set.
- Collect real queries from research sessions.
- Run each strategy three to five times.
- Report bootstrap confidence intervals.
- Label multiple relevant documents per query.
