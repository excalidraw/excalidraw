from __future__ import annotations

from typing import Any

from graph_layout_rag.catalog.taxonomy import PIPELINE_CATEGORIES
from graph_layout_rag.query.retrieve import (
    RetrieveFilters,
    DEFAULT_HYBRID,
    catalog_maps,
    diversify_candidates,
    retrieve_candidates,
    retrieve_multi_query,
)
from rag_common.rerank import rerank as rerank_candidates


def format_results(
    reranked: list[dict[str, Any]],
    *,
    top: int,
    max_per_doc: int,
) -> list[dict[str, Any]]:
    category_map, _ = catalog_maps()
    out: list[dict[str, Any]] = []
    final_counts: dict[str, int] = {}

    for row in reranked:
        doc_id = row.get("doc_id") or ""
        if final_counts.get(doc_id, 0) >= max_per_doc:
            continue

        text = row.get("text") or ""
        excerpt = text[:400] + ("..." if len(text) > 400 else "")

        pipeline_categories = [
            c.strip()
            for c in (row.get("pipeline_categories") or "").split(",")
            if c.strip()
        ]
        if not pipeline_categories and doc_id in category_map:
            pipeline_categories = sorted(category_map[doc_id])

        if "rerank_score" in row:
            score = round(float(row["rerank_score"]), 4)
        elif "fusion_score" in row:
            score = round(float(row["fusion_score"]), 6)
        else:
            score = round(float(row.get("score", 0.0)), 4)

        entry: dict[str, Any] = {
            "score": score,
            "title": row.get("title"),
            "excerpt": excerpt,
            "source_url": row.get("source_url"),
            "page": row.get("page"),
            "page_end": row.get("page_end"),
            "tags": [t for t in (row.get("tags") or "").split(",") if t],
            "pipeline_categories": pipeline_categories,
            "doc_id": doc_id,
            "section_path": row.get("section_path") or "",
            "alias_doc_ids": [value for value in (row.get("alias_doc_ids") or "").split(",") if value],
            "alias_source_urls": [value for value in (row.get("alias_source_urls") or "").split(",") if value],
            "alias_dois": [value for value in (row.get("alias_dois") or "").split(",") if value],
            "canonical_sha256": row.get("canonical_sha256") or None,
        }
        if "rerank_score" in row:
            entry["rerank_score"] = round(float(row["rerank_score"]), 4)
        if "fusion_score" in row:
            entry["fusion_score"] = round(float(row["fusion_score"]), 6)
        if "dense_rank" in row:
            entry["dense_rank"] = row["dense_rank"]
        if "sparse_rank" in row:
            entry["sparse_rank"] = row["sparse_rank"]
        out.append(entry)
        final_counts[doc_id] = final_counts.get(doc_id, 0) + 1
        if len(out) >= top:
            break

    return out


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
    rerank: bool | None = None,
    hybrid: bool = DEFAULT_HYBRID,
    max_per_doc: int = 2,
) -> list[dict[str, Any]]:
    if category and category not in PIPELINE_CATEGORIES:
        raise ValueError(
            f"Unknown category {category!r}. Choose from: {', '.join(PIPELINE_CATEGORIES)}"
        )

    filters = RetrieveFilters(
        tag=tag,
        source=source,
        year_min=year_min,
        category=category,
        pdf_only=pdf_only,
    )
    candidates = retrieve_candidates(
        query,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        filters=filters,
    )
    diverse = diversify_candidates(
        candidates,
        max_per_doc=5,
        limit=max(top * max_per_doc, 50),
    )
    reranked = rerank_candidates(
        query,
        diverse,
        top=max(top * max_per_doc, top),
        enabled=rerank,
    )
    return format_results(reranked, top=top, max_per_doc=max_per_doc)


def search_raw(
    query: str,
    *,
    top: int = 20,
    embed_profile: str | None = None,
    hybrid: bool = DEFAULT_HYBRID,
    sparse_only: bool = False,
    filters: RetrieveFilters | None = None,
    rerank: bool | None = None,
    max_per_doc: int = 2,
    rerank_query: str | None = None,
    pool: int | None = None,
    rrf_k: int = 60,
    dense_weight: float = 1.0,
    sparse_weight: float = 1.0,
    rerank_model: str | None = None,
) -> list[dict[str, Any]]:
    """Return formatted results for eval strategies (doc_id + score fields)."""
    candidates = retrieve_candidates(
        query,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        sparse_only=sparse_only,
        filters=filters,
        pool=pool,
        rrf_k=rrf_k,
        dense_weight=dense_weight,
        sparse_weight=sparse_weight,
    )
    diverse = diversify_candidates(
        candidates,
        max_per_doc=5,
        limit=max(top * max_per_doc, 50),
    )
    reranked = rerank_candidates(
        rerank_query or query,
        diverse,
        top=max(top * max_per_doc, top),
        enabled=rerank,
        model_name=rerank_model,
    )
    return format_results(reranked, top=top, max_per_doc=max_per_doc)


def search_multi_raw(
    queries: list[str],
    *,
    top: int = 20,
    embed_profile: str | None = None,
    hybrid: bool = DEFAULT_HYBRID,
    filters: RetrieveFilters | None = None,
    rerank: bool | None = None,
    max_per_doc: int = 2,
    rerank_query: str | None = None,
) -> list[dict[str, Any]]:
    candidates = retrieve_multi_query(
        queries,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        filters=filters,
    )
    diverse = diversify_candidates(
        candidates,
        max_per_doc=5,
        limit=max(top * max_per_doc, 50),
    )
    reranked = rerank_candidates(
        rerank_query or queries[0],
        diverse,
        top=max(top * max_per_doc, top),
        enabled=rerank,
    )
    return format_results(reranked, top=top, max_per_doc=max_per_doc)
