from __future__ import annotations

import hashlib
import threading
import time
from pathlib import Path

import httpx

from graph_layout_rag.harvest.ledger import classify_outcome, log_attempt
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.rate_limit import (
    domain_from_url,
    note_rate_limit,
    note_success,
    parse_retry_after,
    wait_for_domain,
)

USER_AGENT = (
    "excalidraw-tf-graph-layout-rag/0.1 "
    "(research; +https://github.com/excalidraw/excalidraw)"
)

DEFAULT_MIN_PDF_BYTES = 10_000
_MAX_RETRIES = 4
_RETRYABLE_STATUSES = {202, 429, 500, 502, 503, 504}
_clients = threading.local()
_download_semaphore: threading.BoundedSemaphore | None = None
_download_limit = 0
_download_lock = threading.Lock()


def set_download_limit(limit: int) -> None:
    """Set the process-wide active PDF download budget."""
    global _download_semaphore, _download_limit
    limit = max(1, limit)
    with _download_lock:
        if limit != _download_limit:
            _download_limit = limit
            _download_semaphore = threading.BoundedSemaphore(limit)


def _client(*, verify: bool, timeout: httpx.Timeout) -> httpx.Client:
    clients = getattr(_clients, "clients", None)
    if clients is None:
        clients = {}
        _clients.clients = clients
    client = clients.get(verify)
    if client is None:
        client = httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            verify=verify,
            limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
        )
        clients[verify] = client
    return client


def close_thread_clients() -> None:
    clients = getattr(_clients, "clients", {})
    for client in clients.values():
        client.close()
    _clients.clients = {}


def _is_valid_pdf(data: bytes, *, min_bytes: int) -> bool:
    return data.startswith(b"%PDF") and len(data) >= min_bytes


def _finish(
    *,
    ok: bool,
    url: str,
    doc_id: str | None,
    doi: str | None,
    attempt: int,
    status: int | None,
    reason: str | None = None,
    error: str | None = None,
    bytes_count: int | None = None,
    retry_after: int | None = None,
    stage: str | None = None,
    **extra,
) -> dict:
    outcome, transient = classify_outcome(
        status=status, ok=ok, reason=reason, error=error
    )
    log_attempt(
        url=url,
        outcome=outcome,
        transient=transient,
        doc_id=doc_id,
        doi=doi,
        attempt=attempt,
        http_status=status,
        bytes_count=bytes_count,
        retry_after=retry_after,
        stage=stage,
    )
    return {
        "ok": ok,
        "outcome": outcome,
        "transient": transient,
        "status": status,
        "sha256": extra.get("sha256"),
        "content_type": extra.get("content_type"),
        "bytes": bytes_count,
        "reason": reason,
        "error": error,
        "retry_after": retry_after,
        **{k: v for k, v in extra.items() if k not in ("sha256", "content_type")},
    }


def fetch_text(url: str, timeout: float = 60.0) -> str:
    domain = domain_from_url(url)
    wait_for_domain(domain)
    client = _client(verify=True, timeout=httpx.Timeout(timeout))
    res = client.get(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    res.raise_for_status()
    return res.text


def download_to_file(
    dest: Path,
    url: str,
    *,
    dry_run: bool = False,
    verify: bool = True,
    min_bytes: int = DEFAULT_MIN_PDF_BYTES,
    require_pdf: bool = True,
    expected_sha256: str | None = None,
    doc_id: str | None = None,
    doi: str | None = None,
    stage: str | None = None,
) -> dict:
    if dry_run:
        return {"ok": False, "dry_run": True, "sha256": None, "content_type": None}

    if _download_semaphore is None:
        set_download_limit(32)
    assert _download_semaphore is not None
    with _download_semaphore:
        return _download_to_file_unbounded(
            dest, url, verify=verify, min_bytes=min_bytes, require_pdf=require_pdf,
            expected_sha256=expected_sha256, doc_id=doc_id, doi=doi, stage=stage,
        )


def _download_to_file_unbounded(
    dest: Path,
    url: str,
    *,
    verify: bool,
    min_bytes: int,
    require_pdf: bool,
    expected_sha256: str | None,
    doc_id: str | None,
    doi: str | None,
    stage: str | None,
) -> dict:
    domain = domain_from_url(url)
    log = get_logger()
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists() and require_pdf:
        existing = dest.read_bytes()
        if _is_valid_pdf(existing, min_bytes=min_bytes):
            sha256 = hashlib.sha256(existing).hexdigest()
            if expected_sha256 is None or sha256 == expected_sha256:
                return _finish(
                    ok=True,
                    url=url,
                    doc_id=doc_id,
                    doi=doi,
                    attempt=0,
                    status=200,
                    bytes_count=len(existing),
                    stage=stage,
                    sha256=sha256,
                    content_type="application/pdf",
                    skipped=True,
                )

    last_status: int | None = None
    last_content_type: str | None = None
    last_retry_after: int | None = None

    # Tight, per-operation timeouts so dead/trickling connections fail fast.
    # A single bare timeout=120 lets slow servers stall a worker for minutes,
    # which (under the concurrent discovery pool) freezes the whole harvest.
    _timeout = httpx.Timeout(connect=15.0, read=30.0, write=30.0, pool=10.0)
    for attempt in range(1, _MAX_RETRIES + 1):
        wait_for_domain(domain)
        try:
            res = _client(verify=verify, timeout=_timeout).get(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/pdf,text/html,*/*",
                },
            )
        except httpx.HTTPError as exc:
            log.debug("download error for %s (attempt %d): %s", url[:120], attempt, exc)
            if attempt < _MAX_RETRIES:
                time.sleep(2 ** (attempt - 1))
                continue
            return _finish(
                ok=False,
                url=url,
                doc_id=doc_id,
                doi=doi,
                attempt=attempt,
                status=None,
                error=str(exc),
                stage=stage,
            )

        last_status = res.status_code
        last_content_type = res.headers.get("content-type")
        last_retry_after = parse_retry_after(dict(res.headers))

        if res.status_code in _RETRYABLE_STATUSES:
            if res.status_code == 429:
                note_rate_limit(domain, retry_after=last_retry_after)
            wait = last_retry_after if last_retry_after else 2 ** (attempt - 1) * (
                3 if res.status_code == 429 else 1
            )
            log.debug(
                "download HTTP %s for %s — retry in %ds (attempt %d)",
                res.status_code,
                url[:120],
                wait,
                attempt,
            )
            if attempt < _MAX_RETRIES:
                time.sleep(wait)
                continue
            return _finish(
                ok=False,
                url=url,
                doc_id=doc_id,
                doi=doi,
                attempt=attempt,
                status=res.status_code,
                retry_after=last_retry_after,
                stage=stage,
                content_type=last_content_type,
            )

        if res.status_code != 200:
            log.debug(
                "download HTTP %s for %s (host=%s)",
                res.status_code,
                url[:120],
                domain,
            )
            return _finish(
                ok=False,
                url=url,
                doc_id=doc_id,
                doi=doi,
                attempt=attempt,
                status=res.status_code,
                stage=stage,
                content_type=last_content_type,
            )

        note_success(domain)
        data = res.content
        if require_pdf and not _is_valid_pdf(data, min_bytes=min_bytes):
            reason = "non-PDF" if not data.startswith(b"%PDF") else f"too small ({len(data)} bytes)"
            log.debug("download %s (%s) from %s", reason, last_content_type, url[:120])
            return _finish(
                ok=False,
                url=url,
                doc_id=doc_id,
                doi=doi,
                attempt=attempt,
                status=res.status_code,
                reason=reason,
                bytes_count=len(data),
                stage=stage,
                content_type=last_content_type,
            )

        sha256 = hashlib.sha256(data).hexdigest()
        dest.write_bytes(data)
        log.debug("download ok %d bytes %s", len(data), url[:120])
        return _finish(
            ok=True,
            url=url,
            doc_id=doc_id,
            doi=doi,
            attempt=attempt,
            status=res.status_code,
            bytes_count=len(data),
            stage=stage,
            sha256=sha256,
            content_type=last_content_type,
        )

    return _finish(
        ok=False,
        url=url,
        doc_id=doc_id,
        doi=doi,
        attempt=_MAX_RETRIES,
        status=last_status,
        retry_after=last_retry_after,
        stage=stage,
        content_type=last_content_type,
    )
