"""Bulk arXiv harvest by category (deep pagination of cs.CG).

Keyword search (`arxiv.py`) caps out and misses papers. This paginates an entire
category — cs.CG (Computational Geometry), dense with planarity/drawing/layout
work — then strict-gates to graph drawing. Uses the arXiv API (Atom) with deep
`start=` paging, which is more reliable than OAI-PMH subcategory sets.
"""

from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET

import httpx

from graph_layout_rag.harvest.arxiv import (
    ARXIV_API,
    ATOM_NS,
    _arxiv_id_from_entry,
    _download_arxiv_item,
    _paper_to_item,
)
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.relevance import is_layout_relevant
from graph_layout_rag.manifest import ManifestItem

PAGE_SIZE = 100
PAGE_DELAY_S = 3.0  # arXiv API: ~1 req / 3s recommended


def _parse_entries(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    papers: list[dict] = []
    for entry in root.findall("atom:entry", ATOM_NS):
        arxiv_id = _arxiv_id_from_entry(entry)
        if not arxiv_id:
            continue
        title = re.sub(r"\s+", " ", (entry.findtext("atom:title", default="", namespaces=ATOM_NS) or "").strip())
        abstract = (entry.findtext("atom:summary", default="", namespaces=ATOM_NS) or "").strip()
        authors = [
            a.findtext("atom:name", default="", namespaces=ATOM_NS)
            for a in entry.findall("atom:author", ATOM_NS)
        ]
        published = entry.findtext("atom:published", default="", namespaces=ATOM_NS)
        year = int(published[:4]) if published and len(published) >= 4 else None
        papers.append(
            {
                "arxiv_id": arxiv_id,
                "title": title,
                "abstract": abstract[:4000],
                "authors": [a for a in authors if a],
                "year": year,
                "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}.pdf",
                "doi": f"10.48550/arXiv.{arxiv_id}",
            }
        )
    return papers


def _iter_category(category: str, *, max_pages: int):
    """Yield pages of parsed entries for an arXiv category."""
    log = get_logger()
    for page in range(max_pages):
        params = {
            "search_query": f"cat:{category}",
            "start": str(page * PAGE_SIZE),
            "max_results": str(PAGE_SIZE),
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        }
        try:
            time.sleep(PAGE_DELAY_S)
            with httpx.Client(timeout=120.0, follow_redirects=True) as client:
                res = client.get(ARXIV_API, params=params)
                res.raise_for_status()
            entries = _parse_entries(res.text)
        except Exception as exc:
            log.warning("arxiv-bulk %s page %d failed: %s", category, page, exc)
            break
        if not entries:
            break
        yield entries


def harvest_arxiv_category(
    *,
    categories: tuple[str, ...] = ("cs.CG",),
    max_works: int = 800,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
) -> list[ManifestItem]:
    log = get_logger()
    skip_ids = existing_ids or set()
    by_id: dict[str, ManifestItem] = {}
    # Cap pages so we don't crawl the whole category forever; enough to surface
    # the strict-relevant subset.
    max_pages = max(5, (max_works * 6) // PAGE_SIZE)

    for category in categories:
        for entries in _iter_category(category, max_pages=max_pages):
            for paper in entries:
                if len(by_id) >= max_works:
                    break
                if not is_layout_relevant(paper["title"], paper.get("abstract"), strict=True):
                    continue
                item = _paper_to_item(paper)
                if item.id not in skip_ids:
                    by_id.setdefault(item.id, item)
            if len(by_id) >= max_works:
                break

    log.info("arxiv-bulk %s: %d strict-relevant items", ",".join(categories), len(by_id))
    return parallel_map(
        lambda item: _download_arxiv_item(item, dry_run=dry_run),
        list(by_id.values()),
        workers=workers,
        label="arxiv-bulk-download",
    )
