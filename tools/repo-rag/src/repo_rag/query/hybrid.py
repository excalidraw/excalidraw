from __future__ import annotations

from typing import Any

RRF_K = 60


def reciprocal_rank_fusion(
    dense_results: list[dict[str, Any]],
    sparse_results: list[dict[str, Any]],
    *,
    top: int = 20,
) -> list[dict[str, Any]]:
    """Merge dense and BM25 rankings with reciprocal rank fusion."""
    scores: dict[str, float] = {}
    payloads: dict[str, dict[str, Any]] = {}

    for rank, row in enumerate(dense_results, start=1):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank)
        payloads[chunk_id] = {**row, "dense_rank": rank, "dense_score": row.get("score")}

    for rank, row in enumerate(sparse_results, start=1):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank)
        base = payloads.get(chunk_id, {})
        base.update(row)
        base["sparse_rank"] = rank
        base["sparse_score"] = row.get("score")
        payloads[chunk_id] = base

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:top]
    merged: list[dict[str, Any]] = []
    for chunk_id, score in ranked:
        row = payloads[chunk_id]
        row["score"] = round(score, 6)
        row["id"] = chunk_id
        merged.append(row)
    return merged
