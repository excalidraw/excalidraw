# RAG Literature Quality Campaign - 2026-06-18

## Status

Local support work, baseline measurement, section-enriched A/B, small2big A/B, true parent-child small-to-big dual A/B, a 50-document Gemma4 document-summary smoke, a Gemma4 contextual smoke, a 50-document LongRAG smoke, Qwen3 512/768 dimension smokes, and the late-chunking feasibility spike are complete. `cuda-qwen0.6b-small2big-dual-v1` built and benchmarked successfully but is not promoted. `cuda-qwen0.6b-docsummary-gemma4-v1` is implemented and smoke-tested but not promoted and not built full-corpus. `cuda-qwen0.6b-contextual-v1` now has model-scoped cache keys, but Gemma4 contextual generation failed the smoke threshold. `cuda-qwen0.6b-longrag-v1`, `cuda-qwen0.6b-512-v1`, and `cuda-qwen0.6b-768-v1` are implemented and smoke-tested but not full-corpus benchmarked. Late chunking is blocked by the current pooled-vector embedding API. Qwen4B-1024 was probed on `desktop` and stopped after CUDA OOM.

Raw artifacts:

- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-preflight`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-baseline-rag-lit-catalog`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-baseline-rag-lit-pdf`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-section-v1`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-section-v1-catalog`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-section-v1-pdf`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-qwen4b-1024`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-small2big-v1-retry3`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-small2big-v1-catalog`
- `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-small2big-v1-pdf`
- `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-small2big-dual-build`
- `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-small2big-dual-catalog`
- `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-small2big-dual-pdf`
- `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-docsummary-gemma4-v1`
- `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-contextual-gemma4-v1`
- `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-longrag-v1`

## Support Changes

- Added CUDA local embed profiles: `cuda-qwen4b-1024`, `cuda-qwen4b-2560`, `cuda-qwen0.6b-section-v1`, `cuda-qwen0.6b-small2big-v1`, and `cuda-qwen0.6b-contextual-v1`.
- Contextual augmentation now uses `rag_common.local_llm.generate_text`, so `RAG_LLM_BACKEND=ollama` works locally.
- Contextual cache no longer persists failed or empty generations.
- Fixed contextual build behavior so `limit(0)` reads all chunks instead of zero chunks.
- Query-transform prompts and cache keys are RAG/neural-IR specific and local-LLM aware.
- Removed `graph-drawing` tag leakage from harvest/tag code and migrated existing manifest tags.
- Made chunking profile-aware. `small2big-v1` uses `target=350`, `max=550`, `min=120`, `overlap=80`; default stays `target=800`, `max=1200`, `overlap=120`.
- Added true parent-child chunking for `cuda-qwen0.6b-small2big-dual-v1`: child chunks use `target=350`, `max=550`, `min=120`, `overlap=80`; parent chunks use the default-sized `target=800`, `max=1200`, `min=200`, `overlap=120`. Children are mapped to the parent with maximum structural-block overlap and store parent metadata in LanceDB.
- Added a separate `parents` LanceDB table plus parent BM25 under `bm25_parent/`. Query-time `--small-to-big` fails clearly if these parent indexes are absent.
- Added eval strategies `small2big_dense`, `small2big_parent_bm25`, and `small2big_hybrid` (RRF `k=20`) for the parent-child profile.
- Added a disk embedding cache keyed by backend, model, dims, quant, title, and final indexed text, so equivalent indexed text can reuse vectors across profiles. Ingest status and `embed indexes --json` now report extraction and embedding cache stats.
- Section-enriched profiles prefix indexed dense/BM25 text with title, year, authors, source URL, section path, categories, tags, and aliases without changing stored evidence text.
- Extraction caching now has reusable page and chunk layers: profile-specific chunk caches include the active chunking fingerprint, while page caches are keyed by PDF SHA, backend, and extraction options. New chunking profiles can reuse Docling page extraction and only redo chunking plus embedding after the page cache is populated.

## Preflight

Corpus health on `cuda-qwen0.6b-1024`:

- 21,211 chunks across 1,270 docs, mean 16.7 chunks/doc.
- 1,018 PDFs on disk.
- Chunk density healthy; collapse rate 0%.
- Warning: 879/1,918 extractions fell back to abstract, 46%.
- Synthetic qrels: 542 catalog cases, mean 52.5 judged docs/case.

Diagnostics show `bm25` has `hole@10 = 0`, but dense-heavy hybrid strategies still have high judgment holes on synthetic catalog (`0.28` to `0.44`) and PDF (`0.21` to `0.37`). Treat nDCG deltas for dense-heavy variants with bpref and hole-rate checks.

## Baseline Results

Profile: `cuda-qwen0.6b-1024`. LLM transforms disabled.

### Catalog

| Strategy | nDCG@10 | MRR | R@10 | p95 ms | Failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| dense | 0.567 | 0.937 | 0.396 | 34 | 0 |
| bm25 | 0.621 | 0.988 | 0.424 | 60 | 0 |
| hybrid | 0.617 | 1.000 | 0.426 | 101 | 0 |
| hybrid_rrf100 | 0.625 | 1.000 | 0.427 | 99 | 0 |
| hybrid_dense2 | 0.610 | 1.000 | 0.412 | 101 | 0 |

### PDF Deep Read

| Strategy | nDCG@10 | MRR | R@10 | p95 ms | Failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| dense | 0.615 | 0.935 | 0.485 | 59 | 0 |
| bm25 | 0.679 | 0.988 | 0.515 | 59 | 0 |
| hybrid | 0.679 | 1.000 | 0.520 | 137 | 0 |
| hybrid_rrf100 | 0.678 | 1.000 | 0.510 | 104 | 0 |
| hybrid_dense2 | 0.665 | 1.000 | 0.501 | 90 | 0 |

## Interpretation

The rag-lit corpus is currently lexical-heavy: BM25 is tied with, or slightly ahead of, hybrid on nDCG, while hybrid keeps the best PDF recall. The high extraction fallback rate is the clearest corpus-quality issue and should be addressed before broad discovery expansion.

Chunking A/Bs are especially relevant here because rag-lit has explicit chunking and retrieval-method queries. However, dense-heavy strategies must be evaluated with hole-rate and bpref, not only nDCG.

## Section-Enriched A/B

Profile: `cuda-qwen0.6b-section-v1`. Built on `desktop` as a separate profile index from `cuda-qwen0.6b-1024`; production remains untouched. Reembed completed 21,211 chunks in 1,638.3 seconds at 12.9 chunks/s. GPU crash grep: 0 lines. Peak sampled VRAM: ~3.75 GB.

### Catalog

| Strategy | nDCG@10 | Δ vs baseline | MRR | R@10 | p95 ms | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dense | 0.563 | -0.004 | 0.952 | 0.389 | 59 | 0 |
| bm25 | 0.605 | -0.016 | 0.970 | 0.429 | 101 | 0 |
| hybrid | 0.627 | +0.010 | 1.000 | 0.441 | 142 | 0 |
| hybrid_rrf100 | 0.633 | +0.008 | 1.000 | 0.443 | 142 | 0 |
| hybrid_dense2 | 0.622 | +0.012 | 1.000 | 0.424 | 142 | 0 |

Diagnostics:

| Strategy | hole@10 | bpref | Baseline bpref |
| --- | ---: | ---: | ---: |
| bm25 | 0.00 | 0.379 | 0.398 |
| hybrid | 0.29 | 0.426 | 0.433 |
| hybrid_rrf100 | 0.28 | 0.427 | 0.434 |
| hybrid_dense2 | 0.40 | 0.411 | 0.427 |

### PDF Deep Read

| Strategy | nDCG@10 | Δ vs baseline | MRR | R@10 | p95 ms | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dense | 0.636 | +0.021 | 0.951 | 0.499 | 85 | 0 |
| bm25 | 0.665 | -0.014 | 0.970 | 0.525 | 105 | 0 |
| hybrid | 0.686 | +0.007 | 1.000 | 0.532 | 237 | 0 |
| hybrid_rrf100 | 0.691 | +0.013 | 1.000 | 0.535 | 150 | 0 |
| hybrid_dense2 | 0.684 | +0.019 | 1.000 | 0.532 | 154 | 0 |

Diagnostics:

| Strategy | hole@10 | bpref | Baseline bpref |
| --- | ---: | ---: | ---: |
| bm25 | 0.00 | 0.453 | 0.479 |
| hybrid | 0.21 | 0.514 | 0.523 |
| hybrid_rrf100 | 0.22 | 0.508 | 0.515 |
| hybrid_dense2 | 0.32 | 0.493 | 0.508 |

Decision: do not promote yet. Section enrichment improves nDCG for hybrid/fusion on both tracks, including +0.013 PDF nDCG for `hybrid_rrf100`, but it fails the rag-lit promotion gate because bpref falls slightly and `hole@10` remains nonzero for dense-heavy arms.

## Qwen4B Probe

Profile: `cuda-qwen4b-1024`. The 512-chunk probe on `desktop` loaded Qwen3-Embedding-4B but failed both `fp16` and `bnb-4bit` benchmark arms with CUDA OOM on the RTX 3060 Ti 8 GB card. The run was stopped before a full index was synced back to the Mac.

Artifacts:

- Sentinel: `STOPPED_AFTER_PROBE_OOM`
- Exit code: `99`
- Crash grep: 9 lines
- Full local artifact directory: `tools/rag-literature-rag/data/eval/runs/20260618-quality-campaign-rag-lit-qwen4b-1024`

Decision: skip `cuda-qwen4b-2560` and do not schedule Qwen4B full re-embeds on this GPU unless a later setup change materially reduces VRAM use.

## Small2big A/B

Profile: `cuda-qwen0.6b-small2big-v1`. Built on `desktop` as a separate profile index from `cuda-qwen0.6b-1024`; production remains untouched. Ingest completed 1,270 documents and 47,219 chunks in 16,874.0 seconds (4h 41m 14s). GPU crash grep: 0 lines. The successful run was `retry3`; earlier retries are retained as failed setup artifacts for missing Docling extra, Docling GPU CUDA OOM, and Linux MLX import errors.

The run used CPU Docling with `RAG_LIT_EXTRACT_WORKERS=1`, `RAG_LIT_DOCLING_THREADS=4`, `RAG_LIT_DOCLING_DEVICE=cpu`, and CUDA embedding batch size 8. Extraction was memory-tight on `desktop`; swap filled during the run but live `vmstat` samples showed little active swap I/O near the end. Future extractor-heavy runs should use lower memory settings or zswap/zram.

### Catalog

| Strategy | nDCG@10 | Δ vs baseline | MRR | R@10 | p95 ms | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dense | 0.566 | -0.001 | 0.940 | 0.326 | 79 | 0 |
| bm25 | 0.549 | -0.072 | 1.000 | 0.325 | 78 | 0 |
| hybrid | 0.578 | -0.039 | 1.000 | 0.329 | 120 | 0 |
| hybrid_rrf100 | 0.583 | -0.042 | 1.000 | 0.331 | 122 | 0 |
| hybrid_dense2 | 0.598 | -0.012 | 1.000 | 0.339 | 128 | 0 |

Diagnostics:

| Strategy | hole@10 | bpref | Baseline bpref |
| --- | ---: | ---: | ---: |
| bm25 | 0.02 | 0.341 | 0.398 |
| dense | 0.40 | 0.397 | 0.390 |
| hybrid | 0.34 | 0.376 | 0.433 |
| hybrid_rrf100 | 0.33 | 0.377 | 0.434 |
| hybrid_dense2 | 0.38 | 0.392 | 0.427 |

### PDF Deep Read

| Strategy | nDCG@10 | Δ vs baseline | MRR | R@10 | p95 ms | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dense | 0.639 | +0.024 | 0.939 | 0.410 | 87 | 0 |
| bm25 | 0.679 | +0.000 | 1.000 | 0.425 | 80 | 0 |
| hybrid | 0.676 | -0.003 | 1.000 | 0.432 | 157 | 0 |
| hybrid_rrf100 | 0.642 | -0.036 | 1.000 | 0.402 | 118 | 0 |
| hybrid_dense2 | 0.657 | -0.008 | 1.000 | 0.420 | 122 | 0 |

Diagnostics:

| Strategy | hole@10 | bpref | Baseline bpref |
| --- | ---: | ---: | ---: |
| bm25 | 0.03 | 0.477 | 0.479 |
| dense | 0.34 | 0.502 | 0.489 |
| hybrid | 0.28 | 0.519 | 0.523 |
| hybrid_rrf100 | 0.27 | 0.457 | 0.515 |
| hybrid_dense2 | 0.30 | 0.468 | 0.508 |

Decision: do not promote. Small2big increases chunk count by 2.23x and improves a few dense/PDF signals, but it regresses catalog nDCG, BM25, and hybrid fusion relative to the baseline. It also does not meet the rag-lit promotion gate because bpref does not improve for the strongest hybrid arms and `hole@10` remains nonzero.

## True Small-To-Big Dual A/B

Profile: `cuda-qwen0.6b-small2big-dual-v1`. This is a new non-destructive A/B profile; existing production and campaign indexes remain untouched.

Implementation status:

- Ingest builds child chunks and parent chunks from one parsed structural block list, using the page extraction cache when available.
- Child rows remain in the existing `chunks` LanceDB table and include `parent_id`, `parent_chunk_index`, `parent_page`, `parent_page_end`, and `parent_section_path`.
- Parent rows are stored in a new `parents` LanceDB table and indexed lexically under `bm25_parent/`.
- `rag-literature-rag query --small-to-big` retrieves precise child chunks, aggregates them to parents, and returns parent text with child-hit metadata.
- Eval strategies are available for `small2big_dense`, `small2big_parent_bm25`, and `small2big_hybrid`.

Build/smoke status:

- Ingest completed on `desktop` and synced back.
- Index status: 46,602 child chunks and 20,318 parent chunks.
- Smoke query returned parent evidence with `child_hits`.

Benchmark summary:

| Track | Best dual arm | nDCG@10 | Comparable baseline | Failures |
| --- | --- | ---: | ---: | ---: |
| catalog | small2big_hybrid | 0.565 | hybrid 0.556 | 25 |
| pdf-deep-read | small2big_hybrid | 0.646 | hybrid 0.632 | 12 |

Diagnostics:

| Track | Arm | corrected nDCG@10 | hole@10 | bpref |
| --- | --- | ---: | ---: | ---: |
| catalog | small2big_hybrid | 0.558 | 0.315 | 0.383 |
| catalog | small2big_parent_bm25 | 0.541 | 0.002 | 0.328 |
| pdf-deep-read | small2big_hybrid | 0.639 | 0.239 | 0.471 |
| pdf-deep-read | small2big_parent_bm25 | 0.599 | 0.002 | 0.398 |

Decision: do not promote. The best hybrid arm improved raw nDCG@10, but all benchmark arms had nonzero failures, the best hybrid arm retained nonzero diagnostic holes, and bpref did not improve over the comparable baseline on both tracks. Parent BM25 shows that lexical parent context can close holes, but it is not the current `--small-to-big` user path and does not pass the quality gate.

## Gemma4 Article Summary Chunks

Profile: `cuda-qwen0.6b-docsummary-gemma4-v1`. This is a new non-destructive summary profile; production defaults and normal chunk indexes remain untouched.

Implementation status:

- Summary generation uses local Ollama `gemma4:e4b`.
- Summary cache is separate from extraction/page/chunk caches and keys on PDF SHA, model, prompt version, extraction options, and source text hash.
- Summaries are stored in a separate `summaries` LanceDB table and lexical `bm25_summary/` index.
- Eval strategies are explicit opt-in: `docsummary_dense`, `docsummary_bm25`, `docsummary_hybrid`, `docsummary_then_chunks`, and `docsummary_fused_hybrid`.
- `embed indexes --json` reports summary count and doc-summary cache stats.

50-document smoke:

| Metric | Value |
| --- | ---: |
| documents | 50 |
| normal chunks | 1,114 |
| summaries | 50 |
| runtime | 658.2s |
| throughput | 4.57 docs/min |
| skipped/missing/fallback/errors | 0 |

The first prompt/cache version produced unusable one-word summaries and was discarded. The corrected v2 prompt/cache version increased the generation budget, capped source text at 6,000 characters, rejects summaries under 40 words, and produced 150-168 word summaries in inspected samples.

Query smoke: `RAPTOR recursive tree summaries retrieval augmented generation` returned `RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval` at rank 1 for BM25, hybrid, two-stage, and fused summary modes.

Benchmark smoke: route-only on the 50-document partial index. Best catalog HR@5 was `0.310` for `docsummary_then_chunks`/`docsummary_fused_hybrid`; best pdf-deep-read nDCG@10 was `0.084` for `docsummary_then_chunks`. These are not quality metrics because most qrel targets are absent from the partial index.

Decision: do not promote and do not run full corpus yet. The route is viable, but full generation is a multi-hour desktop job and the partial-index benchmark is not quality evidence. Later sourced CUDA runs resolved the earlier missing `libnvJitLink` setup issue.

## Gemma4 Contextual Chunking

Profile: `cuda-qwen0.6b-contextual-v1`. Full corpus was not run.

Implementation fix: contextual cache keys now include LLM backend and active model, preventing Gemma4 runs from reusing stale context lines generated under Gemini or another local model.

Smoke summary:

| Metric | Value |
| --- | ---: |
| accepted smoke documents | 1 |
| chunks | 21 |
| generated context lines | 19 |
| failed context generations | 2 |
| failure rate | 9.5% |
| runtime | 128.3s |

Decision: do not promote and do not run full corpus. The run exceeded the 2% contextual generation failure threshold. The earlier 10-document cached smoke is retained as an artifact but rejected as evidence because it predated the model-scoped cache-key fix.

## LongRAG Larger Retrieval Units

Profile: `cuda-qwen0.6b-longrag-v1`. Full corpus was not run.

Implementation status:

- Added `longrag-v1` chunking limits: target 1800 tokens, max 2400, min preferred 600, overlap 240.
- Added the CUDA Qwen3-0.6B profile.
- Defaults and production query behavior remain unchanged.

50-document smoke:

| Metric | Value |
| --- | ---: |
| documents | 50 |
| larger chunks | 522 |
| runtime | 78.5s |
| skipped/missing | 0 |
| crash grep | 0 |

Query smoke returned `RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval` at rank 1 for a RAPTOR query. The partial catalog benchmark is route-only; `hybrid` reached nDCG@10 `0.082` with 364 failures because most qrel targets were absent from the 50-document index.

Decision: no promotion decision from the smoke. The implementation is viable and cheap enough to schedule for full-corpus build if the campaign continues with non-generation chunk-size experiments.

## Qwen3 Dimension Sweep

Profiles: `cuda-qwen0.6b-512-v1` and `cuda-qwen0.6b-768-v1`. Full corpus was not run.

| Profile | Documents | Chunks | Runtime | Exit | Crash grep | Query smoke |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `cuda-qwen0.6b-512-v1` | 50 | 1,114 | 121.9s | 0 | 0 | RAPTOR paper rank 1 |
| `cuda-qwen0.6b-768-v1` | 50 | 1,114 | 122.7s | 0 | 0 | RAPTOR paper rank 1 |

Both runs used the same baseline chunking shape, wrote 10 ingest checkpoints, and reported nonzero isolated indexes through `embed indexes --json`.

Decision: no promotion decision from smoke evidence. The reduced-dimensional profiles are viable and may reduce storage/query memory, but they need full-corpus catalog and PDF benchmarks before any recommendation.

## Late Chunking Feasibility

Status: blocked by the current local embedding API. `rag_common.local_embed` calls `SentenceTransformer.encode(...)`, which returns pooled vectors and supports `truncate_dim`, but does not expose token embeddings, token-to-character spans, or span-pooling hooks. Do not add a `cuda-latechunking-v1` profile until the embedding layer can produce span-pooled vectors.

## Promotion Decision

No retrieval/index profile from this campaign is promoted to default. Production stays on `cuda-qwen0.6b-1024` with default `hybrid` retrieval.

Keep the infrastructure improvements: checkpointed ingest, page/chunk/embed caches, isolated profiles, status reporting, summary indexes, parent indexes, and result reporting. Do not keep chasing new retriever variants until corpus extraction quality improves or the cheapest clean full-corpus candidates below are run.

Promotion requires nDCG and bpref to agree, `hole@10 = 0`, zero benchmark failures, and acceptable latency/memory. A raw nDCG-only win is insufficient when bpref, holes, or failures disagree.

| Profile / idea | Decision | Reason |
| --- | --- | --- |
| `cuda-qwen0.6b-section-v1` | Do not promote; keep diagnostic | nDCG improves in places, but bpref falls and `hole@10` remains nonzero. |
| `cuda-qwen0.6b-small2big-v1` | Dead as default candidate | 2.23x more chunks with worse catalog/hybrid quality. |
| `cuda-qwen0.6b-small2big-dual-v1` | Do not promote; keep diagnostic | Parent BM25 is informative, but hybrid failures, holes, and bpref gate failure block promotion. |
| `cuda-qwen0.6b-docsummary-gemma4-v1` | Keep testing, not promoted | Route works, but only partial-index smoke evidence exists and full generation is costly. |
| `cuda-qwen0.6b-contextual-v1` + Gemma4 | Dead until prompt/model reliability is fixed | 9.5% context-generation failure exceeded the 2% abort threshold. |
| `cuda-qwen0.6b-longrag-v1` | Highest-priority next full test | Cheap, clean smoke; larger retrieval units are literature-backed. |
| `cuda-qwen0.6b-768-v1` / `cuda-qwen0.6b-512-v1` | Keep testing for cost/perf | Clean smokes; full benchmarks are needed before a quality recommendation. |
| Late chunking | Blocked | Current local embedding API exposes pooled vectors, not token/span pooling. |
| Qwen4B on RTX 3060 Ti 8 GB | Dead for this hardware | FP16 and 4-bit probes OOMed. |
| ColBERT/SPLADE | Skip | Existing diagnostics do not justify expensive controls. |

RAG literature consultation supports this gate: hybrid fusion work, retrieval-evaluation papers, RAPTOR/tree retrieval, LongRAG, and redundancy/coverage evaluation all reinforce that aggregate nDCG alone should not override bpref, failures, or judgment holes.

## Next Campaign Runs

Run one GPU-heavy job at a time on `desktop`:

1. Run corpus-health/fallback audit first:

   ```bash
   uv run rag-literature-rag eval corpus-health --embed-profile cuda-qwen0.6b-1024 --track catalog --json
   uv run rag-literature-rag eval corpus-health --embed-profile cuda-qwen0.6b-1024 --track pdf-deep-read --json
   ```

   The audit should identify top fallback causes and qrel-heavy fallback documents. The current warning is 879/1,918 abstract-level fallbacks, so extraction quality is likely higher ROI than another retriever variant.

   Current local audit rerun:

   | Track | Worst | Fallbacks | Top cause | Qrel fallback docs | Qrel fallback placements |
   | --- | --- | ---: | --- | ---: | ---: |
   | catalog | info | 50/2,897 (2%) | `empty_pdf_metadata_fallback` | 25 | 301 |
   | pdf-deep-read | info | 50/2,897 (2%) | `empty_pdf_metadata_fallback` | 26 | 500 |

   Chunk density remains healthy at 21,211 chunks / 1,270 docs, mean 16.7 chunks/doc, collapse 0%. The fallback rate is no longer the earlier 46% warning in the latest ingest log, but the affected documents include qrel-heavy cases such as `arxiv-2604-09430v1`, `openalex-10-18653-v1-2024-emnlp-main-981`, and `forward-10-18653-v1-2022-findings-emnlp-13`. Before running another full profile, inspect whether those documents have missing/unparseable PDFs or stale metadata-only fallbacks.

2. Run full-corpus `cuda-qwen0.6b-longrag-v1`:

   ```bash
   RAG_EMBED_PROFILE=cuda-qwen0.6b-longrag-v1 uv run rag-literature-rag ingest --force --rebuild -v
   uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-longrag-v1 \
     --qrels data/eval/qrels/catalog/qrels.json \
     --strategy dense --strategy bm25 --strategy hybrid --report -v
   uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-longrag-v1 \
     --qrels data/eval/qrels/pdf-deep-read/qrels.json \
     --strategy dense --strategy bm25 --strategy hybrid --report -v
   uv run rag-literature-rag eval diagnostics --track catalog --embed-profile cuda-qwen0.6b-longrag-v1 \
     --qrels data/eval/qrels/catalog/qrels.json
   uv run rag-literature-rag eval diagnostics --track pdf-deep-read --embed-profile cuda-qwen0.6b-longrag-v1 \
     --qrels data/eval/qrels/pdf-deep-read/qrels.json
   ```

   Promote only as an opt-in profile if it improves meaningful metrics without bpref or hole regression. Do not change the production default from this run alone.

3. Run the full-corpus reduced-dimension sweep sequentially: `cuda-qwen0.6b-768-v1`, then `cuda-qwen0.6b-512-v1`. Use the same benchmark/diagnostic commands as LongRAG, and record nDCG, bpref, `hole@10`, recall, MRR, p95 latency, index size, RSS, and build time. If 768 matches baseline quality within noise and materially reduces memory/index cost, document it as a cost profile, not the default.

4. Only after those pass, schedule full `cuda-qwen0.6b-docsummary-gemma4-v1`. Keep `docsummary_then_chunks` and `docsummary_fused_hybrid` as opt-in candidates. Do not start RAPTOR tree summaries until document-summary full-corpus quality is known.
