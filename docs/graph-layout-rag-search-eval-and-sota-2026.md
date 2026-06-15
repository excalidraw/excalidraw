# Graph Layout RAG — Search & Related-Paper Evaluation + 2026 SOTA Review

Date: 2026-06-15 · Profile under test: `gemini-2-structure-v1` (Gemini Embedding 2 @ 3072, Docling, `markdown-structure-v1` chunks) · Hardware: Apple M4 Pro, 24 GB.

This report (1) assesses how good the current **topic search** and **find-related-papers** implementations are, (2) reviews 2026 state-of-the-art for research-paper RAG, and (3) gives prioritized, **minimal-cost** recommendations. It builds on, and does not duplicate, the existing
[retrieval benchmark assessment](graph-layout-rag-retrieval-benchmark-assessment.md).

---

## 0. TL;DR

- **Topic search is already strong and correctly tuned.** Hybrid (Gemini dense + Tantivy BM25 + RRF k=60) is the right default; reranking measurably *hurts* this corpus and blows the 24 GB memory budget; BM25 alone is a great low-latency fallback. None of that needs changing.
- **The headline problem was the *evaluation*, not the *retriever*.** The 30-query gold set had mostly **one relevant doc per query**, so the benchmark was penalizing the system for retrieving *correct* papers that simply weren't labeled. The most-failed case (`packing-skyline`, failed by all 14 strategies) is a textbook example: BM25's top two hits are the two canonical skyline strip-packing papers, neither of which was in the gold label.
- **Fix delivered this pass:** the gold set was rebuilt to **49 queries / 112 relevant docs** (from 30 / 23) with multi-relevant labels via offline BM25 pooling + abstract curation. `eval validate-gold` passes. A re-benchmark on this set is queued (blocked only by expired Vertex auth — see §6).
- **Find-related-papers (`cite related`) is well-designed and honestly evaluated.** The fused ranker (co-citation-dominant + PPR + coupling + light embedding) wins its leave-one-out A/B; its weaknesses are graph *coverage*, not ranking math.
- **2026 SOTA that is worth piloting here:** contextual-retrieval chunk augmentation, and a *listwise LLM* reranker (your evidence already rules out classic cross-encoders). Most other SOTA ideas (late-interaction/ColBERT, citation-embedding upgrades) your own measurements predict will give little here — details in §4–§5.

---

## 1. What was evaluated

| Capability | Entry point | Method |
|---|---|---|
| Topic search | `query/search.py:search()` → `retrieve.py` | Gemini dense + BM25, RRF k=60, diversify, optional rerank |
| Find related | `query/citation_rank.py:related_to_docs()` | co-citation + PPR + bibliographic coupling + SciNCL/SPECTER2 cosine |
| Search eval | `eval/benchmark.py`, gold set `eval/gold_cases.py` | HR/Recall/MRR/nDCG over catalog + pdf-deep-read tracks |
| Related eval | `eval/related_eval.py` | leave-one-out citation prediction A/B |

---

## 2. Topic search — findings

### 2.1 Baseline (existing artifacts, old 30-query gold set)

From `data/eval/runs/current-index-pareto-20260613/` on `gemini-2-structure-v1`:

| Strategy | Track | MRR | nDCG@10 | p95 latency | Note |
|---|---|---:|---:|---:|---|
| **Hybrid (default)** | Catalog | **0.769** | **0.758** | 1.25 s | best overall |
| Hybrid | PDF deep-read | 0.758 | 0.756 | 1.31 s | best overall |
| Dense only | Catalog | 0.713 | 0.673 | 1.24 s | dense alone trails |
| BM25 only | Catalog | 0.717 | 0.699 | **57 ms** | strong + 20× faster |
| `hybrid_dense2` (dense×2 in RRF) | Catalog | 0.782 | 0.753 | 1.16 s | best catalog MRR |
| MiniLM rerank | Catalog | 0.657 | 0.599 | 1.64 s | **quality drop** |
| BGE rerank | Catalog | — | — | aborted | **swap guard tripped** |
| BGE rerank | PDF | 0.613 | 0.649 | **7.8 s** | quality drop + latency |

**Confirmed, high-confidence conclusions** (unchanged from the existing assessment):
1. Hybrid > dense-only and a strong-but-not-better BM25 baseline.
2. Local cross-encoder reranking (MiniLM / BGE-v2-m3) **reduces** quality on this corpus and is operationally unsafe at 24 GB (BGE: 7.8 s p95, swap abort). The reranker also only sees the first 2000 chars (`rag_common/rerank.py` `MAX_RERANK_CHARS`), truncating structured chunks.
3. RRF k=60 vs k=100 differ by <0.001 nDCG — keep k=60.
4. Lexical signal matters a lot here (jargon: "VPSC", "Brandes-Köpf", "skyline") — which is why BM25 is so competitive and dense-only lags.

### 2.2 The real bottleneck was label completeness, not retrieval

Every strategy showed exactly **~1 failure per track**. Mining the failures:

| Failed case | Failed by | What the system actually returned |
|---|---:|---|
| `packing-skyline` | 14/14 | top-2 BM25 = *"A skyline heuristic for 2D rectangular packing and strip packing"*, *"An improved skyline based heuristic for 2D strip packing"* — **both correct, neither labeled** (gold listed only `arxiv-1506-09145v2`) |
| `constraints-cluster-containment` / `constraints-force-overlap` | 2 each | returned the TVCG/Fast-Node-Overlap-Removal family — **correct overlap-removal papers, not labeled** |
| `vague-layout-height` | 12 | genuinely hard vague query (see §2.3) |

So the benchmark was understating true quality: with single-doc labels, retrieving a *different but equally correct* paper scores as a miss. This is the classic sparse-judgment problem in IR evaluation.

**Action taken:** rebuilt the gold set with multi-relevant labels by **pooling** — running 49 candidate queries through local BM25, then curating relevant docs from titles/abstracts. Result: `eval/gold_cases.py` now has **49 cases / 112 unique relevant docs**, `valid: true`. The construction script is `/tmp/gold_pool.py` (reproducible; offline, no API).

> Pooling caveat (documented for honesty): candidates were pooled from BM25 only (Vertex was down), so the set is mildly biased toward lexically-retrievable relevants. When auth is restored, re-pool with dense+hybrid and union the pools before the *final* labeling pass.

### 2.3 Vague / agent-style queries are the one genuine retrieval gap

`vague-layout-height` ("why is my graph layout vertically tall lane stacking") fails because neither BM25 nor dense embeddings bridge a colloquial symptom to the technical literature (layer-width / packing). This is exactly what **query transforms** target — and `query/transforms.py` already implements `multi_query_rewrites()`, `hyde_passage()`, and `step_back_query()`, but they are **not wired into the default `search()` path** (only reachable via the `--llm-transforms` benchmark strategies). See recommendation R2.

---

## 3. Find-related-papers — findings

Design (`citation_rank.py`): `score = w_ppr·PPR + w_coupling·coupling + w_cocitation·cocitation + w_prior·log(cites) + w_embedding·cos`, with IDF-weighted shared neighbors and tuned weights (co-citation 1.5 dominant, undirected PPR 0.6, coupling 0.3, embedding 0.15, directional PPR 0).

Leave-one-out A/B (`data/eval/related-ab.json`, 150 folds):

| Ranker | MRR | nDCG@10 | R@10 | Verdict |
|---|---:|---:|---:|---|
| **`related_v2` (fused)** | **0.225** | **0.265** | **0.433** | best — the default |
| `cocitation_only` | 0.201 | 0.234 | 0.367 | strongest single signal (needs `--incoming`) |
| `ppr_undirected` | 0.141 | 0.185 | 0.393 | good recall |
| `coupling_only` | 0.085 | 0.100 | 0.187 | weak alone |
| `scincl` / `specter2` | ~0.04–0.06 | | | embeddings weak at *citation* prediction |

**Assessment:** the ranker math is sound and the evaluation is self-supervised and honest. The fusion correctly leans on co-citation (enabled by the Semantic Scholar `--incoming` backfill) and uses embeddings only as a topical tiebreak — matching the literature (§4.2). The real limits are **graph coverage** (papers with no enriched citation node return nothing) and two **stored-but-unused signals**: the `is_influential` edge flag and the `authorship` co-author graph. See R5.

---

## 4. 2026 SOTA review (research-paper RAG)

### 4.1 Retrieval & reranking
- **Hybrid (dense + BM25 + RRF) + a reranking stage remains the production-standard two-stage pattern** in 2026. Your pipeline already does the first stage correctly. ([RAG patterns 2026](https://dev.to/young_gao/rag-is-not-dead-advanced-retrieval-patterns-that-actually-work-in-2026-2gbo))
- **Contextual Retrieval** (Anthropic): prepend an LLM-generated 50–100-token chunk-context before embedding *and* before BM25 indexing; reported ~35% (embeddings) → ~49% (with BM25) reduction in retrieval errors. Your chunker already injects `title/section/topics/tags` (a cheap static analog), but not generated context. ([Anthropic cookbook](https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide), [freeCodeCamp](https://www.freecodecamp.org/news/how-contextual-embeddings-and-hybrid-search-fix-retrieval-failures/))
- **Late interaction / multi-vector (ColBERTv2, ColPali)**: near-cross-encoder accuracy at bi-encoder speed; strongest in *out-of-domain* settings; an active 2026 research frontier (LIR @ ECIR 2026). ([ModernBERT+ColBERT](https://arxiv.org/abs/2510.04757), [LIR workshop](https://arxiv.org/pdf/2511.00444))
- **Rerankers**: the 2026 open default is **Qwen3-Reranker** (0.6B/4B/8B, 32k context). **Listwise LLM rerankers** (RankZephyr, E²Rank) now beat pointwise cross-encoders on NDCG@10. ([reranker guide](https://machinelearningmastery.com/top-5-reranking-models-to-improve-rag-results/), [E²Rank](https://arxiv.org/pdf/2510.22733))

### 4.2 Citation / related-paper SOTA
- **SPECTER2** and **SciNCL** are still the reference citation-aware embeddings; 2025–26 work (citation-importance-aware representations, fine-grained knowledge-entity embeddings) gives modest gains over them. Crucially, the literature agrees these capture **topical** proximity, not direct-citation **link prediction** — exactly what your A/B found. ([SPECTER2](https://allenai.org/blog/specter2-adapting-scientific-document-embeddings-to-multiple-fields-and-task-formats-c95686c06567), [SciNCL](https://arxiv.org/pdf/2202.06671), [2026 fine-grained](https://arxiv.org/pdf/2601.19513))
- **GraphRAG / Personalized-PageRank fusion**: blending PPR over the citation graph with semantic similarity via additive scoring is the recommended pattern — i.e. graph traversal *augments* embeddings rather than replacing them. This is precisely your fused design. ([Neo4j GraphRAG](https://neo4j.com/blog/developer/unleashing-the-power-of-graphrag/), [Mixture-of-PageRanks](https://arxiv.org/html/2412.06078v1))

### 4.3 Linking papers → implementations (a capability you don't yet have)
- Papers-with-Code was absorbed into Hugging Face (2025); tools like PapersFlow extract GitHub/dataset/code links by title/arXiv/DOI. Only ~26% of ML papers ship working code links, so a dedicated extraction step adds real value. ([PapersFlow](https://papersflow.ai/blog/find-github-code-for-research-papers), [academic search 2026](https://paperguide.ai/blog/academic-search-engines/))

---

## 5. Recommendations (prioritized, minimal-cost first)

> Ground rule from the existing assessment: change the **default** only when a candidate beats current on **both** tracks of the expanded set, by >0.01, within memory guards, and survives manual failure review.

**R1 — Re-benchmark on the expanded gold set (do first; ~$0).** Re-run `eval benchmark` on the new 49/112 set once Vertex is re-authed (§6). Expectation: catalog/PDF scores rise materially and the false-failure cases disappear, giving a trustworthy baseline to judge everything else against. *Cost: query embeddings only.*

**R2 — Wire query transforms into `search()` for low-confidence queries (high value, low cost).** `hyde_passage()` / `step_back_query()` already exist. Gate them behind a heuristic (short query, low top-1 fusion score, or an explicit `--expand` flag) so normal keyword queries stay fast. Directly targets the `vague-*` failures. *Cost: 1 cheap LLM call per expanded query; measure on the `vague-*` cases before defaulting on.*

**R3 — Pilot a *listwise* reranker, not another cross-encoder (medium).** Your data already shows pointwise cross-encoders (MiniLM, BGE) hurt. If reranking is revisited, test **Qwen3-Reranker-0.6B** (fits 24 GB) or a listwise LLM reranker over the top-20, and **lift `MAX_RERANK_CHARS`** so structured chunks aren't truncated. Keep it opt-in; only promote if it clears the R0 bar on the expanded set.

**R4 — Pilot Contextual-Retrieval chunk augmentation (medium, one-time cost).** Build one *immutable experimental index* (the harness already supports `--retrieval-index`) where each chunk is prefixed with an LLM-generated context line, then A/B vs production. With Gemini-Flash + prompt caching the corpus pass is cheap and one-time. Highest-upside *retrieval-quality* lever per the 2026 evidence.

**R5 — Close `cite related` coverage gaps (medium, cheap):** (a) report graph-coverage in `cite stats` (% manifest papers with ≥1 enriched edge) to quantify the blind spot; (b) ablate the **stored-but-unused** `is_influential` weighting and the `authorship` co-author signal in `eval related` — only adopt if they beat `related_v2`.

**R6 — Add paper→implementation linking (new capability, optional).** Extract GitHub/dataset links from PDFs/abstracts into the manifest and expose as a `--with-code` field. Most useful for the "find the paper *and its code*" half of your original ask.

**Explicitly NOT recommended now:**
- Don't make reranking a default (evidence is against it here).
- Don't invest in ColBERT/SPLADE as the *default* path yet — late interaction shines out-of-domain, but your jargon-heavy in-domain corpus is already well served by BM25+dense; treat it as an experimental-index A/B only (R-future).
- Don't upgrade citation embeddings expecting link-prediction gains — your A/B and the literature both say they're topical, not predictive.
- Don't fuse citation/relatedness signal into `query` ranking — a prior A/B showed it hurts (already documented in the skill).

---

## 6. How to reproduce / run (after Vertex re-auth)

The dense/hybrid path needs Vertex ADC, which is **currently expired** (`gcloud auth application-default print-access-token` fails — this is why live queries hang). Refresh once:

```bash
gcloud auth application-default login
```

Then:

```bash
cd tools/graph-layout-rag

# R1 — re-benchmark on the expanded gold set
uv run graph-layout-rag eval validate-gold --json          # already passes: 49 cases / 112 docs
uv run graph-layout-rag eval benchmark \
  --embed-profile gemini-2-structure-v1 --no-llm-transforms --report -v

# R2 — measure query transforms on the vague cases
uv run graph-layout-rag eval benchmark \
  --embed-profile gemini-2-structure-v1 --llm-transforms --report -v

# related-paper A/B (no Vertex needed)
uv run graph-layout-rag eval related --folds 150 --report -o data/eval/related-ab.json
```

Offline-only work in this pass (no auth needed): gold-set pooling (`/tmp/gold_pool.py`), curation, and `validate-gold`.

---

## 7. Changes made in this pass

- `tools/graph-layout-rag/src/graph_layout_rag/eval/gold_cases.py` — expanded 30→**49** cases, 23→**112** relevant docs, multi-relevant labels; corrected the demonstrably-wrong single-label cases (`packing-skyline`, `constraints-*`). Validated with `eval validate-gold` (`valid: true`); gold-validation tests pass.
- This report.
- No changes to retrieval, ranking, or `cite related` code (report-only deliverable).
