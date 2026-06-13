"""Crossref venue/ISSN-targeted harvest.

Unlike keyword search (OpenAlex/S2), Crossref lets us pull *everything published
in a venue* — near-100% precision for graph-drawing. We target:

- Graph Drawing symposium (LNCS GD series) via container-title
- Journal of Graph Algorithms and Applications (JGAA) via ISSN — fully OA
- Computational Geometry: Theory and Applications (CGTA) via ISSN
- Visualization venues (IEEE TVCG, CGF/EuroVis, InfoVis, PacificVis) — layout and
  node-overlap-removal work that never reaches the GD series
- VLSI CAD venues (IEEE TCAD, DAC, ICCAD, ISPD) — one/two-dimensional compaction and
  floorplan packing theory, the thinnest categories in the corpus

ISSN-filtered venues are trusted (every paper is on-topic, so the relevance gate
is skipped); the container-title query applies the strict relevance gate to drop
false matches. PDF download + OA fallback + metadata enrichment reuse
``resolve_doi_with_fallbacks``; any full-text link Crossref reports is passed as a
priority candidate.
"""

from __future__ import annotations

import re
import time

import httpx

from graph_layout_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.relevance import is_layout_relevant
from graph_layout_rag.manifest import ManifestItem, slug_id

CROSSREF_API = "https://api.crossref.org/works"
MAILTO = "graph-layout-rag@excalidraw-tf.local"

# Each venue: a Crossref filter/query. ``trusted`` venues skip the relevance gate
# because every item is on-topic by construction (ISSN-scoped).
VENUES: list[dict] = [
    {
        "label": "JGAA",
        "params": {"filter": "issn:1526-1719"},
        "trusted": True,
        "tags": ["jgaa", "graph-drawing"],
    },
    {
        "label": "Computational Geometry (CGTA)",
        "params": {"filter": "issn:0925-7721"},
        "trusted": True,
        "tags": ["computational-geometry", "graph-drawing"],
    },
    {
        "label": "Graph Drawing symposium",
        "params": {"query.container-title": "Graph Drawing"},
        "trusted": False,
        "tags": ["graph-drawing", "gd"],
    },
    {
        "label": "GD & Network Visualization (LIPIcs)",
        "params": {"query.container-title": "Graph Drawing and Network Visualization"},
        "trusted": True,
        "tags": ["graph-drawing", "gd", "lipics"],
    },
    {
        "label": "SoCG (LIPIcs)",
        "params": {"query.container-title": "Symposium on Computational Geometry"},
        "trusted": False,
        "tags": ["computational-geometry", "socg", "lipics"],
    },
    # --- Visualization venues (layout + overlap removal live here, not in GD) ---
    # Broad journals: gate strictly so non-layout volume (rendering, VR, perception)
    # is dropped by the relevance filter.
    {
        "label": "IEEE TVCG",
        "params": {"filter": "issn:1077-2626"},
        "trusted": False,
        "tags": ["tvcg", "visualization"],
    },
    {
        "label": "Computer Graphics Forum (EuroVis)",
        "params": {"filter": "issn:0167-7055"},
        "trusted": False,
        "tags": ["cgf", "eurovis", "visualization"],
    },
    {
        "label": "Information Visualization (SAGE)",
        "params": {"query.container-title": "Information Visualization"},
        "trusted": False,
        "tags": ["infovis", "visualization"],
    },
    {
        "label": "IEEE Pacific Visualization (PacificVis)",
        "params": {"query.container-title": "Pacific Visualization"},
        "trusted": False,
        "tags": ["pacificvis", "visualization"],
    },
    # --- VLSI CAD venues (one/two-dimensional compaction + floorplan packing) ---
    {
        "label": "IEEE TCAD",
        "params": {"filter": "issn:0278-0070"},
        "trusted": False,
        "tags": ["tcad", "vlsi", "compaction"],
    },
    {
        "label": "Design Automation Conference (DAC)",
        "params": {"query.container-title": "Design Automation Conference"},
        "trusted": False,
        "tags": ["dac", "vlsi"],
    },
    {
        "label": "Int'l Conference on Computer-Aided Design (ICCAD)",
        "params": {"query.container-title": "Computer-Aided Design"},
        "trusted": False,
        "tags": ["iccad", "vlsi"],
    },
    {
        "label": "Int'l Symposium on Physical Design (ISPD)",
        "params": {"query.container-title": "Physical Design"},
        "trusted": False,
        "tags": ["ispd", "vlsi", "placement"],
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
                    headers={"User-Agent": f"excalidraw-tf-graph-layout-rag/0.1 (mailto:{MAILTO})"},
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
