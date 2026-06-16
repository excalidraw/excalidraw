"""Harvest DOI/arXiv links from the awesome-generative-ai-guide RAG research table."""

from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx

from rag_literature_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from rag_literature_rag.harvest.parallel import parallel_map
from rag_literature_rag.manifest import ManifestItem

RAW_URL = (
    "https://raw.githubusercontent.com/aishwaryanr/awesome-generative-ai-guide/"
    "main/research_updates/rag_research_table.md"
)

# Tags in the source table we skip (domain-specific / out of core scope).
SKIP_TAG_PATTERNS = re.compile(
    r"domain[- ]specific|video|multimodal|petroleum|cyber|medical|time series",
    re.I,
)

ARXIV_RE = re.compile(r"arxiv\.org/abs/(\d{4}\.\d{4,5})", re.I)
DOI_RE = re.compile(r"10\.\d{4,9}/[^\s\]|)>\"']+", re.I)


def _fetch_table_markdown() -> str:
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        resp = client.get(RAW_URL, headers={"User-Agent": "rag-literature-rag/0.1"})
        resp.raise_for_status()
        return resp.text


def _parse_rows(md: str) -> list[dict]:
    rows: list[dict] = []
    for line in md.splitlines():
        if not line.startswith("| [") or line.count("|") < 4:
            continue
        parts = [p.strip() for p in line.strip().strip("|").split("|")]
        if len(parts) < 4:
            continue
        title_cell, _desc, tags_cell, _month = parts[0], parts[1], parts[2], parts[3]
        if SKIP_TAG_PATTERNS.search(tags_cell):
            continue
        m = re.search(r"\]\((https?://[^)]+)\)", title_cell)
        if not m:
            continue
        url = m.group(1)
        title = re.sub(r"^\[|\].*$", "", title_cell).strip()
        doi = None
        arxiv_id = None
        if "arxiv.org" in url:
            am = ARXIV_RE.search(url)
            if am:
                arxiv_id = am.group(1)
                doi = f"10.48550/arXiv.{arxiv_id}"
        else:
            dm = DOI_RE.search(url)
            if dm:
                doi = dm.group(0).rstrip(").,;")
        if not doi and not arxiv_id:
            continue
        rows.append({"title": title, "url": url, "doi": doi, "tags": ["awesome-rag-table", tags_cell.lower().replace(" ", "-")]})
    return rows


def harvest_awesome_rag_table(*, dry_run: bool = False, workers: int | None = None, max_items: int = 120) -> list[ManifestItem]:
    try:
        md = _fetch_table_markdown()
    except Exception:
        return []

    specs = _parse_rows(md)[:max_items]
    if dry_run:
        return [
            ManifestItem(
                id=f"awesome-{i}",
                title=s["title"],
                source="awesome-rag-table",
                url=s["url"],
                status="metadata_only",
                tags=s["tags"],
                doi=s.get("doi"),
            )
            for i, s in enumerate(specs)
        ]

    def _resolve(spec: dict) -> ManifestItem:
        if not spec.get("doi"):
            return ManifestItem(
                id=spec["title"][:40].lower().replace(" ", "-"),
                title=spec["title"],
                source="awesome-rag-table",
                url=spec["url"],
                status="metadata_only",
                tags=spec["tags"],
            )
        return resolve_doi_with_fallbacks(
            spec["doi"],
            source="awesome-rag-table",
            tags=spec["tags"],
            dry_run=False,
            include_archive=True,
            include_paywall_guesses=False,
        )

    return parallel_map(_resolve, specs, workers=workers)
