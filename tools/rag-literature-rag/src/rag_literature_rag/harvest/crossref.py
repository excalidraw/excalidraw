"""Crossref venue/ISSN-targeted harvest for core RAG literature venues."""

from __future__ import annotations

import re
import time

import httpx

from rag_literature_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from rag_literature_rag.harvest.log import get_logger
from rag_literature_rag.harvest.parallel import parallel_map
from rag_literature_rag.harvest.relevance import is_layout_relevant
from rag_literature_rag.manifest import ManifestItem, slug_id

CROSSREF_API = "https://api.crossref.org/works"
MAILTO = "rag-literature-rag@excalidraw-tf.local"

VENUES: list[dict] = [
    {
        "label": "ACL Anthology",
        "params": {"query.container-title": "Proceedings of the Annual Meeting of the Association for Computational Linguistics"},
        "trusted": False,
        "tags": ["acl", "nlp"],
    },
    {
        "label": "EMNLP",
        "params": {"query.container-title": "Conference on Empirical Methods in Natural Language Processing"},
        "trusted": False,
        "tags": ["emnlp", "nlp"],
    },
    {
        "label": "NAACL",
        "params": {"query.container-title": "North American Chapter of the Association for Computational Linguistics"},
        "trusted": False,
        "tags": ["naacl", "nlp"],
    },
    {
        "label": "SIGIR",
        "params": {"query.container-title": "International ACM SIGIR Conference"},
        "trusted": False,
        "tags": ["sigir", "information-retrieval"],
    },
    {
        "label": "WWW",
        "params": {"query.container-title": "The Web Conference"},
        "trusted": False,
        "tags": ["www", "web"],
    },
    {
        "label": "NeurIPS",
        "params": {"query.container-title": "Advances in Neural Information Processing Systems"},
        "trusted": False,
        "tags": ["neurips", "ml"],
    },
]


def _year(work: dict) -> int | None:
    for key in ("published", "issued", "published-print", "published-online"):
        parts = (work.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and isinstance(parts[0][0], int):
            return parts[0][0]
    return None


def _authors(work: dict) -> list[str]:
    out: list[str] = []
    for a in work.get("author") or []:
        name = " ".join(p for p in (a.get("given"), a.get("family")) if p).strip()
        if name:
            out.append(name)
    return out


def _abstract(work: dict) -> str | None:
    raw = work.get("abstract")
    if not raw:
        return None
    # Crossref abstracts are JATS XML — strip tags.
    return re.sub(r"<[^>]+>", "", raw).strip() or None


def _pdf_link(work: dict) -> str | None:
    for link in work.get("link") or []:
        url = link.get("URL")
        if url and link.get("content-type") == "application/pdf":
            return url
    return None


def _search_crossref(params: dict, *, max_results: int, rows: int = 200) -> list[dict]:
    log = get_logger()
    results: list[dict] = []
    cursor = "*"
    while cursor and len(results) < max_results:
        query = {
            **params,
            "rows": str(min(rows, max_results - len(results))),
            "cursor": cursor,
            "mailto": MAILTO,
        }
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.get(
                    CROSSREF_API,
                    params=query,
                    headers={"User-Agent": f"excalidraw-tf-rag-literature-rag/0.1 (mailto:{MAILTO})"},
                )
            if res.status_code == 429:
                log.warning("crossref 429 — backing off 5s")
                time.sleep(5)
                continue
            if res.status_code != 200:
                log.warning("crossref HTTP %s for %s", res.status_code, params)
                break
            message = res.json().get("message", {})
        except Exception as exc:
            log.warning("crossref request failed for %s: %s", params, exc)
            break
        items = message.get("items") or []
        results.extend(items)
        cursor = message.get("next-cursor")
        if not items:
            break
    return results[:max_results]


def _work_to_spec(work: dict, *, tags: list[str]) -> dict | None:
    doi = (work.get("DOI") or "").lower() or None
    titles = work.get("title") or []
    title = titles[0] if titles else None
    if not title:
        return None
    return {
        "doi": doi,
        "title": re.sub(r"\s+", " ", title).strip(),
        "abstract": _abstract(work),
        "authors": _authors(work),
        "year": _year(work),
        "pdf_link": _pdf_link(work),
        "tags": tags,
    }


def harvest_crossref(
    *,
    max_works: int = 600,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
) -> list[ManifestItem]:
    log = get_logger()
    skip_ids = existing_ids or set()
    by_doi: dict[str, dict] = {}
    per_venue = max(50, max_works // max(1, len(VENUES)))

    for venue in VENUES:
        if len(by_doi) >= max_works:
            break
        works = _search_crossref(venue["params"], max_results=per_venue)
        log.info("crossref %s: %d candidate works", venue["label"], len(works))
        for work in works:
            if len(by_doi) >= max_works:
                break
            spec = _work_to_spec(work, tags=venue["tags"])
            if not spec or not spec["doi"]:
                continue
            if not venue["trusted"] and not is_layout_relevant(
                spec["title"], spec["abstract"], strict=True
            ):
                continue
            doc_id = slug_id(f"crossref-{spec['doi']}")
            if doc_id in skip_ids or spec["doi"] in by_doi:
                continue
            spec["id"] = doc_id
            by_doi[spec["doi"]] = spec

    def _resolve(spec: dict) -> ManifestItem:
        item = resolve_doi_with_fallbacks(
            spec["doi"],
            source="crossref",
            tags=[*spec["tags"], "crossref"],
            pdf_urls=[spec["pdf_link"]] if spec.get("pdf_link") else None,
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

    return parallel_map(_resolve, list(by_doi.values()), workers=workers, label="crossref")
