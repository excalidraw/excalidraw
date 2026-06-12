"""Per-domain adaptive rate limiting for harvest HTTP clients."""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from urllib.parse import urlparse

_domain_gaps: dict[str, float] = {}
_domain_last: dict[str, float] = {}
_domain_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

DEFAULT_GAPS: dict[str, float] = {
    "api.semanticscholar.org": 1.0,
    "api.openalex.org": 0.1,
    "api.unpaywall.org": 0.05,
    "api.core.ac.uk": 0.2,
    "web.archive.org": 0.5,
    "archive.org": 0.5,
    "dblp.org": 0.2,
    "doi.org": 0.1,
    "figshare.com": 0.5,
}
_DEFAULT_GAP = 0.05
_MAX_GAP = 30.0


def domain_from_url(url: str) -> str:
    return urlparse(url).hostname or ""


def gap_for(domain: str) -> float:
    if not domain:
        return _DEFAULT_GAP
    return _domain_gaps.get(domain, DEFAULT_GAPS.get(domain, _DEFAULT_GAP))


def wait_for_domain(domain: str) -> None:
    if not domain:
        return
    lock = _domain_locks[domain]
    with lock:
        gap = gap_for(domain)
        last = _domain_last.get(domain, 0.0)
        wait = max(0.0, gap - (time.time() - last))
        if wait > 0:
            time.sleep(wait)
        _domain_last[domain] = time.time()


def note_rate_limit(domain: str, *, retry_after: int | None = None) -> None:
    """Increase gap after 429; optional Retry-After seconds."""
    if not domain:
        return
    with _domain_locks[domain]:
        current = gap_for(domain)
        bumped = min(_MAX_GAP, max(current * 2, float(retry_after or 1)))
        _domain_gaps[domain] = bumped


def note_success(domain: str) -> None:
    """Decay gap toward default after success."""
    if not domain:
        return
    with _domain_locks[domain]:
        current = gap_for(domain)
        default = DEFAULT_GAPS.get(domain, _DEFAULT_GAP)
        if current > default:
            _domain_gaps[domain] = max(default, current * 0.75)


def parse_retry_after(headers: dict[str, str]) -> int | None:
    raw = headers.get("retry-after") or headers.get("Retry-After")
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None
