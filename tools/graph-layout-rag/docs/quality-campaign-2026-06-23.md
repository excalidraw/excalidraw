# Graph Layout RAG Quality Campaign - 2026-06-23

## Status

- **Phase A — thin promotion gate + weighted-RRF sweep: complete, promoted.** `eval gate` CLI
  subcommand added reusing the calibrated 2026-06-18 thresholds; `DENSE_WEIGHT=1.0,
  SPARSE_WEIGHT=2.0` promoted in `query/hybrid.py`.
- **Phase B — contextual retrieval arm (`cuda-qwen0.6b-contextual-v1`): complete, NOT promoted.**
  Full-corpus ingest succeeded (4501 docs, 21387 chunks, 0 errors) but the candidate regresses both
  tracks against the plain baseline and against the `section-v1` control under the formal gate.
- Ported from `tools/rag-literature-rag/`'s 2026-06-22 campaign: weighted-RRF fusion and contextual
  retrieval. LongRAG and RAPTOR were skipped — they did not beat contextual on rag-lit's corpus and
  were out of scope for this port.
- Raw artifacts: `data/eval/cuda-qwen0.6b-{1024,section-v1,contextual-v1}-benchmark.json`,
  `data/eval/cuda-qwen0.6b-{1024,section-v1,contextual-v1}-{catalog,pdf-deep-read}-diagnostics.json`,
  `data/contextual-ingest.log`.

## Support changes (infra)

Porting rag-lit's wins to graph's own desktop/3060 Ti setup surfaced several environment bugs,
fixed along the way:

- **`pyproject.toml` unconditional `mlx` dependency.** `graph-layout-rag` required
  `rag-common[gemini,mlx]` as a base dependency — `mlx` is Apple-Silicon-only and has no business on
  the Linux/CUDA desktop, but `uv sync` installed it anyway (no platform marker), corrupting the
  venv with a stub `mlx` namespace package. This tricked `transformers`' `is_mlx_available` check
  into `True`, and every docling extraction crashed on the subsequent real `import mlx.core`
  failure (`libmlx.so: cannot open shared object file`). Fixed by dropping `mlx` from the base deps
  (it's already an opt-in extra).
- **Torch/cuDNN version drift from the above fix.** Removing the `mlx` extra changed the dependency
  graph enough that `uv sync` re-resolved to torch 2.12.0 + cu13, whose `nvidia-cudnn-cu13` package
  shipped no actual `.so` files on this box — `ImportError: libcudnn.so.9`. Fixed by pinning
  `torch>=2.0.0,<2.6` in the base deps, landing back on torch 2.5.1+cu124 with working binaries.
- **VRAM contention on the 3060 Ti (7.66 GB total).** Three OOM rounds before settling on a stable
  config:
  1. `GRAPH_RAG_CONTEXT_WORKERS=6` (context-gen LLM workers) was conflated with extraction
     concurrency — the real knob is `GRAPH_RAG_EXTRACT_WORKERS` (default 4), which spawns one
     docling CUDA process per worker. Set to `1`.
  2. Docling-CPU fallback hit an unrelated `transformers`/MLX bug (same root cause as above, on a
     different code path) — abandoned, fixed at the source by removing `mlx` instead.
  3. Embedding batch size (`RAG_CUDA_BATCH_SIZE`) at the previous campaign's `8` overflowed once the
     embed model's resident memory (~3.8 GB) stacked with Ollama's loaded `qwen3:4b-q4_K_M`
     (~3.25 GB). Dropped to `2`. Final stable footprint: ~6.6/8 GB.
- **`systemd` linger.** The desktop's `tushar` user had `Linger=no`, so each SSH disconnect let
  `systemd-logind` reap the user's lingering processes — including the detached `tmux` session
  running the multi-hour ingest — once the login session closed. This silently killed the build
  twice mid-run with no error in the log and no exit-code file (a harder failure mode than a Python
  exception). Fixed with `loginctl enable-linger tushar`; the session survived every subsequent SSH
  check.
- **Contextual cache key versioning.** Ported rag-lit's pattern: cache key extended from
  `{fingerprint}:{chunk_index}` to `{prompt_version}:{backend}:{model}:{fingerprint}:{chunk_index}`
  so A/B runs across prompt/backend/model changes never silently reuse stale context lines.
- **Context-gen backend.** Explicitly ran via `RAG_LLM_BACKEND=ollama RAG_OLLAMA_MODEL=qwen3:4b-q4_K_M`
  (env-controlled, not profile-controlled) to avoid rag-lit's earlier 9.5% cloud-Gemini 429 failure
  rate. Context-gen failure rate on the full run: **0.0%** (0 hard fallbacks).
- **Mac dev venv side effect of the `mlx` fix.** Dropping `mlx` from the base deps (above) is
  correct for the Linux desktop, but it also meant `uv sync` on the Mac no longer installed
  `mlx-embeddings` by default, silently routing local embed calls onto the `sentence-transformers`/
  `torch`/`mps` fallback path instead. That path collides with a pre-existing cache-poisoning mock
  in `tests/test_embed.py` (it patches `rag_common.local_embed.SentenceTransformer` to return a
  fixed `[0.1, 0.2]` vector; the global model cache in `rag_common.local_embed` retains that fake
  instance after the mock context exits, corrupting later real embed calls keyed to the same model
  name). On Mac this was previously masked because `mlx-embeddings` bypassed that cache path
  entirely. Fixed locally with `uv sync --extra mlx --extra docling --extra dev` — Mac dev workflows
  should opt into the `mlx` extra explicitly now that it's no longer a forced base dependency. The
  underlying cache-poisoning bug in `rag_common.local_embed` is pre-existing and out of scope here.
- **Root cause of the prior (2026-06-15) contextual attempt.** The `gemini-2-contextual-v1` index
  had simply never been built — `data/indexes/` had no such directory, and a query against that
  profile returned `"No index for profile"`. The eval harness's "strategy worker exited with code 1"
  was that exact error swallowed by the subprocess wrapper, not a context-gen or CUDA defect.

## Baseline (`cuda-qwen0.6b-1024`, full 49/47 gold set)

| Strategy | catalog nDCG@10 | pdf-deep-read nDCG@10 | Failures |
|---|---|---|---|
| bm25 | 0.878 | 0.878 | 0 / 1 |
| hybrid (equal-weight, pre-sweep) | 0.826 | 0.812 | 0 / 1 |

Unlike rag-lit's corpus (dense-dominant), graph's pre-sweep equal-weight hybrid trailed BM25-alone —
BM25 ≈ dense on this corpus, confirmed by the bake-off referenced in the campaign plan.

## Phase A — Weighted RRF (lexical-side)

Swept `sparse_weight ∈ {0.3, 0.5, 0.7, 1.0, 1.5, 2.0}` at `dense_weight=1.0, rrf_k=20` (explicit —
`HybridTunedStrategy` defaults to `rrf_k=60`, not production's `20`) against the full gold set:

| sparse_weight | catalog nDCG@10 | pdf-deep-read nDCG@10 |
|---|---|---|
| 0.3 | 0.723 | 0.709 |
| 0.5 | 0.753 | 0.746 |
| 0.7 | 0.789 | 0.780 |
| 1.0 | 0.826 | 0.812 |
| 1.5 | 0.867 | 0.850 |
| **2.0** | **0.880** | **0.875** |

No plateau within the grid — the true optimum may sit past 2.0; out of scope for this campaign
(noted as a follow-up).

**Promoted — new default.** `DENSE_WEIGHT=1.0, SPARSE_WEIGHT=2.0` in `query/hybrid.py`, with a
code comment documenting the honest caveat: BM25-only already scores 0.878/0.878 on these tracks —
tuned hybrid barely beats it on catalog (+0.002) and *loses* to it on pdf (−0.003). The real,
gate-passing win is only over the unweighted hybrid baseline (+0.054/+0.063), not over BM25 outright.
A latent bug was found and fixed while wiring this through: `retrieve_candidates` (`retrieve.py`)
and `search_raw` (`search.py`) carried literal `dense_weight: float = 1.0, sparse_weight: float =
1.0` defaults that shadowed `hybrid.py`'s module constants — without the fix, the promoted weights
would never have reached the real query path. `retrieve_multi_query` already inherited correctly
(passes no weight kwargs).

Gate result (vs. equal-weight baseline): **PASS** both tracks, no failure increase.

## Phase B — Contextual Retrieval (`cuda-qwen0.6b-contextual-v1`)

**Not promoted — fails the gate against both the baseline and the section-v1 control.**

Full-corpus ingest: `4501 docs, 21387 chunks written, 0 skipped, 0 missing` in 2949s on desktop CUDA
(docling extraction + Qwen3-Embedding-0.6B). Context-gen failure rate 0.0%.

Benchmark (full 49/47 gold set, `hybrid` strategy):

| Profile | catalog nDCG@10 | pdf-deep-read nDCG@10 | pdf failures |
|---|---|---|---|
| `cuda-qwen0.6b-1024` (baseline) | 0.880 | 0.877 | 1 |
| `cuda-qwen0.6b-section-v1` (control) | 0.880 | 0.868 | 1 |
| `cuda-qwen0.6b-contextual-v1` (candidate) | 0.861 | 0.866 | 1 |

Gate vs. baseline: **FAIL** — catalog delta −0.0191 (need ≥+0.0100), pdf delta −0.0106 (need
≥+0.0150), both also breach the ≤0.005 opposite-track-regression rule.

Gate vs. section-v1 control: **FAIL** — catalog delta −0.0192, pdf delta −0.0017 (need ≥+0.0150);
catalog also breaches the opposite-track-regression rule.

Unlike rag-lit, where contextual was the best arm (+0.31 nDCG@10, promoted), graph's corpus does not
benefit from the context-line prefix — it behaves like graph's own `section-v1` arm (PDF +0.015 /
catalog −0.010, also not promoted): another additive indexed-text-prefix change that doesn't help a
corpus where BM25 is already strong. No failure-count regression on either comparison — the
contextual index is fully functional and lexically safe, it simply doesn't improve ranking here.

## Final Comparison (full gold set, hybrid)

| Arm | catalog nDCG@10 | pdf-deep-read nDCG@10 | Gate |
|---|---|---|---|
| Baseline (equal-weight hybrid) | 0.826 | 0.812 | — |
| **Weighted RRF (Phase A)** | **0.880** | **0.875** | **PASS** |
| section-v1 (prior campaign, control) | 0.880 | 0.868 | not promoted (prior campaign) |
| Contextual-v1 (Phase B) | 0.861 | 0.866 | **FAIL** (vs. both baseline and control) |

## Promotion Decision

`SPARSE_WEIGHT=2.0` promoted as the new default in `query/hybrid.py` — clears the calibrated gate
on both tracks with no failure increase. `cuda-qwen0.6b-contextual-v1` is **not** promoted and stays
available as a non-default profile for future re-evaluation; `cuda-qwen0.6b-1024` (now with the
weighted-RRF default) remains the production query profile. LongRAG and RAPTOR were not attempted —
they didn't beat contextual on rag-lit's corpus and contextual itself failed to clear graph's gate,
so there was no basis to expect either would fare better here.

## Follow-ups (not in this campaign's scope)

- Extend the `sparse_weight` sweep past 2.0 — no plateau was observed in the tested grid.
- Evaluate promoting BM25-only as its own benchmarked strategy: it rivals or beats the tuned hybrid
  on this corpus today.
- Consolidate the three tools' eval harnesses (`benchmark`/`metrics`/`pool`/`judge`) into a shared
  `rag-common` eval package — each tool currently carries a divergent copy.
- Expand graph's gold set beyond 49/47 cases — the small set makes ±0.01 promotion deltas noisy.

## Rerank re-test (2026-06-23)

The original reranking null result (2026-06-15, `data/eval/runs/neutral-catalog-20260615T162159Z/`)
was measured against an equal-weight `hybrid` baseline that no longer exists — production has since
moved to the weighted-RRF baseline promoted in Phase A (0.880/0.876 nDCG@10). Re-tested all 5 local
rerank strategies (`hybrid_rerank`, `hybrid_minilm_rerank`, `hybrid_local_rerank`,
`hybrid_llm_rerank`, `hybrid_category_rerank`) against the stronger baseline on `cuda-qwen0.6b-1024`,
full 49/47 gold set, both tracks. `hybrid_llm_rerank` used Ollama (`qwen3:4b-q4_K_M`, local CPU/GPU
split) via `RAG_LLM_BACKEND=ollama` to avoid the cloud-Gemini 429 path.

| Strategy | Benchmark nDCG@10 (catalog) | Benchmark nDCG@10 (pdf) | Diagnostics nDCG@10-new (catalog) | Diagnostics nDCG@10-new (pdf) | bpref (catalog) | bpref (pdf) | Gate (catalog) | Gate (pdf) | Failures (cat/pdf) |
|---|---|---|---|---|---|---|---|---|---|
| `hybrid` (baseline) | 0.880 | 0.876 | 0.641 | 0.580 | 0.387 | 0.378 | — | — | 0/1 |
| `hybrid_rerank` | 0.627 | 0.628 | 0.620 | 0.562 | 0.363 | 0.383 | BLOCK | BLOCK | 1/3 |
| `hybrid_minilm_rerank` | 0.661 | 0.605 | 0.617 | 0.531 | 0.377 | 0.372 | BLOCK | BLOCK | 1/3 |
| `hybrid_local_rerank` | 0.639 | 0.620 | 0.605 | 0.546 | 0.354 | 0.371 | BLOCK | BLOCK | 1/3 |
| `hybrid_llm_rerank` | 0.261 | 0.239 | 0.432 | 0.400 | 0.247 | 0.251 | BLOCK | BLOCK | 17/19 |
| `hybrid_category_rerank` | FAILED | FAILED | — | — | — | — | N/A | N/A | crash |

**Interpretation.** Reranking remains a clear, large null result even against the stronger
weighted-RRF baseline — this isn't a close call that the baseline shift might have flipped. On raw
benchmark nDCG@10, every rerank strategy regresses 0.2–0.64 absolute vs. baseline, with
`hybrid_llm_rerank` worst by a wide margin (also the highest failure count: 17/19 cases returned no
usable ranking, mostly LLM-rerank timeouts/parse failures on the local 4B model). All 8 gate
comparisons (4 strategies × 2 tracks; `hybrid_category_rerank` excluded, see below) returned
**BLOCK** on every threshold (nDCG gain, no-failure-increase, opposite-track-regression).

One methodology note: the diagnostics re-judged metric (LLM-judged qrels, condensed nDCG, hole-rate
— a different measurement than the benchmark's nDCG@10 against the original gold qrels) shows
smaller regressions for the three cross-encoder rerankers (0.02–0.07 absolute) and, for
`hybrid_llm_rerank` specifically, a *higher* score under diagnostics (0.43/0.40) than under the raw
benchmark (0.26/0.24). This is not a contradiction — the two metrics measure different things
(diagnostics re-judges with an LLM judge and credits partial relevance differently) — it's a
reminder that the benchmark number, not the diagnostics number, is what the gate enforces, and the
two should not be expected to agree in absolute terms.

`hybrid_category_rerank` failed outright on both tracks (`strategy worker exited with code 1`) — a
pre-existing bug unrelated to reranking quality: one gold-set case is tagged with category `'ports'`,
which isn't in `query/retrieve.py`'s `_apply_filters` category allowlist (`layer-assignment,
crossing, compound, constraints, coordinate-assignment, routing, compaction, packing, overlap`).
Worth a follow-up ticket — either add `'ports'` to the allowlist or fix the gold-set tag. Not fixed
in this pass.

**No promotions made, no defaults changed.** This is a pure record of a null result, consistent with
this campaign's no-promotion-on-null-result convention (same as the contextual-retrieval rejection
above). The production profile and default fusion weights are unchanged.

## Rejected techniques (2026-06-23): fine-tuned reranker + GraphRAG

Before building either, deep research (literature + direct corpus verification) was done to check
whether the evidence supported the investment. Both were cancelled — no code written, no GPU time
spent.

### Fine-tuned cross-encoder reranker — cancelled

Literature consensus puts the floor for "measurable gains" from cross-encoder fine-tuning at
~1K-50K labeled query-document triples. This corpus's entire gold set is 96 cases (49 catalog + 47
pdf) — 10-20x below even the optimistic floor, and the documented failure mode at this scale is
overfitting/unstable training, not modest underperformance.

Worse: this isn't a neutral starting point. Every off-the-shelf reranker already tested on this
corpus this session (`bge-reranker-v2-m3`, MS MARCO MiniLM, LLM listwise rerank via local
`qwen3:4b`) **actively regresses** retrieval 0.2-0.64 nDCG@10 below the weighted-RRF hybrid baseline
— all 8 gate comparisons BLOCK (see "Rerank re-test" section above). That's not "miscalibrated,
fine-tuning might fix it" — the reranking technique family appears to fight this corpus's natural
retrieval shape (BM25-dominant, exact technical-term matching on short factual queries), which
fine-tuning on a tiny dataset can't plausibly change.

**Caveat:** the 96-case gold set isn't a permanent ceiling. rag-literature-rag has a `gen-gold`
synthetic gold-generation capability in the same eval-infra family — if something similar were
built for graph-layout-rag, "insufficient training signal" becomes a "haven't done it yet," not a
"can't." The verdict holds given the gold set as it exists today.

### GraphRAG / knowledge-graph retrieval — cancelled

Corpus size is **not** the blocker: 44,672 chunks (~5,947 docs, 1,121 fully indexed) is well above
GraphRAG's commonly-cited ~500K-token viability threshold.

Query type **is** the blocker. Direct inspection of the actual gold-set queries
(`layer-assignment-network-simplex`, `constraints-vpsc`, "VPSC separation constraints
IPSep-CoLa", "left edge algorithm channel routing", etc.) shows ~95%+ are single-hop factual
lookups ("what does the corpus say about algorithm X"), not multi-hop or relational. Microsoft's
own GraphRAG research is explicit: flat/vector RAG beats graph-based RAG on single-fact lookup;
graph-based retrieval only wins on multi-hop and "sensemaking" queries.

Independent corroborating evidence (not the same mechanism as full GraphRAG, but pointing the same
direction): this corpus already has a citation graph (bibliographic coupling, co-citation,
personalized PageRank) wired into the `hybrid_citation` retrieval strategy, benchmarked
2026-06-15. README.md states: *"citation relatedness did not improve query relevance in the
current evaluation."* Citation-graph proximity and full GraphRAG's LLM-extracted entity/relation
graphs are different techniques solving different sub-problems — this is supporting evidence that
graph-shaped signal doesn't help this corpus's query mix, not literal proof that GraphRAG itself
would fail. The primary basis for cancellation is the query-type finding above.

### Re-evaluation triggers

Check at this tool's next quality-campaign cycle (campaigns already run periodically — 2026-06-15,
2026-06-18, 2026-06-23) whether either condition has changed:
- The gold set has grown substantially past its current 96 cases (e.g. via `gen-gold`-style
  synthetic expansion) — would make reranker fine-tuning worth reconsidering.
- The query mix has shifted toward multi-hop/relational questions (check: does the gold set still
  skew ~95% single-hop?) — would make GraphRAG worth reconsidering.

**No promotions, no code changes, no GPU time spent.** Full research findings and memory entries:
[[graph-rag-rerank-retest-rejected]] (reranking, including this fine-tuning addendum) and
[[graph-rag-graphrag-rejected]].
