# Embedding Patterns Agent Loop - 2026-06-19

## Worker 1 - True Small-To-Big Dual

- Experiment: `cuda-qwen0.6b-small2big-dual-v1`.
- Status: validated completed build, smoke, benchmark, and diagnostics artifacts; no further experiment started.
- Build/smoke: 46,602 child chunks and 20,318 parents; smoke query returned parent evidence with `child_hits`.
- Benchmarks: small2big hybrid had the best raw nDCG@10 on both tracks (`0.565` catalog, `0.646` pdf-deep-read), but all arms had nonzero failures.
- Diagnostics: dual small2big hybrid corrected nDCG@10 was `0.558` catalog and `0.639` pdf-deep-read; hole@10 remained nonzero (`0.315`, `0.239`). Parent BM25 nearly closed holes (`0.002` on both tracks) but had lower bpref and nDCG.
- Baseline note: `cuda-qwen0.6b-1024` diagnostics emitted only dense, hybrid, and bm25 despite the six-strategy invocation; small2big strategies are intentionally unavailable for that profile.
- Decision: no recommendation for promotion. The run fails the strict and caveated opt-in gates due to nonzero failures, nonzero hole rates, and bpref not improving over the comparable baseline on both tracks.
- Report: `data/eval/runs/20260618-embedding-patterns-small2big-dual-build/result.md`.

## Worker 2 - Gemma4 Article Summary Chunks

- Experiment: `cuda-qwen0.6b-docsummary-gemma4-v1`.
- Status: implementation complete and 50-document desktop smoke completed; full corpus not run.
- Implementation: added separate Gemma4 document-summary generation/cache, separate `summaries` LanceDB table and summary BM25 index, summary provenance fields, clear absent-index failures, and opt-in strategies `docsummary_dense`, `docsummary_bm25`, `docsummary_hybrid`, `docsummary_then_chunks`, and `docsummary_fused_hybrid`.
- Local validation: focused rag-lit tests passed with `52 passed, 7 warnings`; production default `hybrid` and `cuda-qwen0.6b-1024` guidance were left unchanged.
- Smoke build: 50 docs, 1,114 normal chunks, 50 summaries, 0 skipped/missing/fallback/errors, runtime 658.2s, about 4.57 docs/min.
- Prompt correction: first prompt/cache version produced invalid one-word summaries; v2 increased generation budget, capped source text at 6,000 chars, rejects summaries under 40 words, and removed the bad v1 cache entries before the final smoke.
- Query smoke: RAPTOR summary query returned `RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval` at rank 1 for BM25, hybrid, then-chunks, and fused-hybrid summary modes.
- Benchmark smoke: partial 50-doc index only; best catalog arm was `docsummary_then_chunks`/`docsummary_fused_hybrid` at HR@5 `0.310`, and best pdf-deep-read nDCG@10 was `docsummary_then_chunks` at `0.084`. Failures remained high because most qrel targets were absent from the 50-doc index.
- Environment caveat: an early unsourced shell reported missing `libnvJitLink.so.13`; later runs that sourced `../rag-common/scripts/gpu_env.sh` loaded the CUDA libraries successfully.
- Decision: no recommendation for promotion and no full-corpus run yet. The route is viable, but throughput implies roughly 3.5-4 hours for full generation plus benchmark time, and the partial-index benchmark is not quality evidence.
- Report: `data/eval/runs/20260618-embedding-patterns-docsummary-gemma4-v1/result.md`.

## Worker 3 - Gemma4 Contextual Chunking

- Experiment: `cuda-qwen0.6b-contextual-v1` with local Ollama `gemma4:e4b`.
- Status: implementation fix and smoke complete; full corpus not run.
- Fix: contextual cache keys now include LLM backend and active model, so Gemma4 runs cannot reuse stale Gemini/other-model context lines.
- Local validation: `tests/test_contextual.py`, `tests/test_build_contextual_index.py`, and `tests/test_eval_strategies.py` passed with `14 passed, 7 warnings`.
- Cached smoke: 10 docs / 197 chunks completed quickly, but was rejected as evidence because it reused stale context lines before the cache-key fix.
- Accepted smoke: 1 doc / 21 chunks, 19 context lines generated, 2 context generations failed, runtime 128.3s.
- Decision: no recommendation for promotion and no full-corpus run. The 9.5% context-generation failure rate exceeds the 2% abort threshold.
- Report: `data/eval/runs/20260618-embedding-patterns-contextual-gemma4-v1/result.md`.

## Worker 4 - LongRAG Larger Retrieval Units

- Experiment: `cuda-qwen0.6b-longrag-v1`.
- Status: implementation and 50-document desktop smoke complete; full corpus not run.
- Implementation: added `longrag-v1` chunk limits (`target=1800`, `max=2400`, `min=600`, `overlap=240`) and a CUDA Qwen3-0.6B profile.
- Local validation: `tests/test_chunk_profiles.py` and `../rag-common/tests/test_profiles.py` passed with `17 passed, 7 warnings`.
- Smoke build: 50 docs, 522 larger chunks, 0 skipped/missing, runtime 78.5s, crash grep 0.
- Query smoke: RAPTOR query returned `RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval` at rank 1.
- Benchmark smoke: partial 50-doc catalog route test only; `hybrid` had HR@5 `0.299`, nDCG@10 `0.082`, and 364 failures because most qrel targets were absent.
- Decision: no promotion decision from the smoke. The implementation is viable and cheap enough for a future full-corpus build.
- Report: `data/eval/runs/20260618-embedding-patterns-longrag-v1/result.md`.

## Worker 5 - Qwen3 Dimension Sweep

- Experiments: `cuda-qwen0.6b-512-v1` and `cuda-qwen0.6b-768-v1`.
- Status: implementation and 50-document desktop smokes complete; full corpus not run.
- Local validation: profile tests passed through `../rag-common/tests/test_profiles.py` and rag-lit chunk-profile tests.
- `cuda-qwen0.6b-512-v1`: 50 docs, 1,114 chunks, runtime 121.9s, exit 0, crash grep 0, 10 checkpoints.
- `cuda-qwen0.6b-768-v1`: 50 docs, 1,114 chunks, runtime 122.7s, exit 0, crash grep 0, 10 checkpoints.
- Query smoke: both profiles returned `RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval` at rank 1 for the RAPTOR query.
- Decision: no promotion decision from smoke evidence. Full-corpus benchmarks are required before recommending reduced-dimensional indexes.
- Reports: `data/eval/runs/20260618-embedding-patterns-cuda-qwen0.6b-512-v1/result.md` and `data/eval/runs/20260618-embedding-patterns-cuda-qwen0.6b-768-v1/result.md`.

## Worker 6 - Late Chunking Feasibility

- Experiment: feasibility only; no profile added.
- Status: blocked by current embedding API.
- Finding: `rag_common.local_embed` uses pooled `SentenceTransformer.encode(...)` vectors with optional `truncate_dim`; it does not expose token embeddings, token spans, or span pooling needed for late chunking.
- Decision: do not add `cuda-latechunking-v1` until the embedding layer supports span-pooled vectors.
- Report: `data/eval/runs/20260618-embedding-patterns-latechunking-feasibility/result.md`.

## Deferred Controls

- `cuda-qwen0.6b-raptor-gemma4-v1`: deferred until document-summary generation is stable enough for full-corpus runs.
- ColBERT/SPLADE controls: skipped because current diagnostics did not identify a new miss class that justifies the compute.
