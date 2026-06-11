from __future__ import annotations

import time
from typing import Any

import lancedb

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
) -> list[dict[str, Any]]:
    config = embed_config_from_env()
    state = load_ingest_state()
    indexed = embed_config_from_state(state)
    if indexed is not None:
        config = indexed

    dense = _dense_search(
        query,
        limit=40,
        config=config,
        source_type=source_type,
        package=package,
        path_contains=path_contains,
    )
    sparse = search_bm25(
        query,
        limit=40,
        source_type=source_type,
        package=package,
        path_contains=path_contains,
    )

    merged = reciprocal_rank_fusion(dense, sparse, top=max(top, 20))
    log.debug(
        "hybrid dense=%d sparse=%d merged=%d",
        len(dense),
        len(sparse),
        len(merged),
    )

    results: list[dict[str, Any]] = []
    for row in merged[:top]:
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

        results.append(
            {
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
        )
    return results
