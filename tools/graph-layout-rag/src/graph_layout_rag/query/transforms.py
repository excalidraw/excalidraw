from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from graph_layout_rag.paths import DATA_DIR

log = logging.getLogger("graph_layout_rag.query.transforms")

DEFAULT_EVAL_LLM_MODEL = "gemini-2.0-flash"
CACHE_PATH = DATA_DIR / "eval" / "transform_cache.json"


def eval_llm_model() -> str:
    return os.getenv("GRAPH_RAG_EVAL_LLM_MODEL", DEFAULT_EVAL_LLM_MODEL).strip() or DEFAULT_EVAL_LLM_MODEL


def _load_cache() -> dict[str, str]:
    if not CACHE_PATH.is_file():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, CACHE_PATH)


def _cache_key(strategy: str, query: str) -> str:
    return f"{strategy}::{query}"


def _cached_or_generate(strategy: str, query: str, prompt: str) -> str:
    cache = _load_cache()
    key = _cache_key(strategy, query)
    if key in cache:
        return cache[key]

    text = _generate_text(prompt)
    cache[key] = text
    _save_cache(cache)
    return text


def _generate_text(prompt: str) -> str:
    try:
        from rag_common.gemini_embed import _client
    except ImportError as exc:
        raise RuntimeError("Gemini client unavailable for query transforms") from exc

    client = _client()
    model = eval_llm_model()
    response = client.models.generate_content(model=model, contents=prompt)
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError(f"Empty LLM response from {model}")
    return text


def multi_query_rewrites(query: str, *, n: int = 3) -> list[str]:
    prompt = (
        "You rewrite search queries for a graph drawing / layout theory paper corpus.\n"
        f"Original query: {query}\n\n"
        f"Return exactly {n} alternative search queries, one per line, with no numbering or bullets. "
        "Use technical graph layout terminology where appropriate."
    )
    raw = _cached_or_generate("multi_query", query, prompt)
    lines = [line.strip(" -\t") for line in raw.splitlines() if line.strip()]
    return lines[:n]


def hyde_passage(query: str) -> str:
    prompt = (
        "Write a short technical passage (120-180 words) that would appear in a graph drawing "
        "research paper and directly answer this question. Use precise algorithm names and "
        "terminology. Output only the passage.\n\n"
        f"Question: {query}"
    )
    return _cached_or_generate("hyde", query, prompt)


def step_back_query(query: str) -> str:
    prompt = (
        "Rewrite this graph layout research question into a more abstract, broader search query "
        "that retrieves background papers on the general technique family. Output only the "
        f"rewritten query.\n\nQuestion: {query}"
    )
    return _cached_or_generate("step_back", query, prompt)


def clear_transform_cache() -> None:
    if CACHE_PATH.is_file():
        CACHE_PATH.unlink()
