"""HTTP GET with retries for harvest API clients."""

from __future__ import annotations

import time
from typing import Any

import httpx

from graph_layout_rag.harvest.rate_limit import (
    domain_from_url,
    note_rate_limit,
    note_success,
    parse_retry_after,
    wait_for_domain,
)

USER_AGENT = "mailto:graph-layout-rag@excalidraw-tf.local"
_RETRYABLE = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 5


def get_json(
    url: str,
    *,
    params: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 60.0,
) -> dict[str, Any] | None:
    hdrs = {"User-Agent": USER_AGENT, **(headers or {})}
    domain = domain_from_url(url)

    for attempt in range(_MAX_ATTEMPTS):
        wait_for_domain(domain)
        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                res = client.get(url, params=params, headers=hdrs)
        except httpx.HTTPError:
            if attempt < _MAX_ATTEMPTS - 1:
                time.sleep(2**attempt)
                continue
            return None

        if res.status_code == 200:
            note_success(domain)
            try:
                return res.json()
            except Exception:
                return None

        if res.status_code in _RETRYABLE and attempt < _MAX_ATTEMPTS - 1:
            retry_after = parse_retry_after(dict(res.headers))
            if res.status_code == 429:
                note_rate_limit(domain, retry_after=retry_after)
            wait = retry_after if retry_after else 2**attempt * (3 if res.status_code == 429 else 1)
            time.sleep(wait)
            continue

        return None

    return None
