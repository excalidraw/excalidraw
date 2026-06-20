# RAG Embedding Patterns Campaign - 2026-06-18

## Scope

This is a rag-lit-first execution plan for isolated embedding and indexing experiments. The baseline remains `cuda-qwen0.6b-1024`; every experiment below is built as a separate profile under `tools/rag-literature-rag/data/indexes/{profile}/`, benchmarked one at a time on `desktop`, and compared against the baseline before any promotion decision.

The campaign is local-only. Use the `desktop` GPU, Ollama, Qwen3 embeddings, Gemma4 local generation, and existing qrels. Do not add new paid or cloud control runs for this campaign.

Current starting point:

- `cuda-qwen0.6b-section-v1`: built, benchmarked, not promoted.
- `cuda-qwen0.6b-small2big-v1`: built, benchmarked, not promoted.
- `cuda-qwen0.6b-small2big-dual-v1`: built, benchmarked, diagnosed, and not promoted.
- Default query behavior remains `hybrid`.

## Research Basis

- RAPTOR recursively embeds, clusters, and summarizes chunks into a retrieval tree, so it is the basis for the later summary-tree profile rather than the first experiment: [RAPTOR, arXiv 2401.18059](https://arxiv.org/abs/2401.18059).
- Contextual Retrieval prepends chunk-specific context before embedding and BM25 indexing, which maps cleanly to the existing contextual profile: [Anthropic engineering](https://www.anthropic.com/engineering/contextual-retrieval) and [Claude cookbook](https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide).
- Late chunking embeds long context first and pools chunk token spans afterward; it is kept as a feasibility spike because it requires token embeddings or span pooling from the local embedding path: [Jina late chunking](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) and [arXiv PDF](https://arxiv.org/pdf/2409.04701).
- HyDE embeds generated hypothetical documents for zero-shot retrieval, but prior local evidence keeps it out of the first queue: [ACL Anthology](https://aclanthology.org/2023.acl-long.99/).
- Qwen3 embeddings support the local 0.6B/4B/8B family and dimension/instruction experiments: [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) and [Qwen3 embedding paper PDF](https://arxiv.org/pdf/2506.05176).
- Gemma4 is the local generation candidate for article summaries and contextual prefixes: [Google DeepMind Gemma 4](https://deepmind.google/models/gemma/gemma-4/), [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4), and [Ollama `gemma4:e4b`](https://ollama.com/library/gemma4%3Ae4b).
- Parent-child and summary retrieval are established enough to justify first-class profiles and explicit eval arms: [LlamaIndex Auto Merging Retriever](https://developers.llamaindex.ai/python/framework/integrations/retrievers/auto_merging_retriever/), [LlamaIndex Document Summary Index](https://www.llamaindex.ai/blog/a-new-document-summary-index-for-llm-powered-qa-systems-9a32ece2f9ec), and [LangChain ParentDocumentRetriever](https://reference.langchain.com/python/langchain-classic/retrievers/parent_document_retriever/ParentDocumentRetriever/).
- ColBERTv2, SPLADE, and Matryoshka Representation Learning are lower-priority controls because existing graph-layout evidence says they are expensive and did not beat tuned hybrid: [ColBERTv2](https://arxiv.org/abs/2112.01488), [SPLADE](https://arxiv.org/abs/2107.05720), and [Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147).

## Experiment Queue

### 1. Finish True Small-To-Big Dual

Profile: `cuda-qwen0.6b-small2big-dual-v1`.

Status: complete. The full isolated build, smoke query, catalog/PDF benchmarks, and per-track diagnostics completed on `desktop`; the profile is not promoted.

Retrieval arms:

- `dense`
- `bm25`
- `hybrid`
- `small2big_dense`
- `small2big_parent_bm25`
- `small2big_hybrid`

Execution:

```bash
cd tools/rag-literature-rag
RAG_EMBED_PROFILE=cuda-qwen0.6b-small2big-dual-v1 uv run rag-literature-rag ingest --force --rebuild -v
uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-small2big-dual-v1 \
  --qrels data/eval/qrels/catalog/qrels.json \
  --strategy dense --strategy bm25 --strategy hybrid \
  --strategy small2big_dense --strategy small2big_parent_bm25 --strategy small2big_hybrid \
  --report -v
uv run rag-literature-rag eval benchmark --embed-profile cuda-qwen0.6b-small2big-dual-v1 \
  --qrels data/eval/qrels/pdf-deep-read/qrels.json \
  --strategy dense --strategy bm25 --strategy hybrid \
  --strategy small2big_dense --strategy small2big_parent_bm25 --strategy small2big_hybrid \
  --report -v
```

Decision rule: promote only if synthetic nDCG and bpref improve on catalog and PDF, `hole@10 = 0`, and failures stay zero. If only `small2big_parent_bm25` wins, document that lexical parent context helped but keep the default unchanged.

Result: do not promote. The build produced 46,602 child chunks and 20,318 parent chunks, and the smoke query returned parent evidence with `child_hits`. `small2big_hybrid` had the best raw nDCG@10 on both benchmark tracks (`0.565` catalog, `0.646` pdf-deep-read), but all benchmark arms had nonzero failures. Diagnostics also showed nonzero holes for the best hybrid arm (`hole@10 = 0.315` catalog, `0.239` pdf-deep-read), and bpref did not improve over the comparable baseline on both tracks. See `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-small2big-dual-build/result.md`.

### 2. Gemma4 Article Summary Chunks

Profile: `cuda-qwen0.6b-docsummary-gemma4-v1`.

Status: implementation and 50-document smoke complete; full corpus not run.

Use `gemma4:e4b` on `desktop` through Ollama to generate one source-grounded summary chunk per paper. The first run is a 50-document smoke build for prompt quality and throughput; run the full corpus only if summaries are clean.

Summary prompt requirements:

- Produce concise retrieval-oriented text covering problem, methods, datasets, key terms, findings, limitations, and aliases.
- Stay source-grounded.
- Do not invent citations, datasets, findings, or limitations.
- Preserve important acronyms and alternate names.

Cache generated summaries separately from extraction/page caches. The cache key must include PDF SHA, model, prompt version, extraction options, and source text hash.

Index summaries in a new summary table and BM25 index. Do not replace normal chunks.

Eval arms:

- `docsummary_dense`
- `docsummary_bm25`
- `docsummary_hybrid`
- `docsummary_then_chunks`
- `docsummary_fused_hybrid`

Decision rule: promote no default behavior. If the fused or two-stage arm wins without catalog regression, document it as an opt-in deep-read strategy until it passes the full promotion gate.

Result: do not promote and do not run full corpus yet. The implementation writes summaries to a separate `summaries` table plus `bm25_summary/`, keeps normal chunks unchanged, and registers the five opt-in summary strategies. The corrected 50-document smoke built 1,114 normal chunks and 50 summaries in 658.2s with zero skipped/missing/fallback/errors. The RAPTOR smoke query ranked the RAPTOR paper first for BM25, hybrid, two-stage, and fused summary modes. The partial 50-doc benchmark is route-only evidence: most qrel targets are absent and failures are high. Later sourced CUDA runs resolved the earlier missing `libnvJitLink` setup issue, but full document-summary generation remains a multi-hour job. See `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-docsummary-gemma4-v1/result.md`.

### 3. Gemma4 Contextual Chunking

Profile: `cuda-qwen0.6b-contextual-gemma4-v1`, or reuse `cuda-qwen0.6b-contextual-v1` if that profile already routes to Ollama and can record the Gemma4 model/prompt version.

Status: smoke complete with `cuda-qwen0.6b-contextual-v1`; full corpus not run.

Generate a 1-2 sentence contextual prefix for each chunk using document title, section path, and surrounding document text. Indexed text is `context + chunk`; stored evidence text remains clean.

Benchmark only:

- `dense`
- `bm25`
- `hybrid`

This is lower risk than RAPTOR because it preserves the existing chunk schema. Abort or retry if contextual generation failures exceed 2%.

Result: stopped at smoke. A cache-key bug was fixed so contextual cache entries now include LLM backend and active model; this prevents Gemma4 runs from reusing stale context lines generated by another model. The accepted one-document Gemma4 smoke generated 19 of 21 context lines and failed 2, a 9.5% failure rate. That exceeds the 2% abort threshold, so no full contextual build or benchmark was run. See `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-contextual-gemma4-v1/result.md`.

### 4. RAPTOR-Style Summary Tree

Profile: `cuda-qwen0.6b-raptor-gemma4-v1`.

Run only after doc-summary chunks prove Gemma4 summaries are stable. Build section-level and document-level summaries from existing chunks, optionally with one clustering level after section summaries.

Summary nodes must store:

- `level`
- `source_chunk_ids`
- `source_pages`
- `section_path`
- `summary_model`
- `prompt_version`

Retrieval arms:

- `raptor_summary_dense`
- `raptor_summary_hybrid`
- `raptor_tree_fused`

Decision rule: keep this opt-in unless it beats baseline on catalog and PDF synthetic qrels with zero holes and acceptable latency.

### 5. LongRAG / Larger Retrieval Units

Profile: `cuda-qwen0.6b-longrag-v1`.

Status: implementation and 50-document smoke complete; full corpus not run.

Build larger units around sections or contiguous page spans, targeting roughly 1600-2400 tokens with overlap. Compare parent-sized dense, BM25, and hybrid retrieval to the current baseline and `cuda-qwen0.6b-small2big-dual-v1`.

This is cheap because it needs no LLM generation. Run it before additional generation-heavy experiments if the queue is blocked on Gemma4 throughput.

Result: viable smoke, no promotion decision. The `longrag-v1` chunking profile uses larger units (`target=1800`, `max=2400`, `min=600`, `overlap=240`) and the CUDA Qwen3-0.6B profile. A 50-document smoke built 522 chunks in 78.5s with zero skipped/missing and zero crash lines. The RAPTOR query smoke returned the RAPTOR paper at rank 1. Partial catalog benchmark results are route-only because most qrel targets are absent; `hybrid` reached nDCG@10 `0.082` with 364 failures. See `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-longrag-v1/result.md`.

### 6. Qwen3 Dimension / Instruction Sweep

Status: 50-document smokes complete for 512 and 768 dimensions; full corpus not run.

Profiles:

- `cuda-qwen0.6b-512-v1`
- `cuda-qwen0.6b-768-v1`
- `cuda-qwen0.6b-1024`

Keep chunking identical; only change output dimension and query/document instruction text where the local embedding backend supports it. Benchmark quality, index size, build time, query latency, and memory.

Do not rerun Qwen4B on the 8 GB GPU unless the previous OOM condition changes.

Result: both reduced-dimension profiles built clean 50-document indexes with the same 1,114 chunks as the baseline chunking smoke. `cuda-qwen0.6b-512-v1` completed in 121.9s; `cuda-qwen0.6b-768-v1` completed in 122.7s. Both runs had exit code 0, zero skipped/missing documents, zero crash-grep lines, and 10 checkpoints. The RAPTOR smoke query ranked `RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval` first for both profiles. No promotion decision from smoke evidence; full-corpus benchmarks are required before recommending a smaller dimensionality. See `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-cuda-qwen0.6b-512-v1/result.md` and `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-cuda-qwen0.6b-768-v1/result.md`.

### 7. Late Chunking Feasibility Spike

Status: feasibility spike complete; blocked by current local embedding API.

Required condition: a local long-context embedding path that exposes token embeddings or supports span pooling. If feasible, add `cuda-latechunking-v1`; otherwise document the spike as blocked by embedding API/model support.

Result: do not add `cuda-latechunking-v1` yet. The current CUDA local embedding path uses `SentenceTransformer.encode(...)`, which returns pooled vectors and supports `truncate_dim`, but does not expose token embeddings, token-to-character spans, or span pooling. Implementing a profile on top of that API would not be late chunking. See `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-latechunking-feasibility/result.md`.

### 8. ColBERT/SPLADE Controls

Status: skipped. Diagnostics did not identify a new miss class that justifies running expensive ColBERT/SPLADE controls in this campaign.

## Public Interfaces And Data Shapes

Standardize profile naming as `cuda-qwen0.6b-{pattern}-v1` unless the pattern uses a non-Qwen embedding backend.

Every new index must be non-destructive and isolated under its own profile directory:

```text
tools/rag-literature-rag/data/indexes/{profile}/
```

Summary-like rows should include:

- `id`
- `doc_id`
- `title`
- `text`
- `summary_level`
- `source_chunk_ids`
- `page`
- `page_end`
- `section_path`
- `summary_model`
- `prompt_version`
- `canonical_sha256`
- `tags`
- `pipeline_categories`
- `vector`

Retrieval strategies should be opt-in eval arms. Default query stays `hybrid`.

Generated text caches must be separate from extraction/page caches and include prompt/model/source hashes.

## Test And Acceptance Plan

Unit tests:

- Cache keys change when prompt version, model, source text, PDF SHA, or extraction options change.
- Summary rows preserve source provenance and never overwrite normal chunk rows.
- Query strategies fail clearly when required summary/parent indexes are absent.
- Eval registry accepts all new strategy names.

Integration smoke:

- Build a tiny fixture with two PDFs and verify summary retrieval returns summary text plus source chunk IDs.
- Verify `docsummary_then_chunks` returns normal evidence after summary-stage document selection.
- Verify `embed indexes --json` reports summary/parent counts and cache stats.

Full acceptance:

- Benchmark each profile on catalog and PDF synthetic qrels.
- Required report fields: nDCG@10, bpref, hole@10, recall@10, MRR, p95 latency, failures, chunks/summary count, GPU time, and cache hit rate.
- Promotion requires synthetic nDCG and bpref both improve, `hole@10 = 0`, zero failures, and no unacceptable latency or memory regression.
- If an arm improves only PDF but regresses catalog, keep default unchanged and document it as a targeted deep-read option.

## Operating Rules

- Run one GPU-heavy job at a time on `desktop`.
- Record raw artifacts under `tools/rag-literature-rag/data/eval/runs/20260618-embedding-patterns-*`.
- Use existing qrels and existing local caches where valid.
- Do not build during query or benchmark work on memory-constrained machines.
- Do not promote a profile from a single metric. Treat nDCG deltas as suspect unless bpref and hole-rate agree.
- Keep graph-layout-rag out of scope until rag-lit produces a clear winner that should be inherited.
