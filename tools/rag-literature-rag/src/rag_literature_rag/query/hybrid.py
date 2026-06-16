from __future__ import annotations

from typing import Any

# RRF rank constant. k=20 sharpens top-rank weighting vs the classic 60; the
# de-biased bake-off (neutral LLM-judged qrels) measured it a consistent win
# over k=60 on both tracks (catalog 0.768 vs 0.765, pdf 0.715 vs 0.696).
RRF_K = 20


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
    dense_weight: float = 1.0,
    sparse_weight: float = 1.0,
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
