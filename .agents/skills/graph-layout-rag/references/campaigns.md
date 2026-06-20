# Graph Layout RAG Campaigns

## 2026-06-18 Quality Campaign

The active local-first campaign compares `cuda-qwen0.6b-1024` against Qwen4B, section-enriched, small-to-big, and contextual profiles.

Current status:

- `cuda-qwen0.6b-section-v1` is built and synced.
- Section metadata should not replace the default because its PDF gain is offset by catalog regression.
- Qwen4B CUDA profiles are skipped on the RTX 3060 Ti 8 GB setup after the rag-lit Qwen4B-1024 probe OOMed.
- Next chunking A/B is `cuda-qwen0.6b-small2big-v1`.

Raw artifacts belong under:

```text
tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-*
```

Final report:

```text
docs/rag/graph-layout-rag-quality-campaign-2026-06-18.md
```

Benchmark a chunking variant as a normal embed profile:

```bash
RAG_EMBED_PROFILE=cuda-qwen0.6b-small2big-v1 uv run graph-layout-rag ingest --force --rebuild -v
uv run graph-layout-rag eval benchmark --embed-profile cuda-qwen0.6b-small2big-v1 \
  --qrels data/eval/qrels/catalog/qrels.json \
  --strategy dense --strategy bm25 --strategy hybrid --report -v
```

Do not rerun broad ColBERT, SPLADE, or reranker sweeps for this campaign unless diagnostics show a new failure mode.

## Local LLM Benchmark

Measured 2026-06-17 on desktop RTX 3060 Ti: local Ollama HyDE did not beat cuda hybrid. Keep production query default as hybrid without LLM expansion.

| Arm | Catalog nDCG@10 | PDF nDCG@10 | hybrid_auto_hyde p95 |
| --- | ---: | ---: | ---: |
| baseline hybrid (cuda) | 0.715 | 0.684 | n/a |
| `gemma4:e4b` router | 0.710 | 0.678 | 328 / 429 ms |
| `gemma4:e2b` router | 0.705 | 0.659 | 328 / 428 ms |
| `qwen3.5:9b` router | 0.715 | 0.684 | about 11 s |

Benchmark launcher:

```bash
./scripts/gpu_execute_local_llm_benchmark.sh
```

Report:

```text
docs/rag/README.md
docs/graph-layout-rag-local-llm-benchmark-2026.md
```
