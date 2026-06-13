"""Backfill missing metadata on existing manifest items.

Discovery sources that lack abstracts (notably DBLP, paywalled Crossref venue
items, and many ``failed`` / ``metadata_only`` stubs) leave ``abstract=None``.
A title-only item barely embeds, so it is near-useless for retrieval. This pass
re-queries, by DOI, a chain of providers for items that have a DOI but no
abstract and fills in the first one found. It downloads no PDFs.

Provider chain (stop at first hit): OpenAlex → Crossref → Semantic Scholar.
OpenAlex alone misses most closed-access publisher content; Crossref (JATS) and
S2 cover much of the remainder.

CLI: ``graph-layout-rag harvest enrich [--dry-run] [--workers N]``.
"""

from __future__ import annotations

import httpx

from graph_layout_rag.harvest.crossref import _abstract as _crossref_abstract
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.openalex import (
    OPENALEX_API,
    _abstract_from_inverted_index,
    _fetch_by_doi,
)
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.rate_limit import (
    domain_from_url,
    note_rate_limit,
    note_success,
    wait_for_domain,
)
from graph_layout_rag.manifest import Manifest, ManifestItem

_OPENALEX_DOMAIN = domain_from_url(OPENALEX_API)
_CROSSREF_API = "https://api.crossref.org/works"
_CROSSREF_DOMAIN = domain_from_url(_CROSSREF_API)
_S2_API = "https://api.semanticscholar.org/graph/v1/paper"
_S2_DOMAIN = domain_from_url(_S2_API)
_MAILTO = "graph-layout-rag@excalidraw-tf.local"
_UA = f"excalidraw-tf-graph-layout-rag/0.1 (mailto:{_MAILTO})"


def _needs_abstract(item: ManifestItem) -> bool:
    return bool(item.doi) and not (item.abstract and item.abstract.strip())


def _clean(text: str | None) -> str | None:
    if not text:
        return None
    text = text.strip()
    return text[:4000] if text else None


def _from_openalex(doi: str) -> str | None:
    wait_for_domain(_OPENALEX_DOMAIN)
    try:
        work = _fetch_by_doi(doi)
    except Exception:
        return None
    note_success(_OPENALEX_DOMAIN)
    if not work:
        return None
    return _clean(_abstract_from_inverted_index(work.get("abstract_inverted_index")))


def _from_crossref(doi: str) -> str | None:
    wait_for_domain(_CROSSREF_DOMAIN)
    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.get(
                f"{_CROSSREF_API}/{doi}",
                params={"mailto": _MAILTO},
                headers={"User-Agent": _UA},
            )
        if res.status_code == 429:
            note_rate_limit(_CROSSREF_DOMAIN)
            return None
        if res.status_code != 200:
            return None
        message = res.json().get("message", {})
    except Exception:
        return None
    note_success(_CROSSREF_DOMAIN)
    return _clean(_crossref_abstract(message))


def _from_semantic_scholar(doi: str) -> str | None:
    wait_for_domain(_S2_DOMAIN)
    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.get(
                f"{_S2_API}/DOI:{doi}",
                params={"fields": "abstract"},
                headers={"User-Agent": _UA},
            )
        if res.status_code == 429:
            note_rate_limit(_S2_DOMAIN)
            return None
        if res.status_code != 200:
            return None
        data = res.json()
    except Exception:
        return None
    note_success(_S2_DOMAIN)
    return _clean(data.get("abstract"))


def _fetch_abstract(doi: str) -> str | None:
    """First abstract found for a DOI across OpenAlex → Crossref → S2."""
    for provider in (_from_openalex, _from_crossref, _from_semantic_scholar):
        abstract = provider(doi)
        if abstract:
            return abstract
    return None


def enrich_manifest(
    manifest: Manifest,
    *,
    workers: int | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """Fill missing abstracts on items that have a DOI.

    Mutates ``manifest.items`` in place (unless ``dry_run``). Returns counts
    ``{scanned, candidates, enriched, skipped}``. Caller is responsible for
    ``save_manifest`` afterwards.
    """
    log = get_logger()
    candidates = [i for i in manifest.items if _needs_abstract(i)]
    log.info(
        "enrich: %d/%d items have a DOI but no abstract",
        len(candidates),
        len(manifest.items),
    )

    if not candidates:
        return {"scanned": len(manifest.items), "candidates": 0, "enriched": 0, "skipped": 0}

    abstracts = parallel_map(
        lambda item: _fetch_abstract(item.doi or ""),
        candidates,
        workers=workers,
        label="enrich",
    )

    enriched = 0
    for item, abstract in zip(candidates, abstracts):
        if abstract and abstract.strip():
            if not dry_run:
                item.abstract = abstract
            enriched += 1

    log.info(
        "enrich: %s %d abstracts (of %d candidates)",
        "would fill" if dry_run else "filled",
        enriched,
        len(candidates),
    )
    return {
        "scanned": len(manifest.items),
        "candidates": len(candidates),
        "enriched": enriched,
        "skipped": len(candidates) - enriched,
    }
