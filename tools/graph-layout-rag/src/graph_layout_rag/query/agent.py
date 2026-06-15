"""Agentic / iterative deep-research retrieval (the "beyond RAG" arm).

PaperQA2 / Search-o1 style loop, built on the existing two query paths as tools:

    decompose  -> sub-questions via the LLM (+ original query)
    gather     -> retrieve_multi_query over all sub-questions (hybrid)
    judge      -> listwise LLM rerank (Retrieval-augmented Contextual Summarization
                  stands in as relevance ordering for the doc-level eval)
    iterate    -> if the LLM deems evidence insufficient, issue one follow-up query
                  and re-gather; otherwise stop.

Returns formatted, doc-level results (same shape as ``search``) so it can be both
benchmarked on the gold set and used at the CLI. LLM model is pinned via
``GRAPH_RAG_AGENT_LLM_MODEL`` (default 3.1-pro-preview in .env) and runs on the
``RAG_LLM_LOCATION`` endpoint.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any

from graph_layout_rag.query.retrieve import (
    RetrieveFilters,
    diversify_candidates,
    retrieve_multi_query,
)
from graph_layout_rag.query.search import format_results

log = logging.getLogger("graph_layout_rag.query.agent")

DEFAULT_AGENT_MODEL = "gemini-2.5-flash"


def agent_model() -> str:
    return os.getenv("GRAPH_RAG_AGENT_LLM_MODEL", DEFAULT_AGENT_MODEL).strip() or DEFAULT_AGENT_MODEL


def _llm(prompt: str) -> str:
    from rag_common.gemini_embed import _client, llm_location

    client = _client(location=llm_location())
    response = client.models.generate_content(model=agent_model(), contents=prompt)
    return (getattr(response, "text", None) or "").strip()


def _decompose(query: str) -> list[str]:
    prompt = (
        "Break this graph drawing / layout research question into 2-3 focused sub-questions "
        "that, answered together, cover it. Use precise algorithm/technique terms. "
        "One sub-question per line, no numbering.\n\n"
        f"Question: {query}"
    )
    try:
        raw = _llm(prompt)
    except Exception as exc:  # noqa: BLE001 — degrade to no decomposition
        log.warning("agent decompose failed (%s)", exc)
        return []
    return [ln.strip(" -\t") for ln in raw.splitlines() if ln.strip()][:3]


def _followup(query: str, titles: list[str]) -> str | None:
    """Ask whether evidence is sufficient; return one follow-up query or None."""
    listing = "\n".join(f"- {t}" for t in titles[:10])
    prompt = (
        "You are gathering papers to answer a graph-layout research question.\n"
        f"Question: {query}\n\nRetrieved so far:\n{listing}\n\n"
        "If these cover the question, reply exactly DONE. Otherwise reply with ONE additional "
        "search query (precise terms) for the missing aspect."
    )
    try:
        reply = _llm(prompt).strip()
    except Exception as exc:  # noqa: BLE001
        log.warning("agent followup failed (%s)", exc)
        return None
    if not reply or reply.upper().startswith("DONE"):
        return None
    # Strip any leading label/punctuation the model may add.
    return re.sub(r"^(query[:\-\s]*)", "", reply, flags=re.IGNORECASE).strip() or None


def deep_research(
    query: str,
    *,
    top: int = 8,
    embed_profile: str | None = None,
    filters: RetrieveFilters | None = None,
    max_iters: int = 2,
    rerank: bool = True,
    max_per_doc: int = 2,
) -> list[dict[str, Any]]:
    """Iterative retrieve → listwise-judge → (maybe) follow-up → format."""
    from rag_common.rerank import rerank_listwise_llm

    filters = filters or RetrieveFilters()
    queries = [query, *(_decompose(query))]
    # De-dup, preserve order.
    seen: set[str] = set()
    queries = [q for q in queries if not (q in seen or seen.add(q))]

    reranked: list[dict[str, Any]] = []
    for iteration in range(max_iters):
        candidates = retrieve_multi_query(
            queries, top=top, embed_profile=embed_profile, hybrid=True, filters=filters
        )
        diverse = diversify_candidates(candidates, max_per_doc=5, limit=max(top * 3, 60))
        if rerank and diverse:
            reranked = rerank_listwise_llm(
                query,
                diverse,
                top=max(top * 3, top),
                enabled=True,
                model_name=agent_model(),
                pool=min(20, len(diverse)),
            )
        else:
            reranked = diverse
        if iteration + 1 >= max_iters:
            break
        titles = [r.get("title") or "" for r in reranked[:10]]
        follow = _followup(query, titles)
        if not follow:
            break
        queries.append(follow)

    return format_results(reranked, top=top, max_per_doc=max_per_doc)
