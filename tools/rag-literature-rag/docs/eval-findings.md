# RAG-literature-rag — Retrieval Evaluation Findings

A self-contained report of what the evaluation campaign established about this corpus and about "self-improving RAG" in general. All numbers are reproducible with the commands in the last section.

**TL;DR:** retrieval quality here is **measurement-bound, not algorithm-bound**. The biggest wins came from fixing _data and measurement_ (full-text extraction; a large, stratified, judged gold set), not from tuning retrieval strategies. A self-improving loop makes sense **as a corpus/measurement-health process**, and does **not** as a naive algorithm tuner — the method ranking is stable (dense ≈ hybrid lead, bm25 trails) across every honest test.

---

## 1. Data quality dominates: the full-text fix

The production index was once **95% abstract-only** — 822/863 PDF-backed docs collapsed to a single chunk because ingest had run before the PDFs finished downloading, and SHA-based incremental runs kept skipping them. A forced Docling (no-OCR) re-ingest recovered full text:

|                            | before | after                   |
| -------------------------- | ------ | ----------------------- |
| chunks                     | ~2,180 | **21,211** (≈10×)       |
| chunks/doc                 | ~1.7   | **16.7**                |
| hybrid nDCG@10 (gold-only) | 0.670  | **0.900** (+0.23, +34%) |

This single data fix was **larger than any algorithmic change in the entire campaign.** Lesson: audit extraction/chunk-density before touching retrievers. Shipped as `eval corpus-health` (read-only, no-LLM auditor that flags abstract-only collapse, extraction fallbacks, missing creds, pool holes).

## 2. The measurement trap: small gold sets can't separate methods, and inflate

The hand-written gold set is only **42 cases**. Two failure modes followed:

- **Pooling bias.** Benchmarking without judged qrels scores only against the handful of pre-judged docs → hybrid looked like **0.900** nDCG@10. Re-scored against the full judged pool it was **0.669** (hole@10 = 0). The 0.90 was an artifact of the metric only "seeing" docs it already knew.
- **Method-insensitivity.** On 42 cases every strategy clustered in a ~0.11 nDCG band — bm25, dense, and hybrid were statistically indistinguishable. No chunking/embedding/query experiment could be trusted, because the eval could not tell good from better.

Guardrails adopted: multi-system pooling before judging (de-biases the judge), UMBRELA 0–3 LLM grading, and `eval diagnostics` reporting **hole_rate@k / bpref / condensed-nDCG** so a "win" must survive the robust metrics, not just raw nDCG.

## 3. The unlock: synthetic gold-set expansion (`eval gen-gold`)

Following the evaluation literature (DataMorgana, ARES, _Coverage-Not-Averages_), we grew the judged eval from 42 → **531 cases** (42 curated + 489 synthetic). The generator (`eval/gold_synth.py`):

- samples corpus docs **stratified** by category × year × track;
- has Gemini Flash write a **system-blind information-need query** grounded in each (single-doc, plus a ~20% "hard" stratum of indirect-phrasing and 2-doc multi-hop);
- applies **anti-lexical-leakage** (reject queries that echo the seed → no free BM25 wins) and **de-dup** filters;
- defers relevance to the existing **multi-system pool → UMBRELA judge** (the seed is only a candidate positive); opt-in via `RAG_LIT_SYNTH_GOLD=1` so the curated-42 stays the pristine default.

Judging: 45,628 new (query, doc) pairs, gemini-3.5-flash, ~$10.5. Judge calibration on the curated docs: **grade≥2 rate 0.952** (the rubric is sound).

### Result — nDCG@10 (full-pool), curated-42 vs synthetic-500

| track | curated spread | **synthetic spread** | gain | Spearman(cur,syn) |
| --- | --- | --- | --- | --- |
| catalog | 0.110 | **0.384** | +0.274 | **0.943** |
| pdf-deep-read | 0.107 | **0.439** | +0.332 | **0.829** |

Per-strategy (catalog, synthetic): dense **0.731** > hybrid_dense2 0.725 > hybrid 0.696 > hybrid_rrf100 0.695 > bm25 0.548 > hybrid_category **0.347**. pdf-deep-read: same ordering.

### Three bias guards — all pass

1. **Separation.** Synthetic spread is **3.5–4× the curated band** — methods are now distinguishable.
2. **Not a generation artifact.** Curated-vs-synthetic **Spearman 0.94 / 0.83** — the synthetic set _ranks methods the same way the human gold set does_, just with far higher resolution. Had the LLM-written queries secretly favored semantic/dense retrieval, the ranking would have diverged.
3. **Not pooling bias.** Diagnostics **hole@10 = 0.00** on both tracks; **bpref** (ignores unjudged docs entirely) gives the same ordering with the same gaps — catalog dense .556 > hybrid .512 > bm25 .346; pdf .619 > .559 > .404.

### New finding the small set was hiding

`hybrid_category` (category-filtered fusion) **collapses on synthetic** — 0.35 vs 0.63 curated, both tracks. It overfits the hand-picked 42 and fails on diverse real-style queries. Only a larger, more representative eval surfaces a quietly-bad strategy like this.

## 4. What did _not_ help (settled — do not re-run)

Across the campaign, on the full-text corpus with honest (full-pool) scoring: reranking (cross-encoder and MiniLM) **hurt**; citation-graph fusion **lost**; multi_query was weak; HyDE was the best LLM transform at only **+0.02**; ColBERT/SPLADE-v3 GPU bake-offs did not beat hybrid. The method ranking is stable: **dense ≈ hybrid_dense2 lead, hybrid close behind, bm25 trails.** There is no hidden algorithm to discover — the leverage is in data and measurement.

## 5. Infrastructure findings

- **Parallel pooling.** `build_pool` ran cases serially (one request in flight), wasting the rate-limit budget. Pooling cases concurrently (`RAG_LIT_POOL_WORKERS`, default 8) took **3.25 → 65 cases/min**.
- **Judge hardening.** The judge cached grade-0 on a 429, silently poisoning qrels at scale. It now retries rate-limit errors with backoff and **never persists an error verdict**.
- **Gemini quota reality.** `gemini-3.5-flash` is **global-endpoint-only** (404 on every region) under **Dynamic Shared Quota** — there is **no per-project limit to raise** and regional round-robin cannot work. 48 judge workers tripped sustained throttling; **~24 is the clean ceiling.** To truly raise throughput: Provisioned Throughput, or the (separate, tiered) Gemini Developer API.

## 6. Verdict on "self-improving RAG"

- **Yes**, as a loop that improves the **measurement and corpus** — full-text extraction and a large stratified judged gold set are what produced every real gain, and the gold set is what finally let the eval discriminate methods (and exposed `hybrid_category`'s overfit).
- **No**, as a naive **algorithm tuner** — the method ranking is stable and the gold set is small; an unguarded optimizer would chase pooling-inflated noise (it nearly sold a 0.90 that was really 0.67). Trust requires the bias guards: re-pool + re-judge each candidate, and decide on hole_rate/bpref, not raw nDCG.

## 7. Reproduce

```bash
cd tools/rag-literature-rag

# Health audit (read-only, no LLM)
uv run rag-literature-rag eval corpus-health --embed-profile gemini-2-structure-v1

# Generate + judge the synthetic gold set (~$10 of flash; budget-gated)
RAG_LIT_POOL_WORKERS=8 RAG_LIT_JUDGE_WORKERS=24 \
  uv run rag-literature-rag eval gen-gold --embed-profile gemini-2-structure-v1 \
  --n-catalog 300 --n-pdf 200 --hard-frac 0.2 --budget-usd 12 -v

# Benchmark with synthetic cases active, full-pool scoring
RAG_LIT_SYNTH_GOLD=1 uv run rag-literature-rag eval benchmark \
  --embed-profile gemini-2-structure-v1 --qrels data/eval/qrels/merged_qrels.json \
  --strategy bm25 --strategy dense --strategy hybrid \
  --strategy hybrid_rrf100 --strategy hybrid_dense2 --strategy hybrid_category

# Method-separation report (curated vs synthetic spread + Spearman)
uv run python scripts/synth_separation_report.py

# Bias guards (hole_rate / bpref) per track
RAG_LIT_SYNTH_GOLD=1 uv run rag-literature-rag eval diagnostics \
  --track catalog --embed-profile gemini-2-structure-v1 \
  --qrels data/eval/qrels/catalog/qrels.json \
  --strategy bm25 --strategy dense --strategy hybrid
```

Detailed per-iteration ledger (local, gitignored): `data/eval/campaign/findings.md`.
