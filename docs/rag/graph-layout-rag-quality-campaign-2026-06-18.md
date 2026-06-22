# Graph Layout RAG Quality Campaign - 2026-06-18

## Status

Local support work, baseline measurement, and the first section-enriched A/B are complete. Qwen4B is skipped on this GPU setup because the rag-lit Qwen4B-1024 probe OOMed before full re-embed.

Raw artifacts:

- `tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-preflight`
- `tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-baseline-graph-catalog`
- `tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-baseline-graph-pdf`
- `tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-graph-section-v1`
- `tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-graph-section-v1-catalog`
- `tools/graph-layout-rag/data/eval/runs/20260618-quality-campaign-graph-section-v1-pdf`

## Support Changes

- Added CUDA local embed profiles: `cuda-qwen4b-1024`, `cuda-qwen4b-2560`, `cuda-qwen0.6b-section-v1`, `cuda-qwen0.6b-small2big-v1`, and `cuda-qwen0.6b-contextual-v1`.
- Contextual augmentation now uses `rag_common.local_llm.generate_text`, so `RAG_LLM_BACKEND=ollama` works locally.
- Contextual cache no longer persists failed or empty generations.
- Added graph `eval corpus-health`.
- Made chunking profile-aware. `small2big-v1` uses `target=350`, `max=550`, `min=120`, `overlap=80`; default stays `target=800`, `max=1200`, `overlap=120`.
- Section-enriched profiles prefix indexed dense/BM25 text with title, year, authors, source URL, section path, categories, tags, and aliases without changing stored evidence text.
- Extraction-cache keys now include the active chunking fingerprint, so small2big builds cannot reuse default chunks.
- Remote GPU scripts now write tmux logs, GPU samples, exit codes, and `DONE` / `FAILED` sentinels.

## Preflight

Corpus health on `cuda-qwen0.6b-1024`:

- 44,672 chunks across 5,843 docs, mean 7.65 chunks/doc.
- 2,634 PDFs on disk.
- Chunk density healthy; collapse rate 2%.
- Extraction fallback rate: 1/399, effectively 0%.
- No corpus-health warnings or critical findings.

Diagnostics show the current graph qrels are well judged for this profile: `hole@10` is 0.00-0.05 across catalog/pdf strategies.

## Baseline Results

Profile: `cuda-qwen0.6b-1024`. LLM transforms disabled.

### Catalog

| Strategy       | nDCG@10 |   MRR |  R@10 | p95 ms | Failures |
| -------------- | ------: | ----: | ----: | -----: | -------: |
| dense          |   0.634 | 0.838 | 0.344 |     44 |        0 |
| bm25           |   0.704 | 0.986 | 0.381 |    270 |        0 |
| hybrid         |   0.718 | 0.946 | 0.397 |    304 |        0 |
| hybrid_dense2  |   0.697 | 0.939 | 0.371 |    305 |        0 |
| hybrid_sparse2 |   0.713 | 0.944 | 0.388 |    303 |        0 |

### PDF Deep Read

| Strategy       | nDCG@10 |   MRR |  R@10 | p95 ms | Failures |
| -------------- | ------: | ----: | ----: | -----: | -------: |
| dense          |   0.596 | 0.791 | 0.465 |     62 |        2 |
| bm25           |   0.676 | 0.954 | 0.482 |    252 |        1 |
| hybrid         |   0.681 | 0.908 | 0.523 |    343 |        1 |
| hybrid_dense2  |   0.653 | 0.890 | 0.490 |    300 |        1 |
| hybrid_sparse2 |   0.683 | 0.926 | 0.492 |    299 |        1 |

## Interpretation

The current local CUDA profile is healthy and cheap, but still below the earlier Gemini secondary quality ceiling. Hybrid remains the most useful default on catalog, while `hybrid_sparse2` narrowly leads the PDF track. Dense-only remains fastest but materially lower quality.

Chunking experiments are now worth running because graph diagnostics show low judgment holes; nDCG deltas should be meaningful without immediate qrels expansion.

## Section-Enriched A/B

Profile: `cuda-qwen0.6b-section-v1`. Built on `desktop` as a separate profile index from `cuda-qwen0.6b-1024`; production remains untouched. Reembed completed 44,672 chunks in 3,651.5 seconds at 12.2 chunks/s. GPU crash grep: 0 lines. Peak sampled VRAM: ~6.2 GB.

### Catalog

| Strategy | nDCG@10 | Delta vs baseline | MRR | R@10 | p95 ms | Failures |
| --- | --: | --: | --: | --: | --: | --: |
| dense | 0.640 | +0.006 | 0.885 | 0.342 | 48 | 1 |
| bm25 | 0.704 | +0.000 | 0.990 | 0.379 | 236 | 0 |
| hybrid | 0.708 | -0.010 | 0.959 | 0.386 | 257 | 0 |
| hybrid_dense2 | 0.687 | -0.010 | 0.951 | 0.365 | 277 | 1 |
| hybrid_sparse2 | 0.711 | -0.002 | 0.969 | 0.383 | 281 | 0 |

Diagnostics:

| Strategy       | hole@10 | bpref |
| -------------- | ------: | ----: |
| bm25           |    0.00 | 0.353 |
| hybrid         |    0.03 | 0.378 |
| hybrid_dense2  |    0.03 | 0.363 |
| hybrid_sparse2 |    0.00 | 0.365 |
| dense          |    0.04 | 0.351 |

### PDF Deep Read

| Strategy | nDCG@10 | Delta vs baseline | MRR | R@10 | p95 ms | Failures |
| --- | --: | --: | --: | --: | --: | --: |
| dense | 0.614 | +0.018 | 0.816 | 0.476 | 75 | 1 |
| bm25 | 0.677 | +0.001 | 0.954 | 0.484 | 192 | 1 |
| hybrid | 0.696 | +0.015 | 0.933 | 0.522 | 259 | 1 |
| hybrid_dense2 | 0.658 | +0.005 | 0.917 | 0.482 | 232 | 1 |
| hybrid_sparse2 | 0.688 | +0.005 | 0.943 | 0.491 | 235 | 1 |

Diagnostics:

| Strategy       | hole@10 | bpref |
| -------------- | ------: | ----: |
| bm25           |    0.00 | 0.349 |
| hybrid         |    0.02 | 0.379 |
| hybrid_dense2  |    0.04 | 0.364 |
| hybrid_sparse2 |    0.00 | 0.357 |
| dense          |    0.05 | 0.355 |

Decision: do not promote as the graph default. Section enrichment hits the PDF promotion threshold for `hybrid` (+0.015 nDCG@10), but the same default arm regresses catalog by 0.010, exceeding the allowed opposite-track regression of 0.005. Keep the profile for PDF-focused A/B use and use small2big next to see whether recall can improve without the catalog loss.

## Remaining Campaign Runs

Run one GPU-heavy job at a time on `desktop`:

1. `cuda-qwen0.6b-small2big-v1`: build full index and benchmark the same strategies; compare recall and evidence quality.
2. `cuda-qwen0.6b-contextual-v1`: build after rag-lit contextual passes or if graph missed cases show context-sensitive failures.
3. Qwen4B profiles remain skipped on the current 8 GB GPU unless the embedding setup changes.

Promotion gate: `+0.01` catalog nDCG or `+0.015` PDF nDCG, no opposite-track regression over `0.005`, and no increase in failures.
