from __future__ import annotations

import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from rag_common.config import EmbedConfig, EmbedStats, LocalEmbedMode
from rag_common.env import PLACEHOLDER_CREDENTIAL_PATHS, valid_gemini_auth
from rag_common.gemini_rate_limit import estimate_tokens, get_rate_limiter

try:
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover
    genai_types = None  # type: ignore[assignment,misc]

log = logging.getLogger("rag_common.gemini")

BATCH_SIZE_V1 = 64
BATCH_SIZE_V2_DEFAULT = 1
MAX_RETRIES = 8
MAX_RATE_LIMIT_RETRIES = 64
# Char-count safety guards (NOT the model token limit). v1 accepts ~2048 tokens;
# v2 accepts ~8192 tokens (~32k chars), so this guard only trims pathological inputs
# while leaving headroom for enriched (Topics/Tags) chunk bodies.
MAX_INPUT_CHARS_V1 = 8000
MAX_INPUT_CHARS_V2 = 24000


class GeminiEmbedError(Exception):
    """Gemini embedding failed after retries."""


class GeminiFatalError(GeminiEmbedError):
    """Auth failure — caller may fall back to local."""


def is_gemini_embedding_2(model: str) -> bool:
    return "embedding-2" in model.lower()


def _is_rate_limit(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate" in msg or "quota" in msg or "resource_exhausted" in msg


def _is_auth_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return (
        "401" in msg
        or "403" in msg
        or "api key" in msg
        or "permission" in msg
        or "unauthenticated" in msg
    )


def _is_fatal(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return _is_auth_error(exc) or (
        ("404" in msg or "not_found" in msg)
        and ("model" in msg or "publisher model" in msg)
    )


def _parse_retry_after(exc: BaseException) -> int | None:
    msg = str(exc)
    match = re.search(r"retry[- ]?after[:\s]+(\d+)", msg, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _use_vertex() -> bool:
    raw = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _vertex_project() -> str:
    return (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or ""
    ).strip()


def _vertex_location() -> str:
    return (
        os.getenv("GOOGLE_CLOUD_LOCATION")
        or os.getenv("VERTEX_LOCATION")
        or "us-central1"
    ).strip()


def _gemini_api_key() -> str:
    for key in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        value = os.getenv(key)
        if value and value.strip():
            return value.strip()
    return ""


def _truncate(text: str, *, model: str) -> str:
    limit = MAX_INPUT_CHARS_V2 if is_gemini_embedding_2(model) else MAX_INPUT_CHARS_V1
    if len(text) <= limit:
        return text
    return text[:limit]


def _clear_invalid_adc_path() -> None:
    """Drop placeholder/missing GOOGLE_APPLICATION_CREDENTIALS so gcloud ADC is used."""
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not creds_path:
        return
    if creds_path in PLACEHOLDER_CREDENTIAL_PATHS:
        os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
        return
    path = Path(creds_path).expanduser()
    if not path.is_file():
        if "your" in creds_path.lower() or "path/to" in creds_path.lower():
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)


def _client():
    from google import genai

    if _use_vertex():
        _clear_invalid_adc_path()
        project = _vertex_project()
        location = _vertex_location()
        if not project:
            raise GeminiFatalError(
                "GOOGLE_GENAI_USE_VERTEXAI=true but GOOGLE_CLOUD_PROJECT is missing"
            )
        log.info("gemini client: vertexai project=%s location=%s", project, location)
        return genai.Client(vertexai=True, project=project, location=location)

    api_key = _gemini_api_key()
    if not api_key:
        raise GeminiFatalError(
            "GEMINI_API_KEY or GOOGLE_API_KEY missing "
            "(or set GOOGLE_GENAI_USE_VERTEXAI=true with GCP project)"
        )
    return genai.Client(api_key=api_key)


def format_gemini2_text(
    text: str,
    *,
    mode: LocalEmbedMode = "document",
    title: str | None = None,
) -> str:
    """Embedding-2 asymmetric RAG formatting (task prefixes, not task_type param)."""
    if mode == "query":
        return f"task: code retrieval | query: {text}"
    doc_title = title if title else "none"
    return f"title: {doc_title} | text: {text}"


def _batch_size(cfg: EmbedConfig) -> int:
    # Only gemini-embedding-001 (v1) supports server-side batching; v2 goes one
    # instance per request and gets throughput from concurrency instead.
    return BATCH_SIZE_V1


def _embed_one_raw(
    client,
    text: str,
    *,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
) -> list[float]:
    if genai_types is None:
        raise GeminiFatalError("google-genai is not installed; install rag-common[gemini]")

    response = client.models.embed_content(
        model=cfg.model,
        contents=text,
        config=genai_types.EmbedContentConfig(output_dimensionality=cfg.dimensions),
    )
    embeddings = response.embeddings or []
    if not embeddings:
        raise GeminiEmbedError("embed_content returned no embeddings")
    if len(embeddings) != 1:
        raise GeminiEmbedError(
            f"expected 1 embedding for single input, got {len(embeddings)}"
        )
    batch_tokens = estimate_tokens(text)
    if stats is not None:
        stats.add(tokens=batch_tokens, requests=1)
    return list(embeddings[0].values)


def _embed_one(
    client,
    text: str,
    *,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
) -> list[float]:
    limiter = get_rate_limiter()
    tokens = estimate_tokens(text)
    rate_attempt = 0
    other_attempt = 0

    while True:
        limiter.acquire(tokens)
        try:
            result = _embed_one_raw(client, text, cfg=cfg, stats=stats)
            limiter.note_success()
            return result
        except GeminiFatalError:
            raise
        except Exception as exc:
            if _is_fatal(exc):
                raise GeminiFatalError(str(exc)) from exc
            if _is_rate_limit(exc):
                rate_attempt += 1
                if rate_attempt >= MAX_RATE_LIMIT_RETRIES:
                    raise GeminiEmbedError(
                        f"gemini rate limit persisted after {rate_attempt} attempts: {exc}"
                    ) from exc
                wait = limiter.note_rate_limit(retry_after=_parse_retry_after(exc))
                log.warning(
                    "gemini embed rate limited (attempt %d), retry in %.0fs: %s",
                    rate_attempt,
                    wait,
                    exc,
                )
                time.sleep(wait)
                continue
            other_attempt += 1
            if other_attempt >= MAX_RETRIES:
                raise GeminiEmbedError(str(exc)) from exc
            wait = 2**other_attempt
            log.warning(
                "gemini embed attempt %d failed (%s), retry in %ds",
                other_attempt,
                exc,
                wait,
            )
            time.sleep(wait)


def _embed_batch_v1(
    client,
    batch: list[str],
    *,
    batch_num: int,
    total_batches: int,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
) -> list[list[float]]:
    if genai_types is None:
        raise GeminiFatalError("google-genai is not installed; install rag-common[gemini]")

    limiter = get_rate_limiter()
    batch_tokens = sum(estimate_tokens(t) for t in batch)
    rate_attempt = 0
    other_attempt = 0

    while True:
        limiter.acquire(batch_tokens)
        try:
            response = client.models.embed_content(
                model=cfg.model,
                contents=batch,
                config=genai_types.EmbedContentConfig(output_dimensionality=cfg.dimensions),
            )
            embeddings = response.embeddings or []
            if len(embeddings) != len(batch):
                raise GeminiEmbedError(
                    f"expected {len(batch)} embeddings, got {len(embeddings)}"
                )
            if stats is not None:
                stats.add(tokens=batch_tokens, requests=1)
            limiter.note_success()
            log.info(
                "gemini embed batch %d/%d size=%d tokens~=%d",
                batch_num,
                total_batches,
                len(batch),
                batch_tokens,
            )
            return [list(item.values) for item in embeddings]
        except GeminiFatalError:
            raise
        except Exception as exc:
            if _is_fatal(exc):
                raise GeminiFatalError(str(exc)) from exc
            if _is_rate_limit(exc):
                rate_attempt += 1
                if rate_attempt >= MAX_RATE_LIMIT_RETRIES:
                    raise GeminiEmbedError(
                        f"gemini rate limit persisted after {rate_attempt} attempts: {exc}"
                    ) from exc
                wait = limiter.note_rate_limit(retry_after=_parse_retry_after(exc))
                log.warning(
                    "gemini embed batch %d/%d rate limited (attempt %d), retry in %.0fs: %s",
                    batch_num,
                    total_batches,
                    rate_attempt,
                    wait,
                    exc,
                )
                time.sleep(wait)
                continue
            other_attempt += 1
            if other_attempt >= MAX_RETRIES:
                raise GeminiEmbedError(str(exc)) from exc
            wait = 2**other_attempt
            log.warning(
                "gemini embed batch %d/%d attempt %d failed (%s), retry in %ds",
                batch_num,
                total_batches,
                other_attempt,
                exc,
                wait,
            )
            time.sleep(wait)


def _embed_v2_concurrent(
    client,
    texts: list[str],
    *,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
    mode: LocalEmbedMode,
    titles: list[str] | None,
    workers: int,
) -> list[list[float]]:
    """Embed gemini-embedding-2 texts one request each, fanned out across a thread pool.

    Vertex v2 accepts a single instance per ``embed_content`` call, so throughput comes
    from concurrent requests (not batching). The shared ``GeminiRateLimiter`` is the true
    throttle; ``ThreadPoolExecutor.map`` preserves input order.
    """
    prepared = [
        format_gemini2_text(
            _truncate(raw, model=cfg.model),
            mode=mode,
            title=(titles[i] if titles and i < len(titles) else None),
        )
        for i, raw in enumerate(texts)
    ]
    total = len(prepared)
    if total == 0:
        return []

    workers = max(1, min(workers, total))
    if workers == 1:
        vectors = [_embed_one(client, t, cfg=cfg, stats=stats) for t in prepared]
        log.info("gemini-2 embedded %d text(s) serially (mode=%s)", total, mode)
        return vectors

    with ThreadPoolExecutor(max_workers=workers) as pool:
        vectors = list(
            pool.map(lambda t: _embed_one(client, t, cfg=cfg, stats=stats), prepared)
        )
    log.info(
        "gemini-2 embedded %d text(s) (mode=%s, workers=%d)", total, mode, workers
    )
    return vectors


def probe_gemini(cfg: EmbedConfig, *, stats: EmbedStats | None = None) -> None:
    if not valid_gemini_auth():
        raise GeminiFatalError(
            "Gemini auth missing: set Vertex (GOOGLE_GENAI_USE_VERTEXAI + project) "
            "or GEMINI_API_KEY"
        )
    client = _client()
    if is_gemini_embedding_2(cfg.model):
        _embed_one(
            client,
            format_gemini2_text("rag health check", mode="query"),
            cfg=cfg,
            stats=stats,
        )
    else:
        _embed_batch_v1(
            client,
            ["rag health check"],
            batch_num=1,
            total_batches=1,
            cfg=cfg,
            stats=stats,
        )


def embed_gemini_texts(
    texts: list[str],
    *,
    config: EmbedConfig,
    stats: EmbedStats | None = None,
    probe: bool = True,
    mode: LocalEmbedMode = "document",
    titles: list[str] | None = None,
    workers: int = 1,
) -> list[list[float]]:
    if not texts:
        return []

    if probe:
        probe_gemini(config, stats=stats)

    if titles is not None and len(titles) != len(texts):
        raise ValueError(f"titles length {len(titles)} != texts length {len(texts)}")

    client = _client()

    if is_gemini_embedding_2(config.model):
        log.info(
            "gemini-2 embedding %d texts model=%s dims=%d mode=%s workers=%d",
            len(texts),
            config.model,
            config.dimensions,
            mode,
            workers,
        )
        return _embed_v2_concurrent(
            client,
            texts,
            cfg=config,
            stats=stats,
            mode=mode,
            titles=titles,
            workers=workers,
        )

    # gemini-embedding-001 (v1): server-side batching is supported.
    prepared = [_truncate(t, model=config.model) for t in texts]
    batch_sz = _batch_size(config)
    batches = [prepared[i : i + batch_sz] for i in range(0, len(prepared), batch_sz)]
    total_batches = len(batches)

    log.info(
        "gemini embedding %d texts in %d batch(es) model=%s dims=%d mode=%s",
        len(prepared),
        total_batches,
        config.model,
        config.dimensions,
        mode,
    )

    vectors: list[list[float]] = []
    for batch_num, batch in enumerate(batches, start=1):
        vectors.extend(
            _embed_batch_v1(
                client,
                batch,
                batch_num=batch_num,
                total_batches=total_batches,
                cfg=config,
                stats=stats,
            )
        )
    return vectors
