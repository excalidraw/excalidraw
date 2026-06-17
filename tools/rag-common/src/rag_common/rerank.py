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
# Configurable via RAG_RERANK_MAX_CHARS so structured chunks are not over-truncated.
MAX_RERANK_CHARS = 2000
DEFAULT_RERANK_BATCH_SIZE = 8
DEFAULT_LISTWISE_LLM_MODEL = "gemini-2.5-flash"
# Listwise candidates are passed in a single prompt; keep each snippet compact.
LISTWISE_SNIPPET_CHARS = 600


def max_rerank_chars() -> int:
    raw = os.getenv("RAG_RERANK_MAX_CHARS", str(MAX_RERANK_CHARS)).strip()
    try:
        return max(256, int(raw))
    except ValueError:
        return MAX_RERANK_CHARS


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

    pairs = [(query, (row.get(text_key) or "")[:max_rerank_chars()]) for row in rows]
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


def listwise_llm_model() -> str:
    raw = os.getenv("RAG_LISTWISE_LLM_MODEL", "").strip()
    return raw or DEFAULT_LISTWISE_LLM_MODEL


def _parse_rank_order(text: str, n: int) -> list[int]:
    """Extract a permutation of 0..n-1 from an LLM ranking reply.

    Accepts replies like ``[3] > [1] > [0]`` or ``3,1,0``. Unranked items are
    appended in their original order so nothing is dropped.
    """
    import re

    seen: list[int] = []
    for tok in re.findall(r"\d+", text):
        idx = int(tok)
        if 0 <= idx < n and idx not in seen:
            seen.append(idx)
    for idx in range(n):
        if idx not in seen:
            seen.append(idx)
    return seen


def rerank_listwise_llm(
    query: str,
    rows: list[dict[str, Any]],
    *,
    top: int,
    text_key: str = "text",
    enabled: bool | None = None,
    model_name: str | None = None,
    pool: int = 20,
) -> list[dict[str, Any]]:
    """RankGPT-style listwise reranking in a single LLM call.

    Reorders the top ``pool`` candidates by asking the model to rank them, then
    returns the best ``top``. Degrades to a plain top-k slice when disabled or
    when the LLM is unavailable. Each kept row gains a ``rerank_score`` field
    (descending by listwise rank).
    """
    use = rerank_enabled() if enabled is None else enabled
    if not use or len(rows) <= 1 or top <= 0:
        return rows[:top]

    head = rows[: max(pool, top)]
    tail = rows[len(head):]
    lines = []
    for i, row in enumerate(head):
        title = (row.get("title") or "").strip()
        snippet = (row.get(text_key) or "").replace("\n", " ")[:LISTWISE_SNIPPET_CHARS]
        lines.append(f"[{i}] {title} :: {snippet}")
    prompt = (
        "You are ranking passages from a graph drawing / layout theory corpus by "
        "relevance to a search query. Order ALL passages from most to least relevant.\n\n"
        f"Query: {query}\n\nPassages:\n" + "\n".join(lines) + "\n\n"
        "Reply with the passage indices in ranked order, e.g. [3] > [0] > [1]. "
        "Include every index exactly once."
    )
    try:
        from rag_common.local_llm import active_model, generate_text

        text = generate_text(prompt, model=model_name or active_model())
        if not text:
            raise RuntimeError("empty listwise LLM response")
    except Exception as exc:  # noqa: BLE001 — degrade rather than fail a query
        log.warning("listwise LLM rerank unavailable (%s); returning unranked top-%d", exc, top)
        return rows[:top]

    order = _parse_rank_order(text, len(head))
    reordered = [head[i] for i in order]
    scored = [
        {**row, "rerank_score": round(1.0 - rank / max(1, len(reordered)), 6)}
        for rank, row in enumerate(reordered)
    ]
    # Tail (beyond the listwise pool) keeps original order below the ranked head.
    scored.extend({**row, "rerank_score": 0.0} for row in tail)
    return scored[:top]
