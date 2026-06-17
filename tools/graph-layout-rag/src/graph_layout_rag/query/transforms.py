from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from graph_layout_rag.paths import DATA_DIR
from rag_common.local_llm import generate_text

log = logging.getLogger("graph_layout_rag.query.transforms")

DEFAULT_EVAL_LLM_MODEL = "gemini-2.5-flash"


def cache_path() -> Path:
    from rag_common.local_llm import transform_cache_filename

    return DATA_DIR / "eval" / transform_cache_filename()


def eval_llm_model() -> str:
    from rag_common.local_llm import active_model

    return active_model()


def _load_cache() -> dict[str, str]:
    path = cache_path()
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(cache: dict[str, str]) -> None:
    path = cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def _cache_key(strategy: str, query: str) -> str:
    return f"{strategy}::{query}"


def _cached_or_generate(strategy: str, query: str, prompt: str) -> str:
    cache = _load_cache()
    key = _cache_key(strategy, query)
    if key in cache:
        return cache[key]

    text = generate_text(prompt)
    cache[key] = text
    _save_cache(cache)
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
    path = cache_path()
    if path.is_file():
        path.unlink()
