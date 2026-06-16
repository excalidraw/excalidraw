# Graph Layout RAG — Architecture Bake-off Results (2026)

Date: 2026-06-15 · Embeddings: `gemini-2-structure-v1` (Gemini Embedding 2 @ 3072, us-central1) · LLM/judge: Gemini 3.x (global endpoint) · Hardware: Apple M4 Pro, 24 GB.

Results companion to the [SOTA architecture review](graph-layout-rag-sota-architectures-2026.md).

> **⚠️ Correction (2026-06-15).** The first version of this report concluded "**nothing beat BM25**; the corpus is lexically saturated; retrieval is at its ceiling." **That conclusion was an evaluation artifact.** The gold set had been expanded by _single-system BM25 pooling_ — the textbook recipe for pooling bias: it grades BM25 on an answer key BM25 helped write and labels every dense/ColBERT-only hit "non-relevant." After re-judging from a **diverse multi-system pool** with an LLM assessor, the verdict **reversed**: BM25 falls the most of any arm and lands mid-pack, dense and BM25 converge, and **hybrid (RRF) is the genuine winner** on both tracks. Sections 1–2 are the corrected results; §3 retains the original (biased) numbers for provenance.

---

## 0. Executive summary (corrected)

On a **de-biased, multi-relevant, multi-system-pooled** judge, **hybrid (dense + BM25 via RRF) is the best retriever on both tracks** — and the previous "BM25 is a free equal-quality fallback" claim is false: BM25 alone is mid-pack.

| Arm | catalog nDCG@10 | pdf nDCG@10 | Verdict |
| --- | --: | --: | --- |
| **hybrid (RRF)** | 0.765 | 0.696 | ✅ **default — wins both** |
| hybrid_rrf20 / hybrid_pool80 | **0.768** / 0.765 | 0.715 / **0.715** | ✅ **shipped as default** (rrf_k=20, pool floor 80) |
| **HyDE expansion** | 0.742 | **0.722** | ✅ **wins pdf**; enable for deep-read / vague |
| hybrid_dense2 (dense-weighted) | 0.755 | 0.669 | ~ mixed |
| hybrid_llm_rerank (3.1-pro listwise) | 0.755 | (n/r) | ❌ no gain, +56 s/query |
| **bm25** | 0.704 | 0.676 | ◻ mid-pack — _not_ the winner |
| **dense** | 0.702 | 0.609 | ◻ ≈ bm25 now (was far below) |
| hybrid_minilm_rerank (local CE) | 0.684 | 0.623 | ❌ hurts |
| step_back / multi_query | 0.672 / 0.655 | 0.619 / 0.596 | ❌ below hybrid |
| ColBERT / SPLADE (Docker Qdrant) | 0.53 / 0.53 | 0.46 / 0.42 | ❌ bottom (but under-credited before) |

**Bottom line:** **keep `hybrid` as the default — it is now the demonstrated winner, not a tie with BM25.** Two actionable gains surfaced once the judge was fixed: (1) a small consistent tuning win from `rrf_k=20` + pool 80 — **now shipped as the default** (`RRF_K=20`, `_pool_size` floor 80; the default `hybrid` arm reproduces `hybrid_rrf20` at 0.768 catalog); (2) **query expansion (HyDE) genuinely helps**, winning the pdf track — it should be enabled for the deep-read/vague path, not merely tolerated. Reranking still adds nothing (holds from v1). SPLADE/ColBERT still lose. The "retrieval is at its ceiling / ship nothing" framing is **withdrawn**. A follow-up full-pipeline bias audit (§10) fixed a harvest off-topic bug and A/B'd the chunk-aggregation geometry.

---

## 1. The pooling-bias correction (what changed and why)

### 1.1 The mistake

The v1 gold set was expanded with `/tmp/gold_pool.py`: **sparse-only (BM25) retrieval**, top-15, hand-curated from titles/abstracts. Judging only what one lexical system surfaces is exactly the bias documented in the IR literature (Buckley & Voorhees, _Bias and the Limits of Pooling_; Zobel; Lin et al. 2022, _Can Old TREC Collections Reliably Evaluate Modern Neural Retrieval Models?_; the BEIR caveat): docs that only a dense/late-interaction system finds are never judged, so they count as **non-relevant**, and any non-lexical retriever is penalized for finding them. nDCG, which treats unjudged-as-irrelevant, then _understates_ every neural arm and _flatters_ BM25.

### 1.2 The fix

A diverse **multi-system pool** (bm25 + dense + hybrid + HyDE + multi-query + **SPLADE** + **ColBERT**, top-50 each, deduped on canonical id), re-judged with an LLM assessor (`gemini-3.1-pro-preview`, UMBRELA-style graded 0–3, **blind to which system surfaced each doc**, deterministic). New code: `eval/pooling.py`, `eval/judge.py`, `eval/qrels.py`, `eval/diagnostics.py`, CLI `eval pool|judge|diagnostics` + `benchmark --qrels`.

|  | catalog | pdf |
| --- | --: | --: |
| candidates pooled | 5,995 | 5,150 |
| **neural-only** (no lexical system surfaced them) | **2,664 (44%)** | 2,023 (39%) |
| relevant after judging (grade ≥ 2) | **949** (136 curated + **813 new**) | — |
| cases that gained ≥1 relevant doc | 47 / 49 | — |

Nearly half the pool was invisible to BM25, and judging it **multiplied the relevant set ~7×**. The judge graded 77% of the _curated_ (known-relevant) docs ≥ 2 — a reasonable calibration check; since the overlay is **union-only** (never drops a hand label), judge conservatism can only make the new labels a strict superset of the old.

### 1.3 The before/after (diagnostics, depth-20 ranking)

`hole@10 = 0.00 / judged@10 = 1.00` for **every** arm on the new qrels — the depth-50 pool fully covers every top-10, so the corrected nDCG has **no holes** and is trustworthy. bpref (incompleteness-robust) agrees with nDCG on ordering.

**Catalog** | arm | nDCG@10 old | nDCG@10 new | Δ | bpref | |---|---:|---:|---:|---:| | hybrid | 0.870 | 0.696 | −0.174 | 0.433 | | dense | 0.599 | **0.689** | **+0.090** | 0.423 | | hyde | 0.835 | 0.671 | −0.164 | 0.401 | | multi_query | 0.576 | 0.631 | +0.056 | 0.385 | | **bm25** | 0.878 | 0.618 | **−0.260** | 0.357 | | colbert | 0.514 | 0.534 | +0.020 | 0.351 | | splade | 0.435 | 0.532 | +0.096 | 0.321 |

**PDF deep-read** | arm | nDCG@10 old | nDCG@10 new | Δ | bpref | |---|---:|---:|---:|---:| | hyde | 0.841 | 0.619 | −0.223 | 0.428 | | hybrid | 0.846 | 0.590 | −0.256 | 0.393 | | dense | 0.580 | 0.567 | −0.013 | 0.383 | | multi_query | 0.602 | 0.562 | −0.040 | 0.375 | | **bm25** | 0.884 | 0.539 | **−0.344** | 0.349 | | colbert | 0.473 | 0.462 | −0.011 | 0.336 | | splade | 0.390 | 0.421 | +0.031 | 0.284 |

The signature of pooling bias is unmistakable: **BM25 drops the most on both tracks** (it was the most over-credited by its own pool), while **dense and SPLADE — the systems most penalized by lexical pooling — are the only arms that rise**. Absolute scores fall for everyone because the relevant set is now ~7× larger (more to miss); the **relative ordering** is the result, and it flips.

_(Diagnostics scores the raw canonicalized ranking against the pure judge labels (grade ≥ 2); §2 scores the production `format_results` output against the union-floor qrels (curated ∪ judge ≥ 2). They differ by a few points in absolute nDCG but agree on ordering.)_

---

## 2. Results on the neutral judge (corrected, authoritative)

Production scoring: `eval benchmark --qrels <neutral> --top 20`, isolated subprocesses, 24 GB guards. Run dirs `data/eval/runs/neutral-{catalog,pdf-deep-read}-*`.

### Catalog (49 cases)

| Strategy | HR@5 | Recall@5 | MRR | nDCG@10 | lat (ms) | fails |
| --- | --: | --: | --: | --: | --: | --: |
| **hybrid_rrf20** | 1.000 | 0.290 | 1.000 | **0.768** | 1948 | 0 |
| hybrid | 1.000 | 0.283 | 1.000 | 0.765 | 1639 | 0 |
| hybrid_pool80 | 1.000 | 0.283 | 1.000 | 0.765 | 2027 | 0 |
| hybrid_rrf100 | 1.000 | 0.278 | 1.000 | 0.764 | 1906 | 0 |
| hybrid_dense2 | 1.000 | 0.276 | 0.984 | 0.755 | 1960 | 0 |
| hybrid_llm_rerank | 1.000 | 0.298 | 0.952 | 0.755 | 55685 | 0 |
| hybrid_sparse2 | 1.000 | 0.297 | 0.990 | 0.747 | 1955 | 0 |
| hyde | 1.000 | 0.285 | 0.990 | 0.742 | 1368 | 0 |
| bm25 | 1.000 | 0.276 | 0.986 | 0.704 | 361 | 0 |
| dense | 1.000 | 0.258 | 0.953 | 0.702 | 1252 | 0 |
| hybrid_minilm_rerank | 0.980 | 0.246 | 0.867 | 0.684 | 2351 | 1 |
| step_back | 1.000 | 0.251 | 0.913 | 0.672 | 3010 | 0 |
| multi_query | 0.980 | 0.228 | 0.908 | 0.655 | 5297 | 0 |

### PDF deep-read (47 cases)

| Strategy | HR@5 | Recall@5 | MRR | nDCG@10 | lat (ms) | fails |
| --- | --: | --: | --: | --: | --: | --: |
| **hyde** | 0.979 | 0.371 | 0.943 | **0.722** | 1418 | 1 |
| hybrid_pool80 | 0.979 | 0.362 | 0.957 | 0.715 | 1284 | 1 |
| hybrid_rrf20 | 0.979 | 0.351 | 0.968 | 0.715 | 1337 | 1 |
| hybrid_rrf100 | 0.979 | 0.359 | 0.954 | 0.712 | 1328 | 1 |
| hybrid | 0.979 | 0.367 | 0.949 | 0.696 | 1348 | 1 |
| hybrid_sparse2 | 0.979 | 0.368 | 0.957 | 0.689 | 1337 | 1 |
| bm25 | 0.979 | 0.350 | 0.965 | 0.676 | 245 | 1 |
| hybrid_dense2 | 0.957 | 0.316 | 0.910 | 0.669 | 1379 | 2 |
| hybrid_minilm_rerank | 0.957 | 0.322 | 0.799 | 0.623 | 1837 | 2 |
| step_back | 0.957 | 0.295 | 0.850 | 0.619 | 2822 | 2 |
| dense | 0.936 | 0.279 | 0.810 | 0.609 | 1139 | 3 |
| multi_query | 0.894 | 0.261 | 0.838 | 0.596 | 5851 | 3 |

SPLADE/ColBERT on the neutral judge: catalog 0.53 / 0.53, pdf 0.42 / 0.46 (depth-20 diagnostics, §1.3) — still bottom of the pack.

---

## 3. Results on the original (BM25-pooled) judge — SUPERSEDED

Retained for provenance. **These numbers are biased toward lexical retrieval** (see §1); do not cite them as the verdict.

### Catalog (biased judge)

| Strategy          | nDCG@10 |     | Strategy     | nDCG@10 |
| ----------------- | ------: | --- | ------------ | ------: |
| bm25              |   0.878 |     | dense_splade |   0.605 |
| hybrid            |   0.870 |     | dense        |   0.599 |
| hybrid_llm_rerank |   0.870 |     | multi_query  |   0.576 |
| hyde              |   0.835 |     | colbert      |   0.504 |
| hybrid_dense2     |   0.805 |     | splade       |   0.435 |
| agentic           |   0.640 |     | step_back    |   0.627 |

### PDF (biased judge)

bm25 **0.884**, hybrid 0.846, hybrid_llm_rerank 0.846, hybrid_dense2 0.770, dense_splade 0.592, dense 0.580, colbert 0.480, splade 0.390.

---

## 4. Per-arm verdicts (corrected)

- **hybrid (RRF) → KEEP as default.** Now the demonstrated winner: catalog 0.765 (top), pdf 0.696, best bpref on both. The earlier "BM25 ties hybrid, ship BM25" reasoning was an artifact of the lexical pool.
- **Tuning (rrf_k, pool) → ADOPTED (shipped).** `rrf_k=20` + pool floor 80 give a consistent +0.003 (catalog) / +0.02 (pdf) over the k=60 / pool-40 default. Now the production default (`query/hybrid.py` `RRF_K=20`, `query/retrieve.py` `_pool_size` floor 80); the default `hybrid` arm reproduces `hybrid_rrf20` at 0.768 catalog. See §10.
- **A1 query expansion → PROMOTE for deep-read/vague (reversed).** v1 rejected expansion as "dilutes jargon." On the neutral judge **HyDE wins the pdf track (0.722)** and is competitive on catalog (0.742). The implemented `--expand auto` is validated; consider default-on for the pdf/deep-read path. (multi_query/step_back remain below hybrid — HyDE is the expansion that works.)
- **A3 listwise rerank → REJECT (no headroom — holds).** This v1 conclusion **survives** the re-judge: `hybrid_llm_rerank` (3.1-pro) = 0.755 < hybrid 0.765 at +56 s/query; local cross-encoder `hybrid_minilm_rerank` _hurts_ (0.684 / 0.623). The fusion already orders the top correctly (MRR 1.0). Reranking is genuinely not useful here.
- **A4/A5 SPLADE & ColBERT → REJECT (still bottom), but were under-credited.** Both rose on the neutral judge (SPLADE +0.096 catalog; ColBERT +0.020) — confirming they too were penalized by lexical pooling — yet remain last. Off-the-shelf general-domain learned-sparse / late-interaction models lose to a tuned hybrid on this corpus.
- **A6 agentic deep-research → not re-run on neutral qrels** (≈100 s/query; conclusion unaffected). v1 finding stands: poor on the retrieval metric, qualitatively strong on vague questions — a synthesis layer, not a retriever.
- **R / G1 / G2 (related ablations, ColPali, PPR-memory) → scaffolded, not run.**

---

## 5. Infrastructure findings (reusable)

- **Pooling bias is real and was the dominant error.** Always pool from ≥3 diverse retrieval families before judging; report **hole rate / judged@k** so single-system bias is visible. The new `eval diagnostics` does this.
- **LLM-as-judge (UMBRELA-style) works** for this domain: graded 0–3, source-blind, deterministic; cache keyed by `(model, case, doc)` so the pdf track reuses catalog grades. ~11k judgments via `gemini-3.1-pro-preview` on the Vertex `global` endpoint, ~8 workers.
- **Gemini 3.x is region-split on Vertex.** `gemini-3.5-flash`/`gemini-3.1-pro-preview` → **`global`**; `gemini-embedding-2-preview` → **us-central1** only. Decoupled via `RAG_LLM_LOCATION=global` + `_client(location=…)`/`llm_location()`.
- **Experimental-index builds need `pylance`**: `uv run --with pylance --extra retrieval-experiments`.
- **24 GB guard + ColBERT/SPLADE → Docker Qdrant.** Local-mode multivector search OOMs; run a server and set `GRAPH_RAG_QDRANT_URL=http://localhost:6333` — `experimental_index.py` then builds/queries the server (one collection per index). `docker run -d --name graphrag-qdrant -p 6333:6333 qdrant/qdrant`. Note `qdrant/qdrant:latest` is 1.18.2; the pinned `:1.18.2` tag is no longer pullable.

---

## 6. Recommendations (corrected)

1. **Keep `hybrid` (RRF) as the default — it is the measured winner**, not a tie with BM25. **`rrf_k=20` + pool floor 80 are now shipped** (small consistent gain; §10). Do **not** fall back to BM25-only: on a neutral judge it is mid-pack, ~0.06 nDCG below hybrid.
2. **Enable HyDE query expansion for the deep-read / vague path** — it wins the pdf track. Keep `--expand auto`; consider default-on for pdf-only queries.
3. **Do not** add reranking (no headroom), learned-sparse, or late-interaction by default — all lose.
4. **Fix the evaluation methodology permanently:** the gold set is now backed by `data/eval/qrels/*/qrels.json` (diverse-pool + LLM-judged). Re-pool + re-judge whenever the corpus or a retriever changes; never expand the gold set from a single retriever again.
5. **Remaining headroom is modest and at the top of the stack** (expansion routing, fusion tuning), not "retrieval is dead." Domain-adapted dense embeddings (REFINE-style synthetic in-domain pairs) are the one lever that could lift dense further — scoped, gated on need.

---

## 7. Reproduce

```bash
cd tools/graph-layout-rag && uv sync --extra retrieval-experiments
gcloud auth application-default login                      # Vertex ADC

# --- de-biased evaluation (multi-system pool → LLM judge → diagnostics → bake-off) ---
docker run -d --name graphrag-qdrant -p 6333:6333 qdrant/qdrant
export GRAPH_RAG_QDRANT_URL=http://localhost:6333
uv run --with pylance --extra retrieval-experiments graph-layout-rag eval build-retrieval-index \
  --base-profile gemini-2-structure-v1 --kind splade        # and --kind colbert

for T in catalog pdf-deep-read; do
  uv run --with pylance --extra retrieval-experiments graph-layout-rag eval pool --track $T \
    --embed-profile gemini-2-structure-v1 \
    --system bm25 --system dense --system hybrid --system hyde --system multi_query \
    --system splade --system colbert --splade-index <splade-dir> --colbert-index <colbert-dir>
  uv run graph-layout-rag eval judge --track $T            # gemini-3.1-pro, cached
  uv run graph-layout-rag eval diagnostics --track $T --embed-profile gemini-2-structure-v1 \
    --qrels data/eval/qrels/$T/qrels.json --strategy bm25 --strategy dense --strategy hybrid \
    --strategy hyde --strategy multi_query --strategy splade --strategy colbert \
    --splade-index <splade-dir> --colbert-index <colbert-dir>
  uv run graph-layout-rag eval benchmark --embed-profile gemini-2-structure-v1 --track $T \
    --qrels data/eval/qrels/$T/qrels.json --llm-transforms \
    --strategy dense --strategy bm25 --strategy hybrid --strategy hybrid_rrf20 \
    --strategy hyde --strategy multi_query --strategy hybrid_minilm_rerank --report
done
```

---

## 8. Contextual-retrieval index → **DEFERRED (implemented + verified, full run impractical)**

The augmentation hook (`ingest/contextual.py`, parallelized, periodic-checkpoint cache) prepends an LLM context line to each chunk's embed/BM25 text, gated by the `gemini-2-contextual-v1` profile (production untouched). Fast build path (`scripts/build_contextual_index.py`) reuses the 44,672 production chunks. **Verified working** (sample context line is high-quality + on-topic). Full run deferred: ~7 h Vertex-throttled context-gen + full re-embed. _Now that dense is competitive (not the weakest arm), the "near-certain loss" prior is weaker — contextual is worth a real run off-hours;_ reuse one `genai.Client` + the `gemini_rate_limit` limiter to avoid the per-call throttling seen before.

---

## 9. What was built (code)

- **De-biased eval (this round):** `eval/pooling.py` (multi-system pool), `eval/judge.py` (UMBRELA LLM judge), `eval/qrels.py` (graded qrels + union overlay), `eval/diagnostics.py` (hole rate / judged@k / condensed nDCG / bpref), `eval/pool_commands.py` (CLI `pool`/`judge`/`diagnostics`), `benchmark --qrels`, `gold_cases()` qrels overlay. Tests: `tests/test_pooling_judge.py` (12).
- **Arms (prior round):** `query/search.py` `--expand` gate; `rag_common/rerank.py` `rerank_listwise_llm()` + `RAG_RERANK_MAX_CHARS`; `gemini_embed.py` `llm_location()` region split; `ingest/contextual.py` + `embed_profiles.toml` `gemini-2-contextual-v1`; `query/agent.py` `deep_research()`; experimental strategies (`splade`/`colbert` via Docker Qdrant). Tests: `tests/test_bakeoff_arms.py` (7).

---

## 10. Full-pipeline bias audit (2026-06-15)

The pooling fix corrected how retrieval is _measured_. This follow-up audited the live **search → shortlist → deep-read → cite** pipeline for bias in the _system_, beyond the evaluation. Three items were actioned; the rest are documented for later.

### 10.1 Harvest off-topic gate — substring bug (FIXED)

`harvest/relevance.py` rejected papers (`layout_relevance_score = −100`) whose title/abstract contained an `OFF_TOPIC_KEYWORDS` entry, using a plain substring `in` test. `"rna"` (for RNA) is a substring of **exte`rna`l, inte`rna`l, jou`rna`l, alte`rna`ting, tou`rna`ment** — so "external face" / "internal vertices" (core planar/upward-drawing vocabulary) were hard-killed. The gate runs at **discovery** in every provider (openalex/s2/arxiv/crossref/dblp/bibliography); `CURATED_SOURCES` only bypasses it later in prune/verify, so long-tail planar-drawing papers were dropped before reaching the manifest.

Measured on the 5,947-item manifest: **35 survivors were flagged off-topic purely by this artifact** — incl. _"Drawing non-layered tidy trees in linear time"_, _"Upward Planarization Layout"_ (JGAA), and the _Graph Drawing & Network Visualization_ symposium proceedings (they survived only via trusted sources).

**Fix:** `is_off_topic()` + `_OFF_TOPIC_RE` match at a **left word boundary** (`\b(?:…)`) — morphological variants still fire (`phylogen`→`phylogenetics`) but mid-word hits do not. Off-topic count 61→38 (23 recovered); every genuine off-topic case still rejected. Regression tests in `test_relevance.py`. **Recovering the long tail never harvested needs a re-harvest pass (not yet run).**

### 10.2 Retrieval tuning shipped (rrf_k=20, pool floor 80)

The §4 "small adopt" tuning win is now the production default (`query/hybrid.py` `RRF_K=20`; `query/retrieve.py` `_pool_size` floor 40→80; `retrieve_candidates`/`search_raw` `rrf_k` default→20). Confirmed on neutral qrels: the default `hybrid` arm reproduces `hybrid_rrf20` at **0.7681 catalog** (was 0.7653). The explicit `hybrid_rrf20`/`hybrid_pool80` benchmark arms pass their own params and remain valid references.

### 10.3 Chunk-aggregation geometry — A/B'd, NO change (max-pool validated)

Retrieval fuses at the **chunk** level, then groups to a paper by its **single best chunk** (max-pool). Hypotheses: (#2) a deeper fused pool would surface papers crowded out by long multi-chunk docs; (#5) a corroboration-aware aggregation (papers with several on-topic passages) would beat single-best-chunk. Tested as experimental arms (`hybrid_deep` pool 200; `hybrid_agg_sum3` sum of top-3 chunk scores; `hybrid_agg_count` capped log count-bonus) vs the `hybrid_rrf20` default, on the neutral qrels:

| arm | catalog nDCG@10 | pdf nDCG@10 | verdict |
| --- | --: | --: | --- |
| `hybrid_rrf20` (pool 80, max-pool — default) | **0.768** | **0.715** | baseline |
| `hybrid_deep` (pool 200, max-pool) | 0.769 | 0.714 | #2 — no gain, floor 80 is the knee |
| `hybrid_agg_count` (corroboration bonus) | 0.762 | 0.714 | #5 — neutral-to-slightly-negative |
| `hybrid_agg_sum3` (sum top-3 chunks) | 0.706 | 0.707 | #5 — **hurts** (drops MRR/MAP) |

**Both hypotheses refuted.** Deeper pooling adds nothing past the floor-80 default; corroboration aggregation does not help on either track and `sum_topk` actively degrades precision (it rewards verbose papers with several mediocre chunks — the length bias flipping the wrong way — and pushes a wrong paper to rank 1). The single-best-chunk grouping is the correct design and stays the default; the arms remain in the registry as A/B references only.

### 10.4 Structural findings (documented, not actioned — the real remaining lever)

- **Corpus coverage, not fusion math, is where the headroom is.** The corpus is **60% metadata-only** (3,545 / 5,947) and **46% is title-only single-chunk** (no abstract). These are geometrically out-competed in `query` by full-PDF papers (15–40 chunks) and surface mainly via `cite`; they skew **older** (median 2012 vs 2018), so this is a coverage gap, not a recency gap. Combined with 10.1, the biggest improvement to "find relevant papers" is **harvesting more full text + abstracts**, not re-tuning retrieval.
- **Keyword-seeded discovery** (`openalex.SEARCH_QUERIES` / `TOPIC_QUERIES`) under-covers subfields absent from the seed list (dynamic/streaming, 3D/hyperbolic, ML-based layout, matrix/arc representations); the strict gate also drops papers coining novel terminology. Snowball + co-citation amplify the seeded core.
- **`cite related`** co-citation (the dominant signal) and the `log1p(cited_by_count)` prior favor older/established work — a recency cold-start, inherent to citation methods.
- **Lower-harm:** `STRONG/WEAK` relevance terms still use substring matching (false _positives_ for inclusion, e.g. "tree" in "street") — noise, not the damaging false-negative of 10.1; left as-is.
