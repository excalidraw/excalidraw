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
