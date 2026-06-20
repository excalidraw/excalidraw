from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import math
from typing import Any, Sequence

import lancedb

from rag_literature_rag.catalog.classify import build_catalog
from rag_literature_rag.catalog.taxonomy import PIPELINE_CATEGORIES
from rag_literature_rag.ingest import bm25
from rag_literature_rag.ingest.embed import ENV_PREFIX, EmbedConfig, embed_config_from_env, embed_query
from rag_literature_rag.ingest.index import (
    _table_names,
    embed_config_from_state,
    load_ingest_state,
)
from rag_literature_rag.manifest import load_manifest
from rag_literature_rag.paths import CHUNKS_TABLE, PARENTS_TABLE, SUMMARIES_TABLE, profile_index_paths
from rag_literature_rag.query.hybrid import merge_rankings, reciprocal_rank_fusion
from rag_literature_rag.query.identity import canonical_identity_map, clear_identity_cache

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
    parent_table: Any | None
    summary_table: Any | None
    paths: Any
    config: EmbedConfig


_CONTEXT_CACHE: dict[str, RetrieveContext] = {}
_VECTOR_CACHE: dict[tuple[str, int, str], list[float]] = {}
_PARENT_ROW_CACHE: dict[str, dict[str, dict[str, Any]]] = {}
_SUMMARY_ROW_CACHE: dict[str, dict[str, dict[str, Any]]] = {}


def clear_retrieve_caches() -> None:
    _CONTEXT_CACHE.clear()
    _VECTOR_CACHE.clear()
    _PARENT_ROW_CACHE.clear()
    _SUMMARY_ROW_CACHE.clear()
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
            f"Run: rag-literature-rag ingest --embed-profile {paths.profile}"
        )

    db = lancedb.connect(str(paths.lance_dir))
    if CHUNKS_TABLE not in _table_names(db):
        raise ValueError(
            f"No chunks table for profile {paths.profile!r}. "
            f"Run: rag-literature-rag ingest --embed-profile {paths.profile}"
        )

    state = load_ingest_state(paths)
    indexed = embed_config_from_state(state)
    if embed_profile:
        config = embed_config_from_env(profile=embed_profile)
        if indexed is not None:
            from rag_literature_rag.ingest.index import ensure_embed_config_matches

            ensure_embed_config_matches(state, config)
    else:
        config = indexed if indexed is not None else embed_config_from_env()

    tables = _table_names(db)
    parent_table = db.open_table(PARENTS_TABLE) if PARENTS_TABLE in tables else None
    summary_table = db.open_table(SUMMARIES_TABLE) if SUMMARIES_TABLE in tables else None
    ctx = RetrieveContext(
        table=db.open_table(CHUNKS_TABLE),
        parent_table=parent_table,
        summary_table=summary_table,
        paths=paths,
        config=config,
    )
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


def _require_parent_indexes(ctx: RetrieveContext) -> None:
    parent_bm25 = ctx.paths.bm25_parent_dir or (ctx.paths.root / "bm25_parent")
    if ctx.parent_table is None or not parent_bm25.exists() or not (parent_bm25 / "meta.json").exists():
        profile_hint = (
            ctx.paths.profile
            if "small2big-dual" in ctx.paths.profile
            else "cuda-qwen0.6b-small2big-dual-v1"
        )
        raise ValueError(
            f"Profile {ctx.paths.profile!r} does not have parent indexes. "
            "Rebuild the dual small-to-big profile: "
            f"rag-literature-rag ingest --embed-profile {profile_hint} --force --rebuild"
        )


def _require_summary_indexes(ctx: RetrieveContext) -> None:
    summary_bm25 = ctx.paths.bm25_summary_dir or (ctx.paths.root / "bm25_summary")
    if ctx.summary_table is None or not summary_bm25.exists() or not (summary_bm25 / "meta.json").exists():
        raise ValueError(
            f"Profile {ctx.paths.profile!r} does not have document summary indexes. "
            "Build the doc-summary profile first: "
            "rag-literature-rag ingest --embed-profile cuda-qwen0.6b-docsummary-gemma4-v1 --force --rebuild"
        )


def _parent_rows(ctx: RetrieveContext) -> dict[str, dict[str, Any]]:
    cached = _PARENT_ROW_CACHE.get(ctx.paths.profile)
    if cached is not None:
        return cached
    if ctx.parent_table is None:
        return {}
    rows = ctx.parent_table.to_pandas().to_dict("records")
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        row.pop("vector", None)
        clean = {
            key: (None if isinstance(value, float) and math.isnan(value) else value)
            for key, value in row.items()
        }
        out[str(clean.get("id"))] = clean
    _PARENT_ROW_CACHE[ctx.paths.profile] = out
    return out


def _summary_rows(ctx: RetrieveContext) -> dict[str, dict[str, Any]]:
    cached = _SUMMARY_ROW_CACHE.get(ctx.paths.profile)
    if cached is not None:
        return cached
    if ctx.summary_table is None:
        return {}
    rows = ctx.summary_table.to_pandas().to_dict("records")
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        row.pop("vector", None)
        clean = {
            key: (None if isinstance(value, float) and math.isnan(value) else value)
            for key, value in row.items()
        }
        out[str(clean.get("id"))] = clean
    _SUMMARY_ROW_CACHE[ctx.paths.profile] = out
    return out


def _hydrate_summary_bm25(ctx: RetrieveContext, hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = _summary_rows(ctx)
    hydrated: list[dict[str, Any]] = []
    for hit in hits:
        row = rows.get(str(hit.get("id")))
        if not row:
            continue
        merged = dict(row)
        merged["score"] = hit.get("score", 0.0)
        hydrated.append(merged)
    return hydrated


def _child_evidence(row: dict[str, Any], *, rank: int) -> dict[str, Any]:
    return {
        "child_id": row.get("id"),
        "rank": rank,
        "score": row.get("score"),
        "page": row.get("page"),
        "page_end": row.get("page_end"),
        "section_path": row.get("section_path") or "",
        "excerpt": (row.get("text") or "")[:240],
    }


def aggregate_child_hits_to_parents(
    child_hits: list[dict[str, Any]],
    *,
    ctx: RetrieveContext,
    top: int,
) -> list[dict[str, Any]]:
    parents = _parent_rows(ctx)
    grouped: dict[str, dict[str, Any]] = {}
    for rank, child in enumerate(child_hits, start=1):
        parent_id = child.get("parent_id")
        if not parent_id or parent_id not in parents:
            continue
        entry = grouped.setdefault(
            parent_id,
            {
                "best_rank": rank,
                "best_score": float(child.get("score") or 0.0),
                "children": [],
            },
        )
        entry["best_rank"] = min(entry["best_rank"], rank)
        entry["best_score"] = max(entry["best_score"], float(child.get("score") or 0.0))
        if len(entry["children"]) < 5:
            entry["children"].append(_child_evidence(child, rank=rank))

    ranked = sorted(
        grouped.items(),
        key=lambda item: (item[1]["best_rank"], -item[1]["best_score"]),
    )[:top]
    results: list[dict[str, Any]] = []
    for parent_id, meta in ranked:
        row = dict(parents[parent_id])
        row["score"] = round(float(meta["best_score"]), 6)
        row["child_best_rank"] = int(meta["best_rank"])
        row["child_hits"] = meta["children"]
        results.append(row)
    return results


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
    dense_weight: float = 1.0,
    sparse_weight: float = 1.0,
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


def retrieve_small_to_big_candidates(
    query: str,
    *,
    top: int = 20,
    embed_profile: str | None = None,
    filters: RetrieveFilters | None = None,
    pool: int | None = None,
    mode: str = "hybrid",
    rrf_k: int = 20,
) -> list[dict[str, Any]]:
    filters = filters or RetrieveFilters()
    ctx = resolve_retrieve_context(embed_profile=embed_profile)
    _require_parent_indexes(ctx)
    pool = pool or _pool_size(top=top, filters=filters)

    parent_bm25_dir = ctx.paths.bm25_parent_dir or (ctx.paths.root / "bm25_parent")
    dense_parent_results: list[dict[str, Any]] = []
    if mode in {"dense", "hybrid"}:
        query_vector = _embed_vector(query, config=ctx.config)
        child_hits = _dense_search(ctx.table, query_vector, pool=pool, year_min=filters.year_min)
        child_hits = _apply_filters(child_hits, filters)
        dense_parent_results = aggregate_child_hits_to_parents(child_hits, ctx=ctx, top=pool)

    if mode == "dense":
        return _apply_filters(dense_parent_results, filters)

    sparse_parent_results = bm25.search_bm25(query, index_dir=parent_bm25_dir, limit=pool)
    sparse_parent_results = _apply_filters(sparse_parent_results, filters)
    if mode == "parent_bm25":
        return sparse_parent_results
    if mode != "hybrid":
        raise ValueError(f"unknown small-to-big mode {mode!r}")
    return reciprocal_rank_fusion(
        dense_parent_results,
        sparse_parent_results,
        top=pool,
        rrf_k=rrf_k,
    )


def retrieve_docsummary_candidates(
    query: str,
    *,
    top: int = 20,
    embed_profile: str | None = None,
    filters: RetrieveFilters | None = None,
    pool: int | None = None,
    mode: str = "hybrid",
    rrf_k: int = 20,
) -> list[dict[str, Any]]:
    filters = filters or RetrieveFilters()
    ctx = resolve_retrieve_context(embed_profile=embed_profile)
    _require_summary_indexes(ctx)
    pool = pool or _pool_size(top=top, filters=filters)
    summary_bm25_dir = ctx.paths.bm25_summary_dir or (ctx.paths.root / "bm25_summary")

    dense_summary_results: list[dict[str, Any]] = []
    if mode in {"dense", "hybrid", "then_chunks", "fused_hybrid"}:
        query_vector = _embed_vector(query, config=ctx.config)
        dense_summary_results = _dense_search(
            ctx.summary_table,
            query_vector,
            pool=pool,
            year_min=filters.year_min,
        )
        dense_summary_results = _apply_filters(dense_summary_results, filters)

    sparse_summary_results: list[dict[str, Any]] = []
    if mode in {"bm25", "hybrid", "then_chunks", "fused_hybrid"}:
        sparse_hits = bm25.search_bm25(query, index_dir=summary_bm25_dir, limit=pool)
        sparse_summary_results = _apply_filters(_hydrate_summary_bm25(ctx, sparse_hits), filters)

    if mode == "dense":
        return dense_summary_results
    if mode == "bm25":
        return sparse_summary_results

    if mode in {"hybrid", "then_chunks", "fused_hybrid"}:
        summary_results = reciprocal_rank_fusion(
            dense_summary_results,
            sparse_summary_results,
            top=pool,
            rrf_k=rrf_k,
        )
    else:
        raise ValueError(f"unknown docsummary mode {mode!r}")

    if mode == "hybrid":
        return summary_results

    normal_results = retrieve_candidates(
        query,
        top=top,
        embed_profile=embed_profile,
        hybrid=True,
        filters=filters,
        pool=max(pool, top * 8),
        rrf_k=rrf_k,
        context=ctx,
    )
    if mode == "fused_hybrid":
        return reciprocal_rank_fusion(
            normal_results,
            summary_results,
            top=pool,
            rrf_k=rrf_k,
        )

    summary_doc_ids = [row.get("doc_id") for row in summary_results if row.get("doc_id")]
    allowed = set(summary_doc_ids[: max(top * 3, top)])
    selected = [row for row in normal_results if row.get("doc_id") in allowed]
    if selected:
        return selected
    return summary_results


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
