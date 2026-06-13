from __future__ import annotations

import re
import time

import httpx

from graph_layout_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.relevance import is_layout_relevant
from graph_layout_rag.manifest import ManifestItem, relative_local_path, slug_id
from graph_layout_rag.paths import PDF_DIR

DBLP_API = "https://dblp.org/search/publ/api"


def _search_dblp(query: str, max_hits: int = 40) -> list[dict]:
    log = get_logger()
    params = {"q": query, "format": "json", "h": str(max_hits)}
    for attempt in range(4):
        time.sleep(0.5 * (attempt + 1))
        with httpx.Client(timeout=60.0) as client:
            res = client.get(
                DBLP_API,
                params=params,
                headers={"User-Agent": "excalidraw-tf-graph-layout-rag/0.1"},
            )
            if res.status_code == 429:
                wait = 2**attempt * 3
                log.warning("dblp 429 for %r — backing off %ds", query, wait)
                time.sleep(wait)
                continue
            if res.status_code != 200:
                log.warning("dblp HTTP %s for %r", res.status_code, query)
                return []
            hits = res.json().get("result", {}).get("hits", {}).get("hit", [])
            if isinstance(hits, dict):
                return [hits]
            return hits or []
    log.warning("dblp gave up after retries for %r", query)
    return []


def _urls_from_info(info: dict) -> list[str]:
    ee = info.get("ee")
    if isinstance(ee, list):
        return [u for u in ee if isinstance(u, str)]
    if isinstance(ee, str):
        return [ee]
    return []


def _doi_from_urls(urls: list[str]) -> str | None:
    for u in urls:
        if "doi.org/" in u:
            return u.split("doi.org/", 1)[-1].split("?")[0]
    return None


def _hit_to_item(hit: dict) -> ManifestItem:
    info = hit.get("info", hit)
    title = re.sub(r"<[^>]+>", "", str(info.get("title", "untitled")))
    year_str = str(info.get("year", ""))
    year = int(year_str) if year_str.isdigit() else None
    authors_raw = info.get("authors", {}).get("author", [])
    if not isinstance(authors_raw, list):
        authors_raw = [authors_raw]
    authors = [
        a if isinstance(a, str) else a.get("text", "")
        for a in authors_raw
        if a
    ]
    urls = _urls_from_info(info)
    pdf_url = next((u for u in urls if ".pdf" in u.lower()), None)
    doi = _doi_from_urls(urls)
    link = pdf_url or next((u for u in urls if "doi.org" in u), None) or (
        urls[0] if urls else None
    )

    doc_id = slug_id(f"dblp-{title}-{year or 'na'}")
    return ManifestItem(
        id=doc_id,
        title=title,
        authors=[a for a in authors if a],
        year=year,
        source="dblp",
        url=link or f"https://dblp.org/rec/{info.get('key', doc_id)}",
        localPath=f"data/raw/pdf/{doc_id}.pdf",
        contentType="application/pdf",
        status="failed",
        tags=["dblp", "graph-drawing"],
        doi=doi,
    )


def _finalize_dblp_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    if not is_layout_relevant(item.title):
        item.status = "metadata_only"
        return item

    if item.doi:
        extra = [item.url] if item.url and ".pdf" in item.url.lower() else None
        resolved = resolve_doi_with_fallbacks(
            item.doi,
            source="dblp",
            tags=item.tags,
            pdf_urls=extra,
            dry_run=dry_run,
        )
        resolved.id = item.id
        if resolved.status == "ok":
            return resolved
        if resolved.abstract:
            item.abstract = resolved.abstract
            item.title = resolved.title or item.title
            item.authors = resolved.authors or item.authors
            item.status = "metadata_only"
            item.url = resolved.url
            return item

    url = item.url or ""
    if item.localPath and ".pdf" in url.lower():
        dest = PDF_DIR / f"{item.id}.pdf"
        dl = download_to_file(dest, url, dry_run=dry_run)
        if dl.get("ok"):
            item.status = "ok"
            item.sha256 = dl.get("sha256")
            item.localPath = relative_local_path(dest)
            return item
        dest.unlink(missing_ok=True)

    item.status = "metadata_only" if item.doi else "failed"
    return item


def harvest_dblp(
    *,
    max_works: int = 100,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
) -> list[ManifestItem]:
    queries = [
        "graph drawing",
        "graph layout",
        "Graph Drawing GD",
        "Sugiyama",
        "force-directed",
        "layered graph drawing",
        "crossing minimization",
        "orthogonal graph drawing",
        "venue:GD:",
        "Graph Drawing symposium",
        "Graph Drawing Network Visualization",
        "venue:JGAA:",
        "venue:SoCG:",
        "J. Graph Algorithms Appl.",
        "Computational Geometry Theory Appl.",
        "Information Visualization graph layout",
        "IEEE TVCG graph layout",
    ]
    by_id: dict[str, ManifestItem] = {}
    skip_ids = existing_ids or set()

    for q in queries:
        if len(by_id) >= max_works:
            break
        for hit in _search_dblp(q, 40):
            if len(by_id) >= max_works:
                break
            item = _hit_to_item(hit)
            if item.id not in skip_ids:
                by_id.setdefault(item.id, item)

    return parallel_map(
        lambda item: _finalize_dblp_item(item, dry_run=dry_run),
        list(by_id.values()),
        workers=workers,
        label="dblp",
    )
