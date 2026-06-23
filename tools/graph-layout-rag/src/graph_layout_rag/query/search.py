from __future__ import annotations

from typing import Any

from graph_layout_rag.catalog.taxonomy import PIPELINE_CATEGORIES
from graph_layout_rag.query.hybrid import DENSE_WEIGHT, SPARSE_WEIGHT
from graph_layout_rag.query.retrieve import (
    RetrieveFilters,
    DEFAULT_HYBRID,
    catalog_maps,
    diversify_candidates,
    retrieve_candidates,
    retrieve_multi_query,
)
from graph_layout_rag.query.identity import canonical_identity_map, split_values
from rag_common.rerank import rerank as rerank_candidates


def _score(row: dict[str, Any]) -> float:
    if "rerank_score" in row:
        return round(float(row["rerank_score"]), 4)
    if "fusion_score" in row:
        return round(float(row["fusion_score"]), 6)
    return round(float(row.get("score", 0.0)), 4)


def _evidence(row: dict[str, Any]) -> dict[str, Any]:
    text = row.get("text") or ""
    return {
        "excerpt": text[:400] + ("..." if len(text) > 400 else ""),
        "page": row.get("page"),
        "page_end": row.get("page_end"),
        "section_path": row.get("section_path") or "",
        "chunk_id": row.get("id"),
        "score": _score(row),
    }


def format_results(
    reranked: list[dict[str, Any]],
    *,
    top: int,
    max_per_doc: int,
) -> list[dict[str, Any]]:
    category_map, _ = catalog_maps()
    identities = canonical_identity_map()
    grouped: dict[str, list[dict[str, Any]]] = {}
    ordered_ids: list[str] = []
    for row in reranked:
        canonical_doc_id = identities.canonical_doc_id(row)
        if canonical_doc_id not in grouped:
            grouped[canonical_doc_id] = []
            ordered_ids.append(canonical_doc_id)
        if len(grouped[canonical_doc_id]) < max_per_doc:
            grouped[canonical_doc_id].append(row)

    out: list[dict[str, Any]] = []
    for canonical_doc_id in ordered_ids:
        evidence_rows = grouped[canonical_doc_id]
        row = evidence_rows[0]
        doc_id = row.get("doc_id") or ""
        evidence = [_evidence(candidate) for candidate in evidence_rows]

        pipeline_categories = [
            c.strip()
            for c in (row.get("pipeline_categories") or "").split(",")
            if c.strip()
        ]
        if not pipeline_categories and doc_id in category_map:
            pipeline_categories = sorted(category_map[doc_id])

        entry: dict[str, Any] = {
            "score": _score(row),
            "title": row.get("title"),
            "excerpt": evidence[0]["excerpt"],
            "source_url": row.get("source_url"),
            "page": row.get("page"),
            "page_end": row.get("page_end"),
            "tags": [t for t in (row.get("tags") or "").split(",") if t],
            "pipeline_categories": pipeline_categories,
            "doc_id": doc_id,
            "canonical_doc_id": canonical_doc_id,
            "section_path": row.get("section_path") or "",
            "alias_doc_ids": identities.aliases(canonical_doc_id, row),
            "alias_source_urls": split_values(row.get("alias_source_urls")),
            "alias_dois": split_values(row.get("alias_dois")),
            "canonical_sha256": row.get("canonical_sha256") or None,
            "evidence": evidence,
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
        if len(out) >= top:
            break

    return out


def retrieve_hyde_candidates(
    query: str,
    *,
    top: int,
    embed_profile: str | None,
    hybrid: bool,
    filters: RetrieveFilters,
) -> list[dict[str, Any]] | None:
    """HyDE: embed a hypothetical passage, retrieve with hybrid BM25+dense fusion."""
    from graph_layout_rag.ingest.embed import ENV_PREFIX, embed_query
    from graph_layout_rag.query.retrieve import resolve_retrieve_context, retrieve_candidates
    from graph_layout_rag.query.transforms import hyde_passage

    try:
        passage = hyde_passage(query)
    except RuntimeError:
        return None
    ctx = resolve_retrieve_context(embed_profile=embed_profile)
    vector = embed_query(passage, config=ctx.config, prefix=ENV_PREFIX, allow_fallback=False)
    return retrieve_candidates(
        query,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        filters=filters,
        context=ctx,
        vector=vector,
        bm25_query=query,
    )


def _expand_candidates(
    query: str,
    *,
    top: int,
    embed_profile: str | None,
    hybrid: bool,
    filters: RetrieveFilters,
) -> list[dict[str, Any]] | None:
    """Run HyDE expansion and re-retrieve.

    Returns fused candidates, or None if the LLM is unavailable so the caller
    falls back to the single-shot result.
    """
    return retrieve_hyde_candidates(
        query,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        filters=filters,
    )


def should_use_hyde(
    query: str,
    candidates: list[dict[str, Any]],
    *,
    pdf_only: bool = False,
    force: bool = False,
) -> bool:
    """Auto-gate: HyDE for pdf-deep-read, vague, or under-served catalog queries."""
    if force:
        return True
    if pdf_only:
        return True
    words = [w for w in query.split() if len(w) > 2]
    if len(words) <= 4:
        return True
    if len(candidates) < 3:
        return True
    return False


def _should_expand(query: str, candidates: list[dict[str, Any]], *, pdf_only: bool = False) -> bool:
    return should_use_hyde(query, candidates, pdf_only=pdf_only)


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
    expand: str = "off",
) -> list[dict[str, Any]]:
    if category and category not in PIPELINE_CATEGORIES:
        raise ValueError(
            f"Unknown category {category!r}. Choose from: {', '.join(PIPELINE_CATEGORIES)}"
        )
    if expand not in ("off", "auto", "force"):
        raise ValueError(f"expand must be off|auto|force, got {expand!r}")

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
    if expand == "force" or (
        expand == "auto" and _should_expand(query, candidates, pdf_only=pdf_only)
    ):
        expanded = _expand_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            hybrid=hybrid,
            filters=filters,
        )
        if expanded:
            candidates = expanded
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
    rrf_k: int = 20,
    dense_weight: float = DENSE_WEIGHT,
    sparse_weight: float = SPARSE_WEIGHT,
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


def search_auto_hyde_raw(
    query: str,
    *,
    top: int = 20,
    embed_profile: str | None = None,
    hybrid: bool = DEFAULT_HYBRID,
    filters: RetrieveFilters | None = None,
    pdf_only: bool = False,
    max_per_doc: int = 2,
) -> list[dict[str, Any]]:
    """Eval/CLI router: hybrid by default; HyDE when pdf_only or vague/thin."""
    filters = filters or RetrieveFilters()
    candidates = retrieve_candidates(
        query,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        filters=filters,
    )
    if should_use_hyde(query, candidates, pdf_only=pdf_only):
        expanded = retrieve_hyde_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            hybrid=hybrid,
            filters=filters,
        )
        if expanded:
            candidates = expanded
    diverse = diversify_candidates(
        candidates,
        max_per_doc=5,
        limit=max(top * max_per_doc, 50),
    )
    return format_results(diverse, top=top, max_per_doc=max_per_doc)
