"""Forward-citation expansion.

`bibliography.py` walks *backward* (papers our seeds cite). This walks *forward*:
papers that **cite** our high-signal seeds — capturing newer work that builds on
canonical RAG / retrieval methods. Citing a RAG literature paper is itself a
strong relevance signal, so yield is high-precision.
"""

from __future__ import annotations

from rag_literature_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from rag_literature_rag.harvest.log import get_logger
from rag_literature_rag.harvest.openalex import (
    OPENALEX_API,
    _abstract_from_inverted_index,
    _fetch_by_doi,
)
from rag_literature_rag.harvest.parallel import parallel_map
from rag_literature_rag.harvest.providers import OPENALEX, OutcomeKind
from rag_literature_rag.harvest.relevance import is_layout_relevant
from rag_literature_rag.manifest import ManifestItem, load_manifest, slug_id

# Foundational sources whose forward citations are worth chasing.
SEED_SOURCES = frozenset(
    {
        "topic-seed",
        "survey-seed",
        "awesome-rag-table",
        "curated",
        "crossref",
        "openalex",
    }
)
MAX_SEEDS = 30
USER_AGENT = "mailto:rag-literature-rag@excalidraw-tf.local"


def _seed_dois(max_seeds: int = MAX_SEEDS) -> list[str]:
    manifest = load_manifest()
    dois: list[str] = []
    seen: set[str] = set()
    for item in manifest.items:
        if item.source in SEED_SOURCES and item.doi and item.doi not in seen:
            seen.add(item.doi)
            dois.append(item.doi)
            if len(dois) >= max_seeds:
                break
    return dois


def _openalex_id_from_doi(doi: str) -> str | None:
    work = _fetch_by_doi(doi)
    if not work:
        return None
    raw = work.get("id") or ""
    return raw.rsplit("/", 1)[-1] or None  # https://openalex.org/W123 -> W123


def _search_cites(openalex_id: str, *, max_results: int) -> list[dict]:
    results: list[dict] = []
    cursor: str | None = "*"
    while cursor and len(results) < max_results:
        params = {
            "filter": f"cites:{openalex_id}",
            "per_page": "200",
            "sort": "cited_by_count:desc",
            "cursor": cursor,
        }
        outcome = OPENALEX.request_openalex(
            "GET", OPENALEX_API, operation="list", params=params, timeout=60.0
        )
        if outcome.kind is not OutcomeKind.SUCCESS:
            break
        payload = outcome.data or {}
        page = payload.get("results") or []
        results.extend(page)
        cursor = payload.get("meta", {}).get("next_cursor")
        if not page:
            break
    return results[:max_results]


def harvest_forward_citations(
    *,
    max_works: int = 300,
    max_seeds: int = MAX_SEEDS,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
) -> list[ManifestItem]:
    log = get_logger()
    skip_ids = existing_ids or set()
    seeds = _seed_dois(max_seeds)
    log.info("forward-citation: %d seed DOIs", len(seeds))

    by_doi: dict[str, dict] = {}
    for doi in seeds:
        if len(by_doi) >= max_works:
            break
        oa_id = _openalex_id_from_doi(doi)
        if not oa_id:
            continue
        for work in _search_cites(oa_id, max_results=100):
            if len(by_doi) >= max_works:
                break
            citing_doi = (work.get("doi") or "").replace("https://doi.org/", "") or None
            if not citing_doi or citing_doi in by_doi:
                continue
            title = work.get("display_name") or ""
            abstract = _abstract_from_inverted_index(work.get("abstract_inverted_index"))
            if not is_layout_relevant(title, abstract, strict=True):
                continue
            doc_id = slug_id(f"forward-{citing_doi}")
            if doc_id in skip_ids:
                continue
            by_doi[citing_doi] = {"doi": citing_doi, "id": doc_id, "title": title, "abstract": abstract}

    log.info("forward-citation: %d strict-relevant citing works", len(by_doi))

    def _resolve(spec: dict) -> ManifestItem:
        item = resolve_doi_with_fallbacks(
            spec["doi"],
            source="forward-citation",
            tags=["forward-citation", "rag-literature"],
            dry_run=dry_run,
            include_archive=False,
            include_paywall_guesses=False,
        )
        item.id = spec["id"]
        if not item.abstract and spec.get("abstract"):
            item.abstract = spec["abstract"]
        if not item.title and spec.get("title"):
            item.title = spec["title"]
        item.tags = sorted(set(item.tags))
        return item

    return parallel_map(_resolve, list(by_doi.values()), workers=workers, label="forward-citation")
