from __future__ import annotations

from functools import lru_cache
from typing import Any

import lancedb

from graph_layout_rag.catalog.classify import build_catalog
from graph_layout_rag.catalog.taxonomy import PIPELINE_CATEGORIES
from graph_layout_rag.ingest.embed import ENV_PREFIX, embed_config_from_env, embed_query
from graph_layout_rag.ingest.index import (
    _table_names,
    embed_config_from_state,
    load_ingest_state,
)
from graph_layout_rag.manifest import load_manifest
from graph_layout_rag.paths import CHUNKS_TABLE, profile_index_paths


@lru_cache(maxsize=1)
def _catalog_maps() -> tuple[dict[str, frozenset[str]], frozenset[str]]:
    """doc_id -> pipeline categories; set of doc_ids with local PDFs."""
    entries = build_catalog(status="ok")
    by_doc: dict[str, frozenset[str]] = {}
    pdf_ids: set[str] = set()
    for entry in entries:
        if entry.has_pdf:
            pdf_ids.add(entry.doc_id)
        if entry.categories:
            by_doc[entry.doc_id] = frozenset(entry.categories)
    return by_doc, frozenset(pdf_ids)


@lru_cache(maxsize=1)
def _manifest_pdf_ids() -> frozenset[str]:
    return frozenset(
        item.id
        for item in load_manifest().items
        if item.status == "ok" and item.localPath
    )


def search(
    query: str,
    *,
    top: int = 8,
    tag: str | None = None,
    source: str | None = None,
    year_min: int | None = None,
    category: str | None = None,
    pdf_only: bool = False,
    embed_profile: str | None = None,
) -> list[dict[str, Any]]:
    if category and category not in PIPELINE_CATEGORIES:
        raise ValueError(
            f"Unknown category {category!r}. Choose from: {', '.join(PIPELINE_CATEGORIES)}"
        )

    paths = profile_index_paths(embed_profile)
    if not paths.lance_dir.is_dir():
        raise ValueError(
            f"No index for profile {paths.profile!r} at {paths.root}. "
            f"Run: graph-layout-rag ingest --embed-profile {paths.profile}"
        )

    db = lancedb.connect(str(paths.lance_dir))
    if CHUNKS_TABLE not in _table_names(db):
        raise ValueError(
            f"No chunks table for profile {paths.profile!r}. "
            f"Run: graph-layout-rag ingest --embed-profile {paths.profile}"
        )

    state = load_ingest_state(paths)
    indexed = embed_config_from_state(state)
    if embed_profile:
        config = embed_config_from_env(profile=embed_profile)
        if indexed is not None:
            from graph_layout_rag.ingest.index import ensure_embed_config_matches

            ensure_embed_config_matches(state, config)
    else:
        config = indexed if indexed is not None else embed_config_from_env()

    table = db.open_table(CHUNKS_TABLE)
    vector = embed_query(
        query,
        config=config,
        prefix=ENV_PREFIX,
        allow_fallback=False,
    )

    fetch_limit = top * (12 if category or pdf_only else 4)
    results = (
        table.search(vector)
        .metric("cosine")
        .limit(fetch_limit)
        .to_list()
    )

    category_map, catalog_pdf_ids = _catalog_maps()
    manifest_pdf_ids = _manifest_pdf_ids()

    filtered: list[dict[str, Any]] = []
    for row in results:
        doc_id = row.get("doc_id") or ""

        if pdf_only and doc_id not in manifest_pdf_ids and doc_id not in catalog_pdf_ids:
            continue

        if category:
            row_cats = {
                c.strip()
                for c in (row.get("pipeline_categories") or "").split(",")
                if c.strip()
            }
            if not row_cats:
                row_cats = set(category_map.get(doc_id, ()))
            if category not in row_cats:
                continue

        if tag and tag not in (row.get("tags") or "").split(","):
            continue
        if source and source not in (row.get("source_url") or ""):
            if source not in (row.get("tags") or ""):
                doc_tags = row.get("tags") or ""
                if source not in doc_tags:
                    continue
        year = row.get("year")
        if year_min is not None and year is not None and year < year_min:
            continue

        text = row.get("text") or ""
        excerpt = text[:400] + ("..." if len(text) > 400 else "")
        distance = row.get("_distance")
        score = 1.0 - distance if distance is not None else 0.0

        pipeline_categories = [
            c.strip()
            for c in (row.get("pipeline_categories") or "").split(",")
            if c.strip()
        ]
        if not pipeline_categories and doc_id in category_map:
            pipeline_categories = sorted(category_map[doc_id])

        filtered.append(
            {
                "score": round(score, 4),
                "title": row.get("title"),
                "excerpt": excerpt,
                "source_url": row.get("source_url"),
                "page": row.get("page"),
                "tags": [t for t in (row.get("tags") or "").split(",") if t],
                "pipeline_categories": pipeline_categories,
                "doc_id": doc_id,
            }
        )
        if len(filtered) >= top:
            break

    return filtered
