"""Contextual Retrieval (Anthropic) chunk augmentation.

Prepends a short LLM-generated context line to each chunk's *embed/BM25* text
(the stored display text is left clean). Gated on the embed profile name so the
production ``gemini-2-structure-v1``/``cuda-qwen0.6b-1024`` indexes are never
touched — only profiles whose name contains ``contextual`` are augmented, e.g.
``cuda-qwen0.6b-contextual-v1``.

The context line situates the chunk within its document so that, after
embedding, an out-of-context chunk ("...as shown above...") still retrieves.
Contexts are cached on disk keyed by a versioned fingerprint (domain prompt
version + backend + model + doc fingerprint + chunk index) so re-ingest is
cheap and deterministic, and changing the prompt/backend/model never reuses
stale context lines across A/B experiments.
"""
from __future__ import annotations

import json
import logging
import os
import random
import time

from graph_layout_rag.ingest.chunk import TextChunk
from graph_layout_rag.paths import DATA_DIR
from rag_common.local_llm import active_model, generate_text, llm_backend

log = logging.getLogger("graph_layout_rag.ingest.contextual")

CACHE_PATH = DATA_DIR / "indexes" / "contextual_cache.json"
CONTEXT_MODEL_ENV = "GRAPH_RAG_CONTEXT_LLM_MODEL"
DEFAULT_CONTEXT_MODEL = "gemini-2.5-flash"
# Keep the LLM input bounded — context only needs the chunk gist, not the tail.
MAX_CHUNK_CHARS_FOR_CONTEXT = 1500

# Retry/backoff for transient context-gen errors (rate limits, timeouts).
# Mirrors rag-literature-rag's fix for its 9.5% failure rate (2026-06-16
# runs): all failures there were transient Gemini 429s, not model-quality
# issues. Retrying with backoff resolves almost all of them; anything still
# failing after retries falls back to the raw (unaugmented) chunk rather than
# aborting ingest.
CONTEXT_GEN_MAX_RETRIES = 3
CONTEXT_GEN_BASE_DELAY_S = 1.5
CONTEXT_GEN_MAX_DELAY_S = 20.0

# Substrings identifying transient/retryable errors across backends (Gemini
# 429/503, Ollama timeouts/connection errors). Matched case-insensitively
# against str(exc).
_RETRYABLE_ERROR_MARKERS = (
    "resource_exhausted",
    "429",
    "503",
    "unavailable",
    "timeout",
    "timed out",
    "connection",
    "rate limit",
    "too many requests",
)


def _is_retryable(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _RETRYABLE_ERROR_MARKERS)


def is_contextual_profile(profile: str | None) -> bool:
    return bool(profile) and "contextual" in profile.lower()


def _context_model() -> str:
    if llm_backend() == "ollama":
        return active_model()
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


# Domain tag in the cache key: changing the context prompt's domain framing
# (or backend/model) invalidates stale context lines instead of reusing them
# across A/B experiments. Bump this when the prompt below changes meaning.
_CONTEXT_VERSION = "graph-v1"


def _cache_key(chunk: TextChunk, *, backend: str, model: str) -> str:
    fp = chunk.canonical_sha256 or chunk.doc_id
    model_key = f"{backend}:{model}".replace("/", "_")
    return f"{_CONTEXT_VERSION}:{model_key}:{fp}:{chunk.chunk_index}"


def _generate_context(title: str, section_path: str, body: str, model: str) -> str:
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
    # Only pass the Gemini model override to Gemini. For Ollama, let
    # rag_common.local_llm resolve RAG_OLLAMA_MODEL.
    resolved_model = model if llm_backend() == "gemini" else None
    return generate_text(prompt, model=resolved_model, max_tokens=96).strip().replace("\n", " ")


def _context_workers() -> int:
    raw = os.getenv("GRAPH_RAG_CONTEXT_WORKERS", "12").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 12


def augment_texts_for_context(chunks: list[TextChunk], texts: list[str]) -> list[str]:
    """Return embed/BM25 texts with a cached context line prepended per chunk.

    Context lines are generated concurrently (cache-miss chunks only) so a full
    corpus pass is feasible. Fails soft: if the LLM is unavailable for a chunk
    after retries, that chunk is left unaugmented rather than aborting ingest.
    """
    from concurrent.futures import ThreadPoolExecutor

    cache = _load_cache()
    model = _context_model()
    backend = llm_backend()
    keys = [_cache_key(c, backend=backend, model=model) for c in chunks]
    misses = [i for i, k in enumerate(keys) if k not in cache]

    def _gen(i: int) -> tuple[int, str, bool]:
        """Returns (index, context_or_empty, hard_failure).

        hard_failure distinguishes a fallback-to-raw-chunk (retries exhausted
        or a non-retryable error) from a clean success, so the true
        post-fix failure rate can be computed from logs rather than
        conflated with successful generations.
        """
        c = chunks[i]
        last_exc: Exception | None = None
        for attempt in range(CONTEXT_GEN_MAX_RETRIES + 1):
            try:
                ctx = _generate_context(c.title or "", c.section_path or "", c.text, model)
                if attempt > 0:
                    log.info(
                        "context gen succeeded for %s after %d retr%s",
                        keys[i], attempt, "y" if attempt == 1 else "ies",
                    )
                return i, ctx, False
            except Exception as exc:  # noqa: BLE001 — decide retry vs. fallback below
                last_exc = exc
                if attempt >= CONTEXT_GEN_MAX_RETRIES or not _is_retryable(exc):
                    break
                delay = min(
                    CONTEXT_GEN_MAX_DELAY_S,
                    CONTEXT_GEN_BASE_DELAY_S * (2 ** attempt),
                )
                delay += random.uniform(0, delay * 0.25)  # jitter
                log.warning(
                    "context gen transient failure for %s (attempt %d/%d, retrying in %.1fs): %s",
                    keys[i], attempt + 1, CONTEXT_GEN_MAX_RETRIES + 1, delay, exc,
                )
                time.sleep(delay)
        # HARD failure: retries exhausted or a non-retryable error. Fall back
        # to the raw (unaugmented) chunk rather than aborting ingest.
        log.warning(
            "context gen FALLBACK (raw chunk, no context line) for %s after %d attempt(s): %s",
            keys[i], CONTEXT_GEN_MAX_RETRIES + 1, last_exc,
        )
        return i, "", True

    if misses:
        done = fallback = 0
        with ThreadPoolExecutor(max_workers=_context_workers()) as pool:
            for i, ctx, hard_failure in pool.map(_gen, misses):
                # Only cache successful (non-empty) generations. Caching a
                # fallback would make it a permanent cache hit and silently
                # embed that chunk WITHOUT context forever — contaminating
                # any contextual-vs-plain A/B. Fallback chunks stay cache
                # misses and are retried (with fresh backoff) on next ingest.
                if ctx:
                    cache[keys[i]] = ctx
                if hard_failure:
                    fallback += 1
                done += 1
                if done % 500 == 0:  # periodic checkpoint for long unattended runs
                    _save_cache(cache)
                    log.info("contextual augmentation: %d/%d context lines", done, len(misses))
        _save_cache(cache)
        failure_rate = (fallback / len(misses)) if misses else 0.0
        log.info(
            "contextual augmentation: generated %d new context line(s), %d hard fallback(s) "
            "(failure_rate=%.4f, will retry fallbacks on next ingest)",
            len(misses) - fallback,
            fallback,
            failure_rate,
        )

    return [
        (f"Context: {cache[k]}\n{t}" if cache.get(k) else t)
        for k, t in zip(keys, texts)
    ]
