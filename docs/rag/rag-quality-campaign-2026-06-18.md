# Local RAG Quality Campaign - 2026-06-18

## Scope

This campaign covers `graph-layout-rag` first and `rag-literature-rag` second. It stays local-first: no cloud embeddings, no cloud LLM generation, and no paid cloud reranking during the campaign runs.

Detailed reports:

- [Graph layout report](graph-layout-rag-quality-campaign-2026-06-18.md)
- [RAG literature report](../tools/rag-literature-rag/docs/quality-campaign-2026-06-18.md)

## Implemented Support

- New local CUDA profiles: `cuda-qwen4b-1024`, `cuda-qwen4b-2560`, `cuda-qwen0.6b-section-v1`, `cuda-qwen0.6b-small2big-v1`, `cuda-qwen0.6b-small2big-dual-v1`, `cuda-qwen0.6b-contextual-v1`, `cuda-qwen0.6b-longrag-v1`, `cuda-qwen0.6b-512-v1`, and `cuda-qwen0.6b-768-v1`.
- Contextual augmentation routes through `rag_common.local_llm`, enabling Ollama on `desktop`.
- Failed/empty contextual generations are not cached.
- Rag-lit contextual builds no longer read zero chunks when no limit is supplied.
- Rag-lit query transforms are RAG-specific and local-LLM aware.
- Rag-lit harvest/tag code no longer injects graph-layout tags.
- Graph now has `eval corpus-health`.
- Small2big and section-enriched chunking variants are first-class profiles with separate fingerprints/chunk-cache keys.
- Rag-lit true small-to-big retrieval is implemented as `cuda-qwen0.6b-small2big-dual-v1`: child chunks are retrieved, aggregated to parent chunks, and compared with parent BM25 through `small2big_dense`, `small2big_parent_bm25`, and `small2big_hybrid`.
- Rag-lit document-summary chunks are implemented as `cuda-qwen0.6b-docsummary-gemma4-v1`: Gemma4 summaries are cached separately, indexed into a separate `summaries` table and `bm25_summary/`, and exposed only through explicit `docsummary_*` strategies.
- Rag-lit contextual cache keys now include LLM backend and active model, preventing cross-model context reuse.
- Rag-lit LongRAG larger-unit chunks are implemented as `cuda-qwen0.6b-longrag-v1`.
- Rag-lit embedding cache now reuses vectors across profiles when backend, model, dims, quant, title, and final indexed text are unchanged.
- Rag-lit extraction caching now has a reusable page layer keyed by PDF SHA, backend, and extraction options, so future chunking profiles can avoid re-running Docling after the page cache is populated.
- Remote scripts are hardened with tmux logs, GPU samples, exit codes, and sentinels.

## Baseline Snapshot

Profile: `cuda-qwen0.6b-1024`.

| Corpus | Track | Best nDCG@10 | Best arm | Default-relevant note |
| --- | --- | --: | --- | --- |
| graph-layout | catalog | 0.718 | hybrid | BM25 has higher MRR, hybrid has higher nDCG/R@10 |
| graph-layout | pdf | 0.683 | hybrid_sparse2 | hybrid is close at 0.681 with best R@10 |
| rag-lit | catalog | 0.625 | hybrid_rrf100 | BM25 is close at 0.621 and has `hole@10 = 0` |
| rag-lit | pdf | 0.679 | hybrid / bm25 | hybrid has best R@10; BM25 is fastest |

## Completed A/B Runs

### Rag-Lit Section-Enriched

Profile: `cuda-qwen0.6b-section-v1`. Built as a separate index on `desktop`; `cuda-qwen0.6b-1024` remains untouched.

| Track | Best section arm | nDCG@10 | Delta | Decision |
| --- | --- | --: | --: | --- |
| catalog | hybrid_rrf100 | 0.633 | +0.008 | Do not promote: bpref fell and `hole@10` remains nonzero |
| pdf | hybrid_rrf100 | 0.691 | +0.013 | Do not promote yet for same gate failure |

Section enrichment is promising for nDCG, especially PDF retrieval, but it does not pass the rag-lit promotion gate because bpref does not improve.

### Rag-Lit Qwen4B Probe

Profile: `cuda-qwen4b-1024`. The 512-chunk probe on the RTX 3060 Ti failed both FP16 and 4-bit benchmark arms with CUDA OOM and was stopped before any full index was synced back. `cuda-qwen4b-2560` is skipped for this GPU setup.

### Rag-Lit Small2big

Profile: `cuda-qwen0.6b-small2big-v1`. Built as a separate index on `desktop`; `cuda-qwen0.6b-1024` remains untouched. The build completed cleanly: 1,270 docs, 47,219 chunks, 4h 41m 14s, exit 0, crash grep 0.

| Track | Best small2big arm | nDCG@10 | Delta | Decision |
| --- | --- | --: | --: | --- |
| catalog | hybrid_dense2 | 0.598 | -0.027 vs baseline best | Do not promote: catalog and BM25 regress, `hole@10` remains high |
| pdf | bm25 | 0.679 | +0.000 vs baseline best | Do not promote: hybrid arms regress and bpref gate fails |

Small2big is useful evidence against smaller child chunks as the next default for rag-lit. It may still be worth inspecting specific chunking queries, but it fails the promotion gate.

### Rag-Lit True Small-To-Big

Profile: `cuda-qwen0.6b-small2big-dual-v1`. Implemented as a separate parent-child index profile; production and previous campaign indexes remain untouched.

Build and benchmark status: complete. The isolated build produced 46,602 child chunks and 20,318 parent chunks; the smoke query returned parent evidence with `child_hits`. Benchmarks covered only `dense`, `bm25`, `hybrid`, `small2big_dense`, `small2big_parent_bm25`, and `small2big_hybrid` on catalog and PDF synthetic qrels.

Decision: do not promote. `small2big_hybrid` improved raw benchmark nDCG@10 on both tracks (`0.565` catalog, `0.646` pdf-deep-read), but every benchmark arm had nonzero failures. Diagnostics kept nonzero holes for the best hybrid arm (`0.315` catalog, `0.239` pdf-deep-read), while parent BM25 nearly closed holes but had lower bpref/nDCG. Treat this as useful diagnostic evidence, not an opt-in recommendation.

### Rag-Lit Gemma4 Article Summary Chunks

Profile: `cuda-qwen0.6b-docsummary-gemma4-v1`. Implementation and 50-document smoke are complete; full corpus was intentionally not run.

| Smoke                           |  Value |
| ------------------------------- | -----: |
| documents                       |     50 |
| normal chunks                   |  1,114 |
| summaries                       |     50 |
| runtime                         | 658.2s |
| skipped/missing/fallback/errors |      0 |

The corrected prompt/cache version rejected short bad outputs and produced 150-168 word summaries in inspected samples. A RAPTOR smoke query ranked the RAPTOR paper first for BM25, hybrid, two-stage, and fused summary modes. The 50-doc benchmark is route-only evidence because most qrel targets are absent from the partial index; failures remained high for all summary strategies.

Decision: do not promote and do not run full corpus yet. The route is viable, but full generation is a multi-hour desktop job and the partial-index benchmark is not quality evidence. Later sourced CUDA runs resolved the earlier missing `libnvJitLink` setup issue.

### Rag-Lit Gemma4 Contextual Chunking

Profile: `cuda-qwen0.6b-contextual-v1`. Smoke complete; full corpus not run.

The accepted one-document smoke generated 19 of 21 context lines and failed 2, for a 9.5% context-generation failure rate. This exceeds the campaign abort threshold of 2%. The earlier 10-document cached smoke completed but is rejected as evidence because it predated the model-scoped cache-key fix.

Decision: do not promote and do not run full corpus until Gemma4 contextual generation is reliable.

### Rag-Lit LongRAG Larger Retrieval Units

Profile: `cuda-qwen0.6b-longrag-v1`. Smoke complete; full corpus not run.

The 50-document smoke built 522 larger chunks in 78.5s with zero skipped/missing and zero crash lines. A RAPTOR query smoke returned the RAPTOR paper at rank 1. The partial catalog benchmark is route-only; `hybrid` reached nDCG@10 `0.082` with 364 failures because most qrel targets are absent from the partial index.

Decision: no promotion decision from the smoke. This is the cheapest remaining candidate for a future full-corpus run.

### Rag-Lit Qwen3 Dimension Sweep

Profiles: `cuda-qwen0.6b-512-v1` and `cuda-qwen0.6b-768-v1`. Smokes complete; full corpus not run.

| Profile | Documents | Chunks | Runtime | Exit | Crash grep | Query smoke |
| --- | --: | --: | --: | --: | --: | --- |
| `cuda-qwen0.6b-512-v1` | 50 | 1,114 | 121.9s | 0 | 0 | RAPTOR paper rank 1 |
| `cuda-qwen0.6b-768-v1` | 50 | 1,114 | 122.7s | 0 | 0 | RAPTOR paper rank 1 |

Decision: no promotion decision from smoke evidence. Both reduced-dimension profiles are viable, but full-corpus benchmarks are required before recommending a smaller dimensionality than `cuda-qwen0.6b-1024`.

### Rag-Lit Late Chunking Feasibility

Status: blocked. The current local CUDA embedding path uses pooled `SentenceTransformer.encode(...)` vectors and does not expose token embeddings, token-to-character spans, or span pooling. A `cuda-latechunking-v1` profile would be misleading until the embedding layer can produce span-pooled vectors.

### Graph Section-Enriched

Profile: `cuda-qwen0.6b-section-v1`. Built as a separate index on `desktop`; `cuda-qwen0.6b-1024` remains untouched.

| Track | Best section arm | nDCG@10 | Delta | Decision |
| --- | --- | --: | --: | --- |
| catalog | hybrid_sparse2 | 0.711 | -0.007 vs baseline best | Do not promote: default `hybrid` regressed by 0.010 |
| pdf | hybrid | 0.696 | +0.015 vs baseline `hybrid` | Useful PDF gain, but catalog gate fails |

Graph section enrichment is a PDF-focused win but not a default-profile win.

## Chunking Extension

Advanced chunking is now part of the campaign:

- `section-v1`: enrich indexed text with document and section metadata while preserving clean stored passages.
- `small2big-v1`: index smaller child chunks with `target=350`, `max=550`, and profile-specific chunk-cache keys. Rag-lit now also stores backend page extraction separately so later chunk variants can reuse Docling output.
- `small2big-dual-v1`: index both small child chunks and baseline-sized parent chunks from the same structural blocks. Query-time small-to-big retrieves children but returns parent evidence, with parent BM25 available under `bm25_parent/`.
- `contextual-v1`: prepend local-LLM generated context to indexed text through Ollama-compatible `rag_common.local_llm`.

Most entries are embed/index profiles; `small2big-dual-v1` also adds explicit query/eval strategies. Build and evaluate them one at a time against the existing qrels.

## Next Execution Order

1. Full-corpus Rag-lit LongRAG or dimension sweep only if non-generation chunk-size/dimension experiments get more GPU time.
2. Rag-lit RAPTOR-style summary tree only after document summaries prove stable at full-corpus scale.
3. ColBERT/SPLADE controls only if diagnostics show a miss class they should recover.

Do not rerun broad ColBERT/SPLADE/reranker sweeps unless diagnostics identify a new failure mode.
