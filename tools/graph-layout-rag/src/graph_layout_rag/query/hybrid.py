from __future__ import annotations

from typing import Any

# RRF rank constant. k=20 sharpens top-rank weighting vs the classic 60; the
# de-biased bake-off (neutral LLM-judged qrels) measured it a consistent win
# over k=60 on both tracks (catalog 0.768 vs 0.765, pdf 0.715 vs 0.696).
RRF_K = 20

# Default fusion weights. Weight sweep (2026-06-22 self-improve campaign,
# sparse_weight in {0.3,0.5,0.7,1.0,1.5,2.0} at dense_weight=1.0, rrf_k=20,
# pool=80) found nDCG@10 rising monotonically with sparse_weight across the
# whole grid (no plateau) -- BM25 dominates this corpus much more than the
# 2026-06 bake-off implied (bm25-only: catalog 0.878, pdf 0.878; dense-only:
# catalog 0.615, pdf 0.621). sparse_weight=2.0 clears the calibrated
# promotion gate vs the prior equal-weight default (+0.054 catalog / +0.063
# pdf, no failure increase) but is still BELOW bm25-only on pdf-deep-read
# (0.875 vs 0.878) and only marginally above it on catalog (0.880 vs 0.878).
# Read this as: hybrid fusion adds no real value over BM25 alone on this
# corpus today; sparse_weight=2.0 mainly claws back the equal-weight
# baseline's loss to BM25, it does not represent a verified hybrid win.
# Recorded honestly rather than oversold -- see docs/quality-campaign-2026-06-22.md.
DENSE_WEIGHT = 1.0
SPARSE_WEIGHT = 2.0


def merge_rankings(
    *result_lists: list[dict[str, Any]],
    top: int = 30,
    rrf_k: int = RRF_K,
) -> list[dict[str, Any]]:
    """Merge one or more ranked result lists with reciprocal rank fusion."""
    scores: dict[str, float] = {}
    payloads: dict[str, dict[str, Any]] = {}

    for result_list in result_lists:
        for rank, row in enumerate(result_list, start=1):
            chunk_id = row["id"]
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (rrf_k + rank)
            base = payloads.get(chunk_id, {})
            base.update(row)
            payloads[chunk_id] = base

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:top]
    merged: list[dict[str, Any]] = []
    for chunk_id, score in ranked:
        row = payloads[chunk_id]
        row["id"] = chunk_id
        row["fusion_score"] = round(score, 6)
        merged.append(row)
    return merged


def reciprocal_rank_fusion(
    dense_results: list[dict[str, Any]],
    sparse_results: list[dict[str, Any]],
    *,
    top: int = 30,
    rrf_k: int = RRF_K,
    dense_weight: float = DENSE_WEIGHT,
    sparse_weight: float = SPARSE_WEIGHT,
) -> list[dict[str, Any]]:
    """Merge dense (vector) and sparse (BM25) rankings with reciprocal rank fusion.

    Rows are keyed by their ``id`` (``"{doc_id}:{chunk_index}"``). Later lists
    overwrite field collisions; dense payloads typically win when passed last.
    """
    scores: dict[str, float] = {}
    payloads: dict[str, dict[str, Any]] = {}

    for rank, row in enumerate(sparse_results, start=1):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + sparse_weight / (rrf_k + rank)
        payloads[chunk_id] = {**row, "sparse_rank": rank, "sparse_score": row.get("score")}

    for rank, row in enumerate(dense_results, start=1):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + dense_weight / (rrf_k + rank)
        base = payloads.get(chunk_id, {})
        base.update(row)
        base["dense_rank"] = rank
        base["dense_score"] = row.get("score")
        payloads[chunk_id] = base

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:top]
    merged: list[dict[str, Any]] = []
    for chunk_id, score in ranked:
        row = payloads[chunk_id]
        row["id"] = chunk_id
        row["fusion_score"] = round(score, 6)
        merged.append(row)
    return merged
