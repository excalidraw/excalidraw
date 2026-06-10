from __future__ import annotations

import hashlib
import threading
import time
from collections import defaultdict
from pathlib import Path

import httpx

from graph_layout_rag.harvest.log import get_logger

USER_AGENT = (
    "excalidraw-tf-graph-layout-rag/0.1 "
    "(research; +https://github.com/excalidraw/excalidraw)"
)

DEFAULT_MIN_PDF_BYTES = 10_000
_MAX_RETRIES = 4
_RETRYABLE_STATUSES = {202, 429, 500, 502, 503, 504}

_domain_last: dict[str, float] = {}
_domain_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

# Per-host gaps (seconds). APIs are strict; PDF hosts can run hotter in parallel.
_DOMAIN_MIN_GAP: dict[str, float] = {
    "api.semanticscholar.org": 1.0,
    "api.openalex.org": 0.1,
    "api.unpaywall.org": 0.05,
    "dblp.org": 0.2,
    "doi.org": 0.1,
    "figshare.com": 0.5,
}
_DEFAULT_MIN_GAP = 0.05


def _min_gap_for(domain: str) -> float:
    return _DOMAIN_MIN_GAP.get(domain, _DEFAULT_MIN_GAP)


def _rate_limit(domain: str, min_gap_s: float | None = None) -> None:
    gap = _DEFAULT_MIN_GAP if min_gap_s is None else min_gap_s
    if min_gap_s is None and domain:
        gap = _min_gap_for(domain)
    if not domain:
        return
    lock = _domain_locks[domain]
    with lock:
        last = _domain_last.get(domain, 0.0)
        wait = max(0.0, gap - (time.time() - last))
        if wait > 0:
            time.sleep(wait)
        _domain_last[domain] = time.time()


def _is_valid_pdf(data: bytes, *, min_bytes: int) -> bool:
    return data.startswith(b"%PDF") and len(data) >= min_bytes


def fetch_text(url: str, timeout: float = 60.0) -> str:
    from urllib.parse import urlparse

    domain = urlparse(url).hostname or ""
    _rate_limit(domain)
    with httpx.Client(follow_redirects=True, timeout=timeout) as client:
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
) -> dict:
    if dry_run:
        return {"ok": False, "dry_run": True, "sha256": None, "content_type": None}

    from urllib.parse import urlparse

    domain = urlparse(url).hostname or ""
    log = get_logger()
    dest.parent.mkdir(parents=True, exist_ok=True)

    last_status: int | None = None
    last_content_type: str | None = None

    for attempt in range(_MAX_RETRIES):
        _rate_limit(domain)
        try:
            with httpx.Client(follow_redirects=True, timeout=120.0, verify=verify) as client:
                res = client.get(
                    url,
                    headers={
                        "User-Agent": USER_AGENT,
                        "Accept": "application/pdf,text/html,*/*",
                    },
                )
        except httpx.HTTPError as exc:
            log.debug("download error for %s (attempt %d): %s", url[:120], attempt + 1, exc)
            if attempt < _MAX_RETRIES - 1:
                time.sleep(2**attempt)
                continue
            return {
                "ok": False,
                "status": None,
                "sha256": None,
                "content_type": None,
                "error": str(exc),
            }

        last_status = res.status_code
        last_content_type = res.headers.get("content-type")

        if res.status_code in _RETRYABLE_STATUSES:
            wait = 2**attempt * (3 if res.status_code == 429 else 1)
            log.debug(
                "download HTTP %s for %s — retry in %ds (attempt %d)",
                res.status_code,
                url[:120],
                wait,
                attempt + 1,
            )
            if attempt < _MAX_RETRIES - 1:
                time.sleep(wait)
                continue
            return {
                "ok": False,
                "status": res.status_code,
                "sha256": None,
                "content_type": last_content_type,
            }

        if res.status_code != 200:
            log.debug(
                "download HTTP %s for %s (host=%s)",
                res.status_code,
                url[:120],
                domain,
            )
            return {
                "ok": False,
                "status": res.status_code,
                "sha256": None,
                "content_type": last_content_type,
            }

        data = res.content
        if require_pdf and not _is_valid_pdf(data, min_bytes=min_bytes):
            reason = "non-PDF" if not data.startswith(b"%PDF") else f"too small ({len(data)} bytes)"
            log.debug(
                "download %s (%s) from %s",
                reason,
                last_content_type,
                url[:120],
            )
            return {
                "ok": False,
                "status": res.status_code,
                "sha256": None,
                "content_type": last_content_type,
                "bytes": len(data),
                "reason": reason,
            }

        sha256 = hashlib.sha256(data).hexdigest()
        dest.write_bytes(data)
        log.debug("download ok %d bytes %s", len(data), url[:120])
        return {
            "ok": True,
            "sha256": sha256,
            "content_type": last_content_type,
            "bytes": len(data),
        }

    return {
        "ok": False,
        "status": last_status,
        "sha256": None,
        "content_type": last_content_type,
    }
