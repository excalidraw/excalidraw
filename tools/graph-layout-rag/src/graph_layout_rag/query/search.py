from __future__ import annotations

from typing import Any

import lancedb

from graph_layout_rag.ingest.embed import ENV_PREFIX, embed_config_from_env, embed_texts
from graph_layout_rag.ingest.index import (
    _table_names,
    embed_config_from_state,
    load_ingest_state,
)
from graph_layout_rag.paths import CHUNKS_TABLE, LANCE_DIR


def search(
    query: str,
    *,
    top: int = 8,
    tag: str | None = None,
    source: str | None = None,
    year_min: int | None = None,
) -> list[dict[str, Any]]:
    if not LANCE_DIR.exists():
        return []

    db = lancedb.connect(str(LANCE_DIR))
    if CHUNKS_TABLE not in _table_names(db):
        return []

    state = load_ingest_state()
    indexed = embed_config_from_state(state)
    config = indexed if indexed is not None else embed_config_from_env()

    table = db.open_table(CHUNKS_TABLE)
    vector = embed_texts(
        [query],
        config=config,
        workers=1,
        prefix=ENV_PREFIX,
        allow_fallback=False,
        probe=False,
    )[0]

    results = (
        table.search(vector)
        .metric("cosine")
        .limit(top * 4)
        .to_list()
    )

    filtered: list[dict[str, Any]] = []
    for row in results:
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

        filtered.append(
            {
                "score": round(score, 4),
                "title": row.get("title"),
                "excerpt": excerpt,
                "source_url": row.get("source_url"),
                "page": row.get("page"),
                "tags": [t for t in (row.get("tags") or "").split(",") if t],
                "doc_id": row.get("doc_id"),
            }
        )
        if len(filtered) >= top:
            break

    return filtered
