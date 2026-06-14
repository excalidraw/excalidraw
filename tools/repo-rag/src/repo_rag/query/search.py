from __future__ import annotations

import time
from typing import Any

import lancedb
from rag_common.rerank import rerank as rerank_candidates

from repo_rag.ingest.bm25 import search_bm25
from repo_rag.ingest.embed import ENV_PREFIX, EmbedConfig, embed_config_from_env, embed_query
from repo_rag.ingest.index import (
    _table_names,
    embed_config_from_state,
    load_ingest_state,
)
from repo_rag.logging_config import get_logger
from repo_rag.paths import CHUNKS_TABLE, LANCE_DIR
from repo_rag.query.hybrid import reciprocal_rank_fusion

log = get_logger("search")


def _dense_search(
    query: str,
    *,
    limit: int,
    config: EmbedConfig,
    source_type: str | None = None,
    package: str | None = None,
    path_contains: str | None = None,
) -> list[dict[str, Any]]:
    if not LANCE_DIR.exists():
        return []

    db = lancedb.connect(str(LANCE_DIR))
    if CHUNKS_TABLE not in _table_names(db):
        return []

    vector = embed_query(query, config=config, prefix=ENV_PREFIX, allow_fallback=False)
    table = db.open_table(CHUNKS_TABLE)
    t0 = time.monotonic()
    results = table.search(vector).metric("cosine").limit(limit * 2).to_list()
    log.debug("dense search lancedb hits=%d elapsed_s=%.3f", len(results), time.monotonic() - t0)

    filtered: list[dict[str, Any]] = []
    for row in results:
        if source_type and row.get("source_type") != source_type:
            continue
        if package and row.get("package") != package:
            continue
        if path_contains and path_contains not in (row.get("file_path") or ""):
            continue

        distance = row.get("_distance")
        score = 1.0 - distance if distance is not None else 0.0
        filtered.append(
            {
                "id": row.get("id"),
                "score": round(float(score), 6),
                "file_path": row.get("file_path"),
                "symbol": row.get("symbol"),
                "source_type": row.get("source_type"),
                "package": row.get("package"),
                "text": row.get("text"),
                "start_line": row.get("start_line"),
                "chunk_index": row.get("chunk_index"),
            }
        )
        if len(filtered) >= limit:
            break
    return filtered


def search(
    query: str,
    *,
    top: int = 8,
    source_type: str | None = None,
    package: str | None = None,
    path_contains: str | None = None,
    embed_profile: str | None = None,
    rerank: bool | None = None,
) -> list[dict[str, Any]]:
    state = load_ingest_state()
    indexed = embed_config_from_state(state)
    if embed_profile:
        config = embed_config_from_env(profile=embed_profile)
        if indexed is not None:
            from repo_rag.ingest.index import ensure_embed_config_matches

            ensure_embed_config_matches(state, config)
    else:
        config = indexed if indexed is not None else embed_config_from_env()

    try:
        dense = _dense_search(
            query,
            limit=40,
            config=config,
            source_type=source_type,
            package=package,
            path_contains=path_contains,
        )
    except Exception as exc:
        log.warning("dense search unavailable; continuing with BM25: %s", exc)
        dense = []
    sparse = search_bm25(
        query,
        limit=40,
        source_type=source_type,
        package=package,
        path_contains=path_contains,
    )

    merged = reciprocal_rank_fusion(dense, sparse, top=max(top, 20))
    # Retrieve wide, rerank narrow: a cross-encoder reorders the fused candidates
    # by query-document relevance. Code relevance hinges on file path + symbol, so
    # prepend those to the chunk body for the reranker (it never sees the metadata
    # otherwise). No-op passthrough (plain top-k slice) when reranking is disabled
    # or the model is unavailable — see rag_common.rerank.
    for row in merged:
        header = " ".join(filter(None, (row.get("file_path"), row.get("symbol"))))
        row["_rerank_text"] = f"{header}\n{row.get('text') or ''}" if header else (row.get("text") or "")
    ranked = rerank_candidates(query, merged, top=top, text_key="_rerank_text", enabled=rerank)
    log.debug(
        "hybrid dense=%d sparse=%d merged=%d ranked=%d",
        len(dense),
        len(sparse),
        len(merged),
        len(ranked),
    )

    results: list[dict[str, Any]] = []
    for row in ranked:
        text = row.get("text") or ""
        excerpt = text[:600] + ("..." if len(text) > 600 else "")
        tags = []
        fp = row.get("file_path") or ""
        if "pipeline" in fp:
            tags.append("pipeline")
        if row.get("source_type") == "handoff":
            tags.append("handoff")
        if row.get("source_type") == "terraform":
            tags.append("terraform")

        result = {
            "score": row.get("score"),
            "file_path": row.get("file_path"),
            "symbol": row.get("symbol"),
            "source_type": row.get("source_type"),
            "package": row.get("package"),
            "start_line": row.get("start_line"),
            "chunk_id": row.get("id"),
            "excerpt": excerpt,
            "tags": tags,
        }
        if row.get("rerank_score") is not None:
            result["rerank_score"] = row.get("rerank_score")
        results.append(result)
    return results
