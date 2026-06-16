"""Gemini-vision extraction backend — render each page to an image and have a
multimodal Gemini model transcribe it to Markdown. Conforms to PdfExtractResult.

Opt-in and additive (default backend stays PyMuPDF). Reuses the same auth/client
construction as embeddings (``rag_common.gemini_embed._client`` — Vertex / API-key / ADC)
and the SDK already pulled in by ``rag-common[gemini]``; the import is lazy so the CLI
degrades gracefully when Gemini isn't configured, mirroring the docling backend.

Cost note: this makes ONE API call per page — intended for A/B on a few docs, not routine
full-corpus ingest. Bound it with ``RAG_LIT_GEMINI_VISION_MAX_PAGES``.

Parallelism: pages are rendered synchronously (cheap, PyMuPDF) then transcribed concurrently
via the SDK's **async** client (``client.aio.models.generate_content``) bounded by an
``asyncio.Semaphore``. We deliberately avoid ``ThreadPoolExecutor`` over the *sync* client:
the google-genai sync client has documented thread-safety hangs under threads
(googleapis/python-genai #1893, #211) where sockets stall and the client never recovers. The
async client over httpx is the SDK-recommended concurrency path; we also set a per-request
timeout so a stalled call fails instead of wedging the whole run.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from functools import lru_cache
from pathlib import Path

import fitz

from rag_literature_rag.pdf_text import (
    PdfExtractResult,
    _quiet_mupdf_stderr,
    clean_markdown_text,
)

log = logging.getLogger("rag_literature_rag.gemini_vision")

# gemini-3.x models are served only from the `global` Vertex endpoint (regional 404s) and
# carry a `-preview` suffix. Both are overridable below.
DEFAULT_MODEL = "gemini-3.1-pro-preview"
# gemini-3.x lives on the global endpoint; the embedding model uses a regional one, so the
# vision client overrides location independently (does not touch GOOGLE_CLOUD_LOCATION).
DEFAULT_LOCATION = "global"
DEFAULT_DPI = 200
DEFAULT_CONCURRENCY = 8
# Empirical project ceiling (gemini-3.5-flash, Vertex global, this GCP project): bursts of 400
# concurrent requests succeed cleanly; 700 collapses (~85% 429 RESOURCE_EXHAUSTED). We hard-cap
# well below that — real page transcription is ~6.8k tokens/page, so TPM (not request count)
# binds far before 400 in-flight image calls. 200 leaves ~2x headroom for that + retries.
MAX_CONCURRENCY = 200
DEFAULT_TIMEOUT_MS = 120_000
_MAX_RETRIES = 2

_PROMPT = (
    "Transcribe this PDF page to GitHub-flavored Markdown. Preserve the natural reading "
    "order (handle multi-column layouts correctly). Render tables as Markdown tables and "
    "mathematical formulas as LaTeX. Output only the page content — no commentary, no "
    "surrounding code fences."
)


def _vision_model() -> str:
    return os.getenv("RAG_LIT_GEMINI_VISION_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _vision_location() -> str:
    return (
        os.getenv("RAG_LIT_GEMINI_VISION_LOCATION", DEFAULT_LOCATION).strip()
        or DEFAULT_LOCATION
    )


def _vision_dpi() -> int:
    try:
        return int(os.getenv("RAG_LIT_GEMINI_VISION_DPI", str(DEFAULT_DPI)))
    except ValueError:
        return DEFAULT_DPI


def _max_pages() -> int:
    """0 = all pages."""
    try:
        return max(0, int(os.getenv("RAG_LIT_GEMINI_VISION_MAX_PAGES", "0")))
    except ValueError:
        return 0


def _min_interval_s() -> float:
    try:
        return max(0.0, int(os.getenv("RAG_LIT_GEMINI_VISION_MIN_INTERVAL_MS", "0")) / 1000.0)
    except ValueError:
        return 0.0


def _concurrency() -> int:
    """Max in-flight page transcriptions, clamped to ``[1, MAX_CONCURRENCY]``.

    1 = sequential (sync path). The upper clamp is the empirical project ceiling — see
    ``MAX_CONCURRENCY`` — so a stray env value can't trigger mass 429s.
    """
    try:
        requested = int(os.getenv("RAG_LIT_GEMINI_VISION_CONCURRENCY", str(DEFAULT_CONCURRENCY)))
    except ValueError:
        return DEFAULT_CONCURRENCY
    clamped = max(1, min(requested, MAX_CONCURRENCY))
    if requested > MAX_CONCURRENCY:
        log.warning(
            "RAG_LIT_GEMINI_VISION_CONCURRENCY=%d exceeds the hard cap %d; clamping",
            requested, MAX_CONCURRENCY,
        )
    return clamped


def _timeout_ms() -> int:
    """Per-request HTTP timeout (ms) — guards against the SDK's indefinite socket stalls."""
    try:
        return max(0, int(os.getenv("RAG_LIT_GEMINI_VISION_TIMEOUT_MS", str(DEFAULT_TIMEOUT_MS))))
    except ValueError:
        return DEFAULT_TIMEOUT_MS


@lru_cache(maxsize=1)
def _client():
    """One Gemini client per process.

    Reuses embeddings' Vertex/API-key/ADC *resolution* (project, creds), but overrides the
    Vertex location to the vision endpoint (default ``global``) so gemini-3.x resolves —
    embeddings keep their own regional ``GOOGLE_CLOUD_LOCATION`` untouched.
    """
    from google import genai
    from google.genai import types as genai_types
    from rag_common.gemini_embed import (
        GeminiFatalError,
        _clear_invalid_adc_path,
        _gemini_api_key,
        _use_vertex,
        _vertex_project,
    )

    # Per-request timeout (ms) shared by sync + async calls; defends against the documented
    # google-genai socket stalls so a wedged page fails fast instead of hanging the run.
    http_options = genai_types.HttpOptions(timeout=_timeout_ms())

    if _use_vertex():
        _clear_invalid_adc_path()
        project = _vertex_project()
        if not project:
            raise GeminiFatalError(
                "GOOGLE_GENAI_USE_VERTEXAI=true but GOOGLE_CLOUD_PROJECT is missing"
            )
        location = _vision_location()
        log.info("gemini-vision client: vertexai project=%s location=%s", project, location)
        return genai.Client(
            vertexai=True, project=project, location=location, http_options=http_options
        )

    api_key = _gemini_api_key()
    if not api_key:
        raise GeminiFatalError(
            "GEMINI_API_KEY or GOOGLE_API_KEY missing "
            "(or set GOOGLE_GENAI_USE_VERTEXAI=true with GCP project)"
        )
    return genai.Client(api_key=api_key, http_options=http_options)


def _is_rate_limit(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate" in msg or "quota" in msg or "resource_exhausted" in msg


def _is_auth_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(s in msg for s in ("401", "403", "api key", "permission", "unauthenticated"))


def _resp_text_tokens(resp) -> tuple[str, int]:
    text = resp.text or ""
    tokens = 0
    usage = getattr(resp, "usage_metadata", None)
    if usage is not None:
        tokens = int(getattr(usage, "total_token_count", 0) or 0)
    return text, tokens


def _image_part(png: bytes):
    from google.genai import types as genai_types

    return genai_types.Part.from_bytes(data=png, mime_type="image/png")


def _transcribe_page(client, png: bytes) -> tuple[str, int]:
    """Transcribe one page image (sync); return (markdown, tokens_used). Retries transient errors."""
    image_part = _image_part(png)
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = client.models.generate_content(
                model=_vision_model(),
                contents=[_PROMPT, image_part],
            )
            return _resp_text_tokens(resp)
        except Exception as exc:  # noqa: BLE001 — classify below
            if _is_auth_error(exc):
                raise  # fatal: surfaced as open_error by caller
            last_exc = exc
            if attempt < _MAX_RETRIES and _is_rate_limit(exc):
                time.sleep(2.0 * (attempt + 1))
                continue
            raise
    raise last_exc  # pragma: no cover — loop always returns or raises


class _AuthError(Exception):
    """Raised inside the async pool to abort the whole doc on an auth failure."""


async def _transcribe_page_async(client, png: bytes, sem: asyncio.Semaphore) -> tuple[str, int]:
    """Transcribe one page via the async client, gated by ``sem``. Raises _AuthError on auth."""
    image_part = _image_part(png)
    last_exc: Exception | None = None
    async with sem:
        for attempt in range(_MAX_RETRIES + 1):
            try:
                resp = await client.aio.models.generate_content(
                    model=_vision_model(),
                    contents=[_PROMPT, image_part],
                )
                return _resp_text_tokens(resp)
            except Exception as exc:  # noqa: BLE001 — classify below
                if _is_auth_error(exc):
                    raise _AuthError(str(exc)) from exc
                last_exc = exc
                if attempt < _MAX_RETRIES and _is_rate_limit(exc):
                    await asyncio.sleep(2.0 * (attempt + 1))
                    continue
                raise
    raise last_exc  # pragma: no cover — loop always returns or raises


async def _transcribe_all_async(
    client, page_pngs: list[tuple[int, bytes]], *, concurrency: int
) -> tuple[dict[int, tuple[str, int]], list[int], Exception | None]:
    """Transcribe rendered pages concurrently (bounded by ``concurrency``).

    Returns (results-by-page-no, failed-page-nos, auth_error). Auth failure on any page
    cancels the rest and is returned once so the caller can set ``open_error``.
    """
    sem = asyncio.Semaphore(concurrency)
    results: dict[int, tuple[str, int]] = {}
    failed: list[int] = []
    auth_error: Exception | None = None

    async def work(page_no: int, png: bytes) -> None:
        nonlocal auth_error
        try:
            results[page_no] = await _transcribe_page_async(client, png, sem)
        except _AuthError as exc:
            auth_error = exc
        except Exception as exc:  # noqa: BLE001 — per-page failure, keep going
            failed.append(page_no)
            log.debug("transcribe failed p%d: %s", page_no, exc)

    await asyncio.gather(*(work(p, png) for p, png in page_pngs))
    return results, failed, auth_error


def extract_pages_gemini(path: Path, *, clean: bool = True) -> PdfExtractResult:
    """Render each page and transcribe it to Markdown via Gemini-vision.

    Returns ``open_error="gemini not configured: ..."`` when the SDK is missing or auth
    is unavailable, so callers never hard-crash. ``failed_pages`` records per-page errors.
    """
    result = PdfExtractResult()
    if not path.is_file():
        result.open_error = "file missing"
        return result

    try:
        client = _client()
    except Exception as exc:  # ImportError, GeminiFatalError, missing creds
        result.open_error = f"gemini not configured: {exc}"
        return result

    dpi = _vision_dpi()
    cap = _max_pages()
    concurrency = _concurrency()

    # 1) Render pages to PNG synchronously (cheap, and fitz objects aren't async-safe).
    page_pngs: list[tuple[int, bytes]] = []
    with _quiet_mupdf_stderr() as mupdf_buf:
        try:
            doc = fitz.open(path)
        except Exception as exc:
            result.open_error = str(exc)
            result.mupdf_messages = mupdf_buf.getvalue().strip()
            return result

        try:
            n = doc.page_count
            limit = min(n, cap) if cap else n
            if limit < n:
                log.info("gemini-vision: capping %s to %d/%d pages", path.name, limit, n)
            for i in range(limit):
                page_no = i + 1
                try:
                    page_pngs.append((page_no, doc.load_page(i).get_pixmap(dpi=dpi).tobytes("png")))
                except Exception as exc:
                    result.failed_pages.append(page_no)
                    log.debug("render failed for %s p%d: %s", path.name, page_no, exc)
        finally:
            doc.close()
        result.mupdf_messages = mupdf_buf.getvalue().strip()

    # 2) Transcribe. concurrency==1 → sequential sync path; >1 → bounded async pool.
    total_tokens = 0
    if concurrency <= 1:
        interval = _min_interval_s()
        for page_no, png in page_pngs:
            try:
                md, tokens = _transcribe_page(client, png)
            except Exception as exc:
                if _is_auth_error(exc):
                    result.open_error = f"gemini auth error: {exc}"
                    break
                result.failed_pages.append(page_no)
                log.debug("transcribe failed for %s p%d: %s", path.name, page_no, exc)
                continue
            total_tokens += tokens
            text = clean_markdown_text(md, clean=clean)
            if text:
                result.pages.append((page_no, text))
            if interval:
                time.sleep(interval)
    else:
        log.info(
            "gemini-vision: transcribing %d page(s) of %s at concurrency=%d",
            len(page_pngs), path.name, concurrency,
        )
        results, failed, auth_error = asyncio.run(
            _transcribe_all_async(client, page_pngs, concurrency=concurrency)
        )
        result.failed_pages.extend(failed)
        if auth_error is not None:
            result.open_error = f"gemini auth error: {auth_error}"
        for page_no in sorted(results):
            md, tokens = results[page_no]
            total_tokens += tokens
            text = clean_markdown_text(md, clean=clean)
            if text:
                result.pages.append((page_no, text))

    result.tokens = total_tokens
    return result
