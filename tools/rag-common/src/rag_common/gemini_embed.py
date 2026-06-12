from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from rag_common.config import EmbedConfig, EmbedStats, LocalEmbedMode
from rag_common.env import PLACEHOLDER_CREDENTIAL_PATHS, valid_gemini_auth

try:
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover
    genai_types = None  # type: ignore[assignment,misc]

log = logging.getLogger("rag_common.gemini")

BATCH_SIZE_V1 = 64
BATCH_SIZE_V2_DEFAULT = 1
MAX_RETRIES = 8
MAX_INPUT_CHARS_V1 = 8000
MAX_INPUT_CHARS_V2 = 8192


class GeminiEmbedError(Exception):
    """Gemini embedding failed after retries."""


class GeminiFatalError(GeminiEmbedError):
    """Auth or rate-limit failure — caller may fall back to local."""


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
    return _is_auth_error(exc) or _is_rate_limit(exc)


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
        return f"task: search result | query: {text}"
    doc_title = title if title else "none"
    return f"title: {doc_title} | text: {text}"


def _batch_size(cfg: EmbedConfig) -> int:
    if is_gemini_embedding_2(cfg.model):
        return max(1, int(os.getenv("RAG_GEMINI_EMBED_BATCH", str(BATCH_SIZE_V2_DEFAULT))))
    return BATCH_SIZE_V1


def _embed_one(
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
    batch_tokens = len(text.split())
    if stats is not None:
        stats.add(tokens=batch_tokens, requests=1)
    return list(embeddings[0].values)


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

    for attempt in range(MAX_RETRIES):
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
            batch_tokens = sum(len(t.split()) for t in batch)
            if stats is not None:
                stats.add(tokens=batch_tokens, requests=1)
            log.info(
                "gemini embed batch %d/%d size=%d tokens~=%d",
                batch_num,
                total_batches,
                len(batch),
                batch_tokens,
            )
            return [list(item.values) for item in embeddings]
        except Exception as exc:
            if _is_fatal(exc) and attempt == MAX_RETRIES - 1:
                raise GeminiFatalError(str(exc)) from exc
            if attempt == MAX_RETRIES - 1:
                raise GeminiEmbedError(str(exc)) from exc
            wait = 2**attempt
            if _is_fatal(exc):
                wait = max(wait, 15)
            log.warning(
                "gemini embed batch %d/%d attempt %d failed (%s), retry in %ds",
                batch_num,
                total_batches,
                attempt + 1,
                exc,
                wait,
            )
            time.sleep(wait)
    return []


def _embed_batch_v2(
    client,
    batch: list[str],
    *,
    batch_num: int,
    total_batches: int,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
    mode: LocalEmbedMode,
    titles: list[str] | None,
) -> list[list[float]]:
    vectors: list[list[float]] = []
    for i, raw in enumerate(batch):
        title = titles[i] if titles and i < len(titles) else None
        prepared = format_gemini2_text(
            _truncate(raw, model=cfg.model),
            mode=mode,
            title=title,
        )
        for attempt in range(MAX_RETRIES):
            try:
                vectors.append(_embed_one(client, prepared, cfg=cfg, stats=stats))
                break
            except GeminiFatalError:
                raise
            except Exception as exc:
                if attempt == MAX_RETRIES - 1:
                    if _is_fatal(exc):
                        raise GeminiFatalError(str(exc)) from exc
                    raise GeminiEmbedError(str(exc)) from exc
                wait = 2**attempt
                if _is_fatal(exc):
                    wait = max(wait, 15)
                log.warning(
                    "gemini-2 embed item %d in batch %d/%d attempt %d failed (%s), retry in %ds",
                    i + 1,
                    batch_num,
                    total_batches,
                    attempt + 1,
                    exc,
                    wait,
                )
                time.sleep(wait)
    log.info(
        "gemini-2 embed batch %d/%d size=%d mode=%s",
        batch_num,
        total_batches,
        len(batch),
        mode,
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
) -> list[list[float]]:
    if not texts:
        return []

    if probe:
        probe_gemini(config, stats=stats)

    if titles is not None and len(titles) != len(texts):
        raise ValueError(f"titles length {len(titles)} != texts length {len(texts)}")

    prepared = [_truncate(t, model=config.model) for t in texts]
    batch_sz = _batch_size(config)
    batches = [prepared[i : i + batch_sz] for i in range(0, len(prepared), batch_sz)]
    title_batches: list[list[str] | None] = []
    if titles is not None:
        for i in range(0, len(titles), batch_sz):
            title_batches.append(titles[i : i + batch_sz])
    else:
        title_batches = [None] * len(batches)

    total_batches = len(batches)
    v2 = is_gemini_embedding_2(config.model)

    log.info(
        "gemini embedding %d texts in %d batch(es) model=%s dims=%d v2=%s mode=%s",
        len(prepared),
        total_batches,
        config.model,
        config.dimensions,
        v2,
        mode,
    )

    client = _client()
    vectors: list[list[float]] = []
    for batch_num, (batch, batch_titles) in enumerate(
        zip(batches, title_batches, strict=True), start=1
    ):
        if v2:
            vectors.extend(
                _embed_batch_v2(
                    client,
                    batch,
                    batch_num=batch_num,
                    total_batches=total_batches,
                    cfg=config,
                    stats=stats,
                    mode=mode,
                    titles=batch_titles,
                )
            )
        else:
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
