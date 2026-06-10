"""Harvest graph layout papers from arXiv API."""

from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET

import httpx

from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.relevance import is_layout_relevant
from graph_layout_rag.manifest import ManifestItem, relative_local_path, slug_id
from graph_layout_rag.paths import PDF_DIR

ARXIV_API = "http://export.arxiv.org/api/query"
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}

SEARCH_QUERIES = [
    "graph drawing",
    "layered graph layout",
    "Sugiyama layout",
    "force-directed layout",
    "graph layout algorithm",
    "crossing minimization graph",
    "orthogonal graph drawing",
    "compound graph layout",
    "stress majorization",
    "dag layout",
    "node link diagram layout",
    "hierarchical graph visualization",
]


def _arxiv_id_from_entry(entry: ET.Element) -> str | None:
    raw_id = entry.findtext("atom:id", default="", namespaces=ATOM_NS)
    m = re.search(r"arxiv\.org/abs/([\w.]+)", raw_id)
    return m.group(1) if m else None


def _search_arxiv(query: str, *, max_results: int = 50) -> list[dict]:
    time.sleep(0.5)  # arXiv rate limit: 1 req / 3s recommended; 0.5 with small batches
    search = f"all:{query} AND (cat:cs.CG OR cat:cs.DS OR cat:cs.GR)"
    params = {
        "search_query": search,
        "start": "0",
        "max_results": str(max_results),
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        res = client.get(ARXIV_API, params=params)
        res.raise_for_status()
        root = ET.fromstring(res.text)

    papers: list[dict] = []
    for entry in root.findall("atom:entry", ATOM_NS):
        arxiv_id = _arxiv_id_from_entry(entry)
        if not arxiv_id:
            continue
        title = (entry.findtext("atom:title", default="", namespaces=ATOM_NS) or "").strip()
        title = re.sub(r"\s+", " ", title)
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


def _paper_to_item(paper: dict) -> ManifestItem:
    doc_id = slug_id(f"arxiv-{paper['arxiv_id']}")
    return ManifestItem(
        id=doc_id,
        title=paper["title"],
        authors=paper["authors"],
        year=paper["year"],
        source="arxiv",
        url=paper["pdf_url"],
        localPath=f"data/raw/pdf/{doc_id}.pdf",
        contentType="application/pdf",
        status="failed",
        tags=["arxiv", "graph-drawing"],
        doi=paper["doi"],
        abstract=paper.get("abstract"),
    )


def _download_arxiv_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    if dry_run:
        return item
    dest = PDF_DIR / f"{item.id}.pdf"
    dl = download_to_file(dest, item.url, dry_run=dry_run)
    if dl.get("ok"):
        item.status = "ok"
        item.sha256 = dl.get("sha256")
        item.localPath = relative_local_path(dest)
    else:
        dest.unlink(missing_ok=True)
        item.status = "metadata_only"
    return item


def harvest_arxiv(
    *,
    max_works: int = 300,
    per_query: int = 40,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
) -> list[ManifestItem]:
    by_id: dict[str, ManifestItem] = {}
    skip_ids = existing_ids or set()

    for query in SEARCH_QUERIES:
        if len(by_id) >= max_works:
            break
        for paper in _search_arxiv(query, max_results=per_query):
            if len(by_id) >= max_works:
                break
            if not is_layout_relevant(paper["title"], paper.get("abstract")):
                continue
            item = _paper_to_item(paper)
            if item.id not in skip_ids:
                by_id.setdefault(item.id, item)

    return parallel_map(
        lambda item: _download_arxiv_item(item, dry_run=dry_run),
        list(by_id.values()),
        workers=workers,
        label="arxiv-download",
    )
