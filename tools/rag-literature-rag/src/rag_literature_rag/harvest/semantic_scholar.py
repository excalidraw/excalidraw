"""Harvest graph layout papers from Semantic Scholar search API."""

from __future__ import annotations

from rag_literature_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from rag_literature_rag.harvest.download import download_to_file
from rag_literature_rag.harvest.parallel import parallel_map
from rag_literature_rag.harvest.providers import SEMANTIC_SCHOLAR, OutcomeKind
from rag_literature_rag.harvest.relevance import is_layout_relevant
from rag_literature_rag.manifest import ManifestItem, relative_local_path, slug_id
from rag_literature_rag.paths import PDF_DIR

S2_SEARCH = "https://api.semanticscholar.org/graph/v1/paper/search"
USER_AGENT = "excalidraw-tf-rag-literature-rag/0.1"

SEARCH_QUERIES = [
    "layered graph drawing Sugiyama",
    "hierarchical graph layout crossing minimization",
    "force directed graph drawing stress majorization",
    "compound graph layout clustering",
    "orthogonal graph drawing planar",
    "graph layout port constraints",
    "dag layout rank assignment",
    "node link diagram layout algorithm",
    "ELK eclipse layout layered",
    "graph drawing visualization layout",
    "network simplex graph layering",
    "Brandes Köpf coordinate assignment",
    "Purchase aesthetic graph drawing",
    "minimum width graph layering",
    "edge bundling graph visualization",
]


def _search_s2(query: str, limit: int = 50, offset: int = 0) -> list[dict]:
    params = {
        "query": query,
        "limit": str(limit),
        "offset": str(offset),
        "fields": "title,authors,year,externalIds,openAccessPdf,abstract",
    }
    outcome = SEMANTIC_SCHOLAR.request(
        "GET", S2_SEARCH, params=params, headers={"User-Agent": USER_AGENT}, timeout=60.0
    )
    return (outcome.data or {}).get("data") or [] if outcome.kind is OutcomeKind.SUCCESS else []


def _paper_to_item(paper: dict) -> ManifestItem:
    ext = paper.get("externalIds") or {}
    doi = ext.get("DOI")
    title = paper.get("title") or "untitled"
    authors = [a.get("name", "") for a in paper.get("authors") or [] if a.get("name")]
    year = paper.get("year")
    oa = paper.get("openAccessPdf") or {}
    pdf_url = oa.get("url")
    doc_id = slug_id(f"s2-{doi or paper.get('paperId', title)}")

    return ManifestItem(
        id=doc_id,
        title=title,
        authors=authors,
        year=year,
        source="semantic-scholar",
        url=pdf_url or (f"https://doi.org/{doi}" if doi else f"https://www.semanticscholar.org/paper/{paper.get('paperId', '')}"),
        localPath=f"data/raw/pdf/{doc_id}.pdf" if pdf_url else None,
        contentType="application/pdf" if pdf_url else "text/metadata",
        status="metadata_only" if not pdf_url else "failed",
        tags=["semantic-scholar", "graph-drawing"],
        doi=doi,
        abstract=(paper.get("abstract") or "")[:4000] or None,
    )


def _finalize_s2_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    if item.doi and item.status != "ok":
        resolved = resolve_doi_with_fallbacks(
            item.doi,
            source="semantic-scholar",
            tags=item.tags,
            pdf_urls=[item.url] if item.url and ".pdf" in item.url.lower() else None,
            dry_run=dry_run,
        )
        resolved.id = item.id
        if resolved.status == "ok":
            return resolved
        if resolved.abstract and not item.abstract:
            item.abstract = resolved.abstract
        if resolved.title and item.title == "untitled":
            item.title = resolved.title

    url = item.url or ""
    if item.localPath and ".pdf" in url.lower() and not dry_run:
        dest = PDF_DIR / f"{item.id}.pdf"
        dl = download_to_file(dest, url)
        if dl.get("ok"):
            item.status = "ok"
            item.sha256 = dl.get("sha256")
            item.localPath = relative_local_path(dest)
            return item
        dest.unlink(missing_ok=True)

    if item.status == "failed":
        item.status = "metadata_only"
    return item


def harvest_semantic_scholar(
    *,
    max_works: int = 200,
    per_query: int = 40,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
) -> list[ManifestItem]:
    by_id: dict[str, ManifestItem] = {}
    skip_ids = existing_ids or set()

    query_specs = [(query, offset) for query in SEARCH_QUERIES for offset in (0, per_query)]
    searched = parallel_map(
        lambda spec: _search_s2(spec[0], per_query, offset=spec[1]),
        query_specs,
        workers=min(workers or 32, len(query_specs)),
        label="semantic-scholar-search",
    )
    for papers in searched:
        if len(by_id) >= max_works:
            break
        for paper in papers:
            if len(by_id) >= max_works:
                break
            title = paper.get("title") or ""
            abstract = paper.get("abstract")
            if not is_layout_relevant(title, abstract):
                continue
            item = _paper_to_item(paper)
            if item.id not in skip_ids:
                by_id.setdefault(item.id, item)

    return parallel_map(
        lambda item: _finalize_s2_item(item, dry_run=dry_run),
        list(by_id.values()),
        workers=workers,
        label="semantic-scholar",
    )
