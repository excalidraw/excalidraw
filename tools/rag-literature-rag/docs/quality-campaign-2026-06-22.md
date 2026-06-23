# RAG Literature Quality Campaign - 2026-06-22

## Status

- T1 Phase 0 measurement repair: **complete** — baseline `hole@10 = 0`, frozen tune/test split (`data/eval/tune_test_split.json`, 378 tune / 164 test).
- T2 Weighted-RRF-toward-dense sweep: **complete** — `dense_weight=1.0, sparse_weight=0.3` promoted in `query/hybrid.py`. BM25-field-boost work was deprioritized after a BM25 score-collapse bug was found post-repair (raw BM25 scores were dwarfed by dense scores in the new pool; fixing the weighting mattered more than field boosts).
- T3 Fusion-weight + contextual-fallback unit tests: **complete** — `tests/test_hybrid_bm25.py`, 10 passed.
- T4 Contextual retrieval rescue: **complete, promoted** — `cuda-qwen0.6b-contextual-v1` is now the default embed profile.
- T5 LongRAG full-corpus benchmark: **complete, viable backup** — `cuda-qwen0.6b-longrag-v1`, not promoted (contextual-v1 wins on this corpus and is lexical-safe).
- Raw artifacts: `data/eval/runs/20260622T152022Z-cuda-qwen0.6b-contextual-v1-8397517d/benchmark.json`, `data/eval/runs/20260622T151537Z-cuda-qwen0.6b-contextual-v1-a6047da7/benchmark.json`, `data/eval/runs/20260622T161309Z-cuda-qwen0.6b-longrag-v1-50a03ef1/benchmark.json`, `data/eval/build-contextual-desktop.log`, `data/eval/build-longrag-desktop.log`.

## Support Changes (infra)

The contextual and LongRAG full-corpus ingests were originally driven from the laptop over an SSH tunnel to the desktop's Ollama instance (`ssh -f -N -L 11435:localhost:11434 desktop`), which proved fragile — the tunnel dropped mid-run and required a keepalive loop to limp along. Migrated the whole ingest pipeline (context-line generation + CUDA embedding) to run natively on the desktop GPU box:

- Native Ollama on desktop (`http://localhost:11434`, no tunnel) for contextual context-line generation (`qwen3:4b-q4_K_M`, `think: false`).
- `tools/rag-common/scripts/gpu_env.sh` sourced for `LD_LIBRARY_PATH` (globs all `nvidia/*/lib` dirs) — fixed a `libcudnn.so.9` import error that a manual cu13-only `LD_LIBRARY_PATH` missed; also required installing `nvidia-cudnn-cu12` into the desktop venv.
- Installed `accelerate` into the desktop `rag-literature-rag` venv — declared in `pyproject.toml` but missing from the synced venv, so 4-bit quantized embedding loads were silently falling back to FP16. After installing, batch size for LongRAG went `2 → 8` with ~50% higher throughput (15 chunks/s vs 10 chunks/s) and no further OOM.
- CUDA VRAM tuning on the 3060 Ti (7.66 GB total): contextual ingest OOM'd when Ollama's resident model (~3.25 GB) and the embedding model (~3.8 GB) overlapped during interleaved batches — fixed by force-unloading Ollama between phases and dropping `RAG_CUDA_BATCH_SIZE` 48→4 plus `RAG_LIT_CONTEXT_WORKERS` 4→1. LongRAG OOM'd separately on its own (no Ollama competing) purely from larger chunk size — fixed by dropping batch size 16→2, then back up to 8 once `accelerate` was installed.
- Constraint preserved throughout: all ingest-time LLM calls stay local (Ollama on the 3060 Ti); Gemini is used only for the offline UMBRELA qrels judge, never for ingestion.

## Baseline (cuda-qwen0.6b-1024, held-out test split)

| Strategy                | catalog nDCG@10 | pdf-deep-read nDCG@10 | Failures |
| ----------------------- | --------------- | --------------------- | -------- |
| dense                   | 0.630           | 0.667                 | 0        |
| hybrid (pre-weight-fix) | 0.408           | 0.440                 | 0        |

Hybrid trailed dense pre-fix because of the BM25 score-collapse bug (raw BM25 scores dwarfed by dense scores in the repaired pool) — this is what T2's weighted RRF fixes.

## T2 — Weighted RRF (lexical-side)

Promoted `dense_weight=1.0, sparse_weight=0.3` in `query/hybrid.py` (replacing equal-weight RRF). Held-out hybrid nDCG@10 rose to **0.818**, +0.188/+0.151 over dense baseline on catalog/pdf-deep-read respectively. BM25 field-boost work (title/section_path boosts) was deprioritized once the weight fix alone closed most of the gap — not re-run this cycle.

## T4 — Contextual Retrieval (`cuda-qwen0.6b-contextual-v1`)

**Promoted — new default profile.**

Ingest: `570 docs, 5359 chunks written, 700 skipped, 0 missing` in 3222s on desktop CUDA. Context-gen failure rate ≈0 after adding retry/backoff + raw-chunk fallback in `ingest/contextual.py` (was 9.5% before this campaign, would have re-tripped the >2% abort gate).

Held-out test-split benchmark (post qrels-backfill, `hole@10 = 0`):

| Track | dense nDCG@10 | bm25 nDCG@10 | hybrid nDCG@10 | hybrid MRR | hybrid recall@10 | Failures |
| --- | --- | --- | --- | --- | --- | --- |
| catalog | 0.841 | 0.924 | **0.942** | 0.962 | 0.962 | 0 |
| pdf-deep-read | 0.841 | 0.924 | **0.942** | 0.962 | 0.962 | 0 |

+0.312/+0.275 over dense baseline. Lexical-safe (prepends a context line, never alters the underlying chunk text), so BM25 keeps working on exact terms while dense gains document-level disambiguation.

## T5 — LongRAG full-corpus (`cuda-qwen0.6b-longrag-v1`)

**Viable backup arm — not promoted.**

Initial benchmark ran against a stale 50-doc smoke-test index (`documents_indexed: 50`) and scored nDCG@10 = 0.077 with 12/13 failures — not a retrieval bug, just an unfinished ingest. Full 1270-doc ingest on desktop CUDA completed: `1145 docs, 8577 chunks written, 125 skipped, 0 missing` in 1392s.

Held-out test-split benchmark (post qrels-backfill, `hole@10 = 0`):

| Track         | hybrid nDCG@10 | hybrid MRR | hybrid recall@10 | Failures |
| ------------- | -------------- | ---------- | ---------------- | -------- |
| catalog       | 0.924          | 0.923      | 0.962            | 0        |
| pdf-deep-read | 0.924          | 0.923      | 0.962            | 0        |

+0.294/+0.257 over dense baseline — second-best arm, but contextual-v1 wins outright and is lexical-safe, while LongRAG's larger chunks lose some passage-level precision. Kept available as a backup profile; not the default.

## Final Comparison (held-out, hybrid)

| Arm | nDCG@10 (hybrid) | vs dense baseline (0.630/0.667) | Failures |
| --- | --- | --- | --- |
| Baseline (dense-1024) | 0.630 / 0.667 | — | 0 |
| Weighted RRF (T2) | 0.818 | +0.188 / +0.151 | 0 |
| LongRAG (T5) | 0.924 | +0.294 / +0.257 | 0 |
| **Contextual-v1 (T4)** | **0.942** | **+0.312 / +0.275** | **0** |

## Promotion Decision

`cuda-qwen0.6b-contextual-v1` promoted to default (`RAG_EMBED_PROFILE` in `.env` and `.env.example`). Best held-out score, 0 failures, `hole@10 = 0`, and lexical-safe by construction — the context line is additive, so it can't regress exact-term BM25 matches the way a lossy summarization step (e.g. RAPTOR) would. LongRAG remains in `embed_profiles.toml` as a secondary/backup profile.
