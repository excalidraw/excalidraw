from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Sequence

import lancedb

from graph_layout_rag.catalog.classify import build_catalog
from graph_layout_rag.catalog.taxonomy import PIPELINE_CATEGORIES
from graph_layout_rag.ingest import bm25
from graph_layout_rag.ingest.embed import ENV_PREFIX, EmbedConfig, embed_config_from_env, embed_query
from graph_layout_rag.ingest.index import (
    _table_names,
    embed_config_from_state,
    load_ingest_state,
)
from graph_layout_rag.manifest import load_manifest
from graph_layout_rag.paths import CHUNKS_TABLE, profile_index_paths
from graph_layout_rag.query.hybrid import DENSE_WEIGHT, SPARSE_WEIGHT, merge_rankings, reciprocal_rank_fusion
from graph_layout_rag.query.identity import canonical_identity_map, clear_identity_cache

DEFAULT_HYBRID = True


@lru_cache(maxsize=1)
def catalog_maps() -> tuple[dict[str, frozenset[str]], frozenset[str]]:
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
def manifest_pdf_ids() -> frozenset[str]:
    return frozenset(
        item.id
        for item in load_manifest().items
        if item.status == "ok" and item.localPath
    )


@dataclass(frozen=True)
class RetrieveFilters:
    tag: str | None = None
    source: str | None = None
    year_min: int | None = None
    category: str | None = None
    pdf_only: bool = False


@dataclass(frozen=True)
class RetrieveContext:
    table: Any
    paths: Any
    config: EmbedConfig


_CONTEXT_CACHE: dict[str, RetrieveContext] = {}
_VECTOR_CACHE: dict[tuple[str, int, str], list[float]] = {}


def clear_retrieve_caches() -> None:
    _CONTEXT_CACHE.clear()
    _VECTOR_CACHE.clear()
    clear_identity_cache()


def resolve_retrieve_context(*, embed_profile: str | None = None) -> RetrieveContext:
    slug = profile_index_paths(embed_profile).profile if embed_profile else profile_index_paths().profile
    cached = _CONTEXT_CACHE.get(slug)
    if cached is not None:
        return cached

    if embed_profile is None:
        embed_profile = slug

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

    ctx = RetrieveContext(table=db.open_table(CHUNKS_TABLE), paths=paths, config=config)
    _CONTEXT_CACHE[slug] = ctx
    return ctx


def _dense_where(year_min: int | None) -> str | None:
    if year_min is None:
        return None
    return f"(year >= {int(year_min)}) OR (year IS NULL)"


def _pool_size(*, top: int, filters: RetrieveFilters) -> int:
    selective = bool(
        filters.category or filters.pdf_only or filters.tag or filters.source or filters.year_min
    )
    # Floor of 80 fused candidates: the de-biased bake-off found pool 80 matched
    # or beat the old 40-deep default on both tracks (the deeper fusion pool
    # surfaces more distinct papers before per-doc grouping). Selective filters
    # still widen further since they prune post-fusion.
    return max(80, top * (12 if selective else 4))


def _embed_vector(query: str, *, config: EmbedConfig) -> list[float]:
    key = (config.model, config.dimensions, query)
    cached = _VECTOR_CACHE.get(key)
    if cached is not None:
        return cached
    vector = embed_query(
        query,
        config=config,
        prefix=ENV_PREFIX,
        allow_fallback=False,
        probe=False,
    )
    _VECTOR_CACHE[key] = vector
    return vector


def _dense_search(
    table: Any,
    vector: Sequence[float],
    *,
    pool: int,
    year_min: int | None,
) -> list[dict[str, Any]]:
    dense_search = table.search(list(vector)).metric("cosine")
    where = _dense_where(year_min)
    if where:
        dense_search = dense_search.where(where, prefilter=True)
    dense_results = dense_search.limit(pool).to_list()
    for row in dense_results:
        row.pop("vector", None)
        distance = row.get("_distance")
        row["score"] = round(1.0 - distance, 6) if distance is not None else 0.0
    return dense_results


def _apply_filters(
    candidates: list[dict[str, Any]],
    filters: RetrieveFilters,
) -> list[dict[str, Any]]:
    if filters.category and filters.category not in PIPELINE_CATEGORIES:
        raise ValueError(
            f"Unknown category {filters.category!r}. Choose from: {', '.join(PIPELINE_CATEGORIES)}"
        )

    category_map, catalog_pdf_ids = catalog_maps()
    manifest_ids = manifest_pdf_ids()
    filtered: list[dict[str, Any]] = []

    for row in candidates:
        doc_id = row.get("doc_id") or ""

        if filters.pdf_only and doc_id not in manifest_ids and doc_id not in catalog_pdf_ids:
            continue

        if filters.category:
            row_cats = {
                c.strip()
                for c in (row.get("pipeline_categories") or "").split(",")
                if c.strip()
            }
            if not row_cats:
                row_cats = set(category_map.get(doc_id, ()))
            if filters.category not in row_cats:
                continue

        if filters.tag and filters.tag not in (row.get("tags") or "").split(","):
            continue
        if filters.source and filters.source not in (row.get("source_url") or ""):
            if filters.source not in (row.get("tags") or ""):
                doc_tags = row.get("tags") or ""
                if filters.source not in doc_tags:
                    continue
        year = row.get("year")
        if filters.year_min is not None and year is not None and year < filters.year_min:
            continue

        filtered.append(row)

    return filtered


def retrieve_candidates(
    query: str,
    *,
    top: int = 20,
    embed_profile: str | None = None,
    hybrid: bool = DEFAULT_HYBRID,
    sparse_only: bool = False,
    filters: RetrieveFilters | None = None,
    pool: int | None = None,
    context: RetrieveContext | None = None,
    vector: Sequence[float] | None = None,
    bm25_query: str | None = None,
    rrf_k: int = 20,
    dense_weight: float = DENSE_WEIGHT,
    sparse_weight: float = SPARSE_WEIGHT,
) -> list[dict[str, Any]]:
    """Retrieve ranked chunk rows before reranking or JSON formatting."""
    filters = filters or RetrieveFilters()
    ctx = context or resolve_retrieve_context(embed_profile=embed_profile)
    pool = pool or _pool_size(top=top, filters=filters)

    sparse_query = bm25_query if bm25_query is not None else query
    if sparse_only:
        sparse_results = bm25.search_bm25(
            sparse_query,
            index_dir=ctx.paths.bm25_dir,
            limit=pool,
        )
        return _apply_filters(sparse_results, filters)

    query_vector = list(vector) if vector is not None else _embed_vector(query, config=ctx.config)
    dense_results = _dense_search(
        ctx.table,
        query_vector,
        pool=pool,
        year_min=filters.year_min,
    )

    if hybrid:
        sparse_results = bm25.search_bm25(
            sparse_query,
            index_dir=ctx.paths.bm25_dir,
            limit=pool,
        )
        candidates = reciprocal_rank_fusion(
            dense_results,
            sparse_results,
            top=pool,
            rrf_k=rrf_k,
            dense_weight=dense_weight,
            sparse_weight=sparse_weight,
        )
    else:
        candidates = dense_results

    return _apply_filters(candidates, filters)


def retrieve_multi_query(
    queries: Sequence[str],
    *,
    top: int = 20,
    embed_profile: str | None = None,
    hybrid: bool = DEFAULT_HYBRID,
    filters: RetrieveFilters | None = None,
    pool: int | None = None,
    context: RetrieveContext | None = None,
) -> list[dict[str, Any]]:
    """Retrieve for multiple query strings and fuse rankings with RRF."""
    if not queries:
        return []

    filters = filters or RetrieveFilters()
    ctx = context or resolve_retrieve_context(embed_profile=embed_profile)
    pool = pool or _pool_size(top=top, filters=filters)

    per_query: list[list[dict[str, Any]]] = []
    for query in queries:
        vector = _embed_vector(query, config=ctx.config)
        dense = _dense_search(ctx.table, vector, pool=pool, year_min=filters.year_min)
        if hybrid:
            sparse = bm25.search_bm25(query, index_dir=ctx.paths.bm25_dir, limit=pool)
            per_query.append(reciprocal_rank_fusion(dense, sparse, top=pool))
        else:
            per_query.append(dense)

    candidates = merge_rankings(*per_query, top=pool) if len(per_query) > 1 else per_query[0]

    return _apply_filters(candidates, filters)


def diversify_candidates(
    candidates: list[dict[str, Any]],
    *,
    max_per_doc: int = 5,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    identities = canonical_identity_map()
    counts: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    for row in candidates:
        canonical_doc_id = identities.canonical_doc_id(row)
        if counts.get(canonical_doc_id, 0) >= max_per_doc:
            continue
        counts[canonical_doc_id] = counts.get(canonical_doc_id, 0) + 1
        out.append(row)
        if limit is not None and len(out) >= limit:
            break
    return out
