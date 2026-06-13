"""Local cross-encoder reranking for RAG retrieval.

Reorders a wide candidate set ("retrieve wide, rerank narrow") with a local
cross-encoder so retrieval quality does not depend on the embedding model alone.
Runs offline on MPS/CPU; no API keys or network. Gracefully degrades to a plain
top-k slice when disabled or when the model/dep is unavailable.
"""

from __future__ import annotations

import logging
import os
import platform
from functools import lru_cache
from typing import Any

log = logging.getLogger("rag_common.rerank")

DEFAULT_RERANK_MODEL = "BAAI/bge-reranker-v2-m3"
# Cross-encoders only see the first N chars of each candidate; papers are long.
MAX_RERANK_CHARS = 2000
DEFAULT_RERANK_BATCH_SIZE = 8


def rerank_enabled() -> bool:
    raw = os.getenv("RAG_RERANK_ENABLED", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def rerank_model_name() -> str:
    return os.getenv("RAG_RERANK_MODEL", DEFAULT_RERANK_MODEL).strip() or DEFAULT_RERANK_MODEL


def _rerank_top_override() -> int | None:
    raw = os.getenv("RAG_RERANK_TOP", "").strip()
    if not raw:
        return None
    try:
        return max(1, int(raw))
    except ValueError:
        return None


def _rerank_batch_size() -> int:
    raw = os.getenv("RAG_RERANK_BATCH_SIZE", str(DEFAULT_RERANK_BATCH_SIZE)).strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return DEFAULT_RERANK_BATCH_SIZE


def _device() -> str | None:
    if platform.system() != "Darwin":
        return None
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return None


@lru_cache(maxsize=2)
def _get_cross_encoder(model_name: str):
    from sentence_transformers import CrossEncoder

    log.info("loading cross-encoder reranker %s", model_name)
    device = _device()
    if device:
        return CrossEncoder(model_name, device=device)
    return CrossEncoder(model_name)


def rerank(
    query: str,
    rows: list[dict[str, Any]],
    *,
    top: int,
    text_key: str = "text",
    enabled: bool | None = None,
    model_name: str | None = None,
) -> list[dict[str, Any]]:
    """Rerank ``rows`` by cross-encoder relevance to ``query``; return the best ``top``.

    A no-op passthrough (plain top-k slice) when reranking is disabled, the candidate
    set is trivial, or the cross-encoder cannot be loaded. Each kept row gains a
    ``rerank_score`` field.
    """
    use = rerank_enabled() if enabled is None else enabled
    override = _rerank_top_override()
    if override is not None:
        top = override

    if not use or len(rows) <= 1 or top <= 0:
        return rows[:top]

    name = model_name or rerank_model_name()
    try:
        model = _get_cross_encoder(name)
    except Exception as exc:  # noqa: BLE001 — degrade rather than fail a query
        log.warning("reranker %s unavailable (%s); returning unranked top-%d", name, exc, top)
        return rows[:top]

    pairs = [(query, (row.get(text_key) or "")[:MAX_RERANK_CHARS]) for row in rows]
    try:
        try:
            scores = model.predict(pairs, batch_size=_rerank_batch_size())
        except TypeError:
            # Lightweight test doubles and older CrossEncoder releases may not
            # expose batch_size; preserve compatibility while preferring bounded batches.
            scores = model.predict(pairs)
    except Exception as exc:  # noqa: BLE001
        log.warning("rerank predict failed (%s); returning unranked top-%d", exc, top)
        return rows[:top]

    scored = [
        {**row, "rerank_score": round(float(score), 6)}
        for row, score in zip(rows, scores)
    ]
    scored.sort(key=lambda r: r["rerank_score"], reverse=True)
    return scored[:top]
