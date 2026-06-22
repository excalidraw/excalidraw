from __future__ import annotations

from typing import Any

from rag_literature_rag.catalog.taxonomy import PIPELINE_CATEGORIES
from rag_literature_rag.query.retrieve import (
    RetrieveFilters,
    DEFAULT_HYBRID,
    catalog_maps,
    diversify_candidates,
    retrieve_candidates,
    retrieve_docsummary_candidates,
    retrieve_multi_query,
    retrieve_raptor_candidates,
    retrieve_small_to_big_candidates,
)
from rag_literature_rag.query.identity import canonical_identity_map, split_values
from rag_common.rerank import rerank as rerank_candidates


def _score(row: dict[str, Any]) -> float:
    if "rerank_score" in row:
        return round(float(row["rerank_score"]), 4)
    if "fusion_score" in row:
        return round(float(row["fusion_score"]), 6)
    return round(float(row.get("score", 0.0)), 4)


def _evidence(row: dict[str, Any]) -> dict[str, Any]:
    text = row.get("text") or ""
    evidence = {
        "excerpt": text[:400] + ("..." if len(text) > 400 else ""),
        "page": row.get("page"),
        "page_end": row.get("page_end"),
        "section_path": row.get("section_path") or "",
        "chunk_id": row.get("id"),
        "score": _score(row),
    }
    if row.get("child_hits"):
        evidence["child_hits"] = row["child_hits"]
    if row.get("summary_level"):
        evidence["summary_level"] = row["summary_level"]
        evidence["source_chunk_ids"] = split_values(row.get("source_chunk_ids"))
        evidence["summary_model"] = row.get("summary_model")
        evidence["prompt_version"] = row.get("prompt_version")
    return evidence


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


def _expand_candidates(
    query: str,
    *,
    top: int,
    embed_profile: str | None,
    hybrid: bool,
    filters: RetrieveFilters,
) -> list[dict[str, Any]] | None:
    """Run query transforms (multi-query + step-back) and re-retrieve.

    Returns fused candidates, or None if the LLM is unavailable so the caller
    falls back to the single-shot result.
    """
    from rag_literature_rag.query.transforms import multi_query_rewrites, step_back_query

    queries = [query]
    try:
        queries.extend(multi_query_rewrites(query))
        queries.append(step_back_query(query))
    except RuntimeError:
        return None
    # De-dup while preserving order.
    seen: set[str] = set()
    unique = [q for q in queries if not (q in seen or seen.add(q))]
    return retrieve_multi_query(
        unique,
        top=top,
        embed_profile=embed_profile,
        hybrid=hybrid,
        filters=filters,
    )


def _should_expand(query: str, candidates: list[dict[str, Any]]) -> bool:
    """Auto-gate: expand vague / under-served queries only.

    Heuristic — expand when the query reads like a short/colloquial question
    (few content words) or retrieval came back thin. Keeps normal keyword
    queries on the fast single-shot path.
    """
    words = [w for w in query.split() if len(w) > 2]
    if len(words) <= 4:
        return True
    if len(candidates) < 3:
        return True
    return False


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
    small_to_big: bool = False,
    raptor: bool = False,
    raptor_mode: str = "hybrid",
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
    if small_to_big:
        candidates = retrieve_small_to_big_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            filters=filters,
            mode="hybrid",
        )
    elif raptor:
        candidates = retrieve_raptor_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            filters=filters,
            mode=raptor_mode,
        )
    else:
        candidates = retrieve_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            hybrid=hybrid,
            filters=filters,
        )
    if not small_to_big and not raptor and (expand == "force" or (expand == "auto" and _should_expand(query, candidates))):
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
    dense_weight: float = 1.0,
    sparse_weight: float = 1.0,
    rerank_model: str | None = None,
    small_to_big: bool = False,
    small_to_big_mode: str = "hybrid",
    docsummary: bool = False,
    docsummary_mode: str = "hybrid",
    raptor: bool = False,
    raptor_mode: str = "hybrid",
) -> list[dict[str, Any]]:
    """Return formatted results for eval strategies (doc_id + score fields)."""
    if raptor:
        candidates = retrieve_raptor_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            filters=filters,
            pool=pool,
            mode=raptor_mode,
            rrf_k=rrf_k,
        )
    elif docsummary:
        candidates = retrieve_docsummary_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            filters=filters,
            pool=pool,
            mode=docsummary_mode,
            rrf_k=rrf_k,
        )
    elif small_to_big:
        candidates = retrieve_small_to_big_candidates(
            query,
            top=top,
            embed_profile=embed_profile,
            filters=filters,
            pool=pool,
            mode=small_to_big_mode,
            rrf_k=rrf_k,
        )
    else:
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
