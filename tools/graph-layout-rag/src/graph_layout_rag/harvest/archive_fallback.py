"""Legal archive / OA repository fallbacks (Wayback CDX, CORE)."""

from __future__ import annotations

import os

from graph_layout_rag.harvest.http_client import get_json
from graph_layout_rag.harvest.providers import CORE, OutcomeKind

CDX_API = "https://web.archive.org/cdx/search/cdx"
CORE_SEARCH = "https://api.core.ac.uk/v3/search/works"


def _publisher_candidate_urls(doi: str) -> list[str]:
    urls: list[str] = [f"https://doi.org/{doi}"]
    if doi.startswith("10.1007/"):
        urls.append(f"https://link.springer.com/content/pdf/{doi}.pdf")
    if doi.startswith(("10.1002/", "10.1111/", "10.1117/")):
        urls.append(f"https://onlinelibrary.wiley.com/doi/pdfdirect/{doi}")
    if doi.startswith("10.1145/"):
        urls.append(f"https://dl.acm.org/doi/pdf/{doi}")
    if doi.startswith("10.1109/"):
        urls.append(
            f"https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber={doi.split('/')[-1]}"
        )
    return urls


def _wayback_pdf_urls(original_url: str, *, limit: int = 3) -> list[str]:
    params = {
        "url": original_url,
        "output": "json",
        "filter": "statuscode:200",
        "limit": str(limit),
        "fl": "timestamp,original,mimetype",
    }
    data = get_json(CDX_API, params=params, timeout=45.0)
    if not data or not isinstance(data, list) or len(data) < 2:
        return []

    urls: list[str] = []
    for row in data[1:]:
        if not isinstance(row, list) or len(row) < 2:
            continue
        timestamp, original = row[0], row[1]
        mimetype = row[2] if len(row) > 2 else ""
        low = (original or "").lower()
        if mimetype == "application/pdf" or low.endswith(".pdf") or "/pdf" in low:
            urls.append(f"https://web.archive.org/web/{timestamp}/{original}")
    return urls


def _core_pdf_urls(doi: str) -> list[str]:
    headers: dict[str, str] = {}
    api_key = os.getenv("CORE_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    outcome = CORE.request(
        "GET",
        CORE_SEARCH,
        params={"q": f'doi:"{doi}"', "limit": "3"},
        headers=headers,
        timeout=45.0,
    )
    if outcome.kind is not OutcomeKind.SUCCESS:
        return []
    data = outcome.data or {}

    urls: list[str] = []
    for hit in data.get("results") or []:
        if hit.get("downloadUrl"):
            urls.append(hit["downloadUrl"])
        for u in hit.get("sourceFulltextUrls") or []:
            if u:
                urls.append(u)
    return urls


def archive_pdf_urls(doi: str, *, publisher_urls: list[str] | None = None) -> list[str]:
    """Tier-4 archive / repository mirrors for a DOI."""
    seeds = list(publisher_urls or []) or _publisher_candidate_urls(doi)
    seen: set[str] = set()
    out: list[str] = []

    def add(url: str) -> None:
        if url and url not in seen:
            seen.add(url)
            out.append(url)

    for url in _core_pdf_urls(doi):
        add(url)

    for seed in seeds:
        for wb in _wayback_pdf_urls(seed):
            add(wb)

    return out
