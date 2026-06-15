"""Contextual Retrieval (Anthropic) chunk augmentation.

Prepends a short LLM-generated context line to each chunk's *embed/BM25* text
(the stored display text is left clean). Gated on the embed profile name so the
production ``gemini-2-structure-v1`` index is never touched — only profiles whose
name contains ``contextual`` are augmented, e.g. ``gemini-2-contextual-v1``.

The context line situates the chunk within its document so that, after
embedding, an out-of-context chunk ("...as shown above...") still retrieves.
Contexts are cached on disk keyed by the document fingerprint + chunk index so
re-ingest is cheap and deterministic.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from graph_layout_rag.ingest.chunk import TextChunk
from graph_layout_rag.paths import DATA_DIR

log = logging.getLogger("graph_layout_rag.ingest.contextual")

CACHE_PATH = DATA_DIR / "indexes" / "contextual_cache.json"
CONTEXT_MODEL_ENV = "GRAPH_RAG_CONTEXT_LLM_MODEL"
DEFAULT_CONTEXT_MODEL = "gemini-2.5-flash"
# Keep the LLM input bounded — context only needs the chunk gist, not the tail.
MAX_CHUNK_CHARS_FOR_CONTEXT = 1500


def is_contextual_profile(profile: str | None) -> bool:
    return bool(profile) and "contextual" in profile.lower()


def _context_model() -> str:
    return os.getenv(CONTEXT_MODEL_ENV, DEFAULT_CONTEXT_MODEL).strip() or DEFAULT_CONTEXT_MODEL


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
    tmp.write_text(json.dumps(cache, indent=0, sort_keys=True), encoding="utf-8")
    os.replace(tmp, CACHE_PATH)


def _cache_key(chunk: TextChunk) -> str:
    fp = chunk.canonical_sha256 or chunk.doc_id
    return f"{fp}:{chunk.chunk_index}"


def _generate_context(title: str, section_path: str, body: str, model: str) -> str:
    from rag_common.gemini_embed import _client, llm_location

    prompt = (
        "You add retrieval context to a chunk from a graph drawing / layout theory paper.\n"
        f"Document title: {title}\n"
        f"Section: {section_path or '(unknown)'}\n"
        "Chunk:\n"
        f"{body[:MAX_CHUNK_CHARS_FOR_CONTEXT]}\n\n"
        "Write ONE sentence (max 30 words) situating this chunk within the document so it "
        "is retrievable on its own: name the algorithm/technique and what the chunk covers. "
        "Output only the sentence."
    )
    client = _client(location=llm_location())
    response = client.models.generate_content(model=model, contents=prompt)
    return (getattr(response, "text", None) or "").strip().replace("\n", " ")


def _context_workers() -> int:
    raw = os.getenv("GRAPH_RAG_CONTEXT_WORKERS", "12").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 12


def augment_texts_for_context(chunks: list[TextChunk], texts: list[str]) -> list[str]:
    """Return embed/BM25 texts with a cached context line prepended per chunk.

    Context lines are generated concurrently (cache-miss chunks only) so a full
    corpus pass is feasible. Fails soft: if the LLM is unavailable for a chunk,
    that chunk is left unaugmented rather than aborting the ingest.
    """
    from concurrent.futures import ThreadPoolExecutor

    cache = _load_cache()
    model = _context_model()
    keys = [_cache_key(c) for c in chunks]
    misses = [i for i, k in enumerate(keys) if k not in cache]

    def _gen(i: int) -> tuple[int, str]:
        c = chunks[i]
        try:
            return i, _generate_context(c.title or "", c.section_path or "", c.text, model)
        except Exception as exc:  # noqa: BLE001 — degrade, don't abort ingest
            log.warning("context gen failed for %s (%s)", keys[i], exc)
            return i, ""

    if misses:
        done = 0
        with ThreadPoolExecutor(max_workers=_context_workers()) as pool:
            for i, ctx in pool.map(_gen, misses):
                cache[keys[i]] = ctx
                done += 1
                if done % 500 == 0:  # periodic checkpoint for long unattended runs
                    _save_cache(cache)
                    log.info("contextual augmentation: %d/%d context lines", done, len(misses))
        _save_cache(cache)
        log.info("contextual augmentation: generated %d new context line(s)", len(misses))

    return [
        (f"Context: {cache[k]}\n{t}" if cache.get(k) else t)
        for k, t in zip(keys, texts)
    ]
