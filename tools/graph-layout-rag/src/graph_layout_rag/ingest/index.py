from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import lancedb

from graph_layout_rag.ingest.chunk import TextChunk
from graph_layout_rag.ingest.embed import EmbedConfig, EmbedStats, embed_texts
from graph_layout_rag.paths import (
    CHUNKS_TABLE,
    EMBED_COST_PER_MILLION_TOKENS,
    INGEST_STATE_PATH,
    LANCE_DIR,
)

METADATA_KEYS = frozenset(
    {
        "embed_model",
        "embed_dims",
        "total_tokens_embedded",
        "estimated_cost_usd",
        "last_indexed_at",
    }
)


def load_ingest_state() -> dict[str, Any]:
    if not INGEST_STATE_PATH.exists():
        return {}
    return json.loads(INGEST_STATE_PATH.read_text(encoding="utf-8"))


def save_ingest_state(state: dict[str, Any]) -> None:
    INGEST_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    INGEST_STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def doc_sha256(state: dict[str, Any], doc_id: str) -> str | None:
    value = state.get(doc_id)
    return value if isinstance(value, str) else None


def _table_names(db: lancedb.DBConnection) -> list[str]:
    tables = db.list_tables()
    if isinstance(tables, list):
        return tables
    return list(getattr(tables, "tables", tables))


def _chunk_row(chunk: TextChunk, vector: list[float]) -> dict[str, Any]:
    return {
        "id": f"{chunk.doc_id}:{chunk.chunk_index}",
        "doc_id": chunk.doc_id,
        "title": chunk.title,
        "text": chunk.text,
        "page": chunk.page,
        "chunk_index": chunk.chunk_index,
        "source_url": chunk.source_url,
        "year": chunk.year,
        "tags": ",".join(chunk.tags),
        "authors": ",".join(chunk.authors),
        "vector": vector,
    }


def embed_config_mismatch(state: dict[str, Any], config: EmbedConfig) -> bool:
    model = state.get("embed_model")
    dims = state.get("embed_dims")
    if model and model != config.model:
        return True
    if dims is not None and int(dims) != config.dimensions:
        return True
    return False


def ensure_embed_config_matches(state: dict[str, Any], config: EmbedConfig) -> None:
    model = state.get("embed_model")
    dims = state.get("embed_dims")
    if model and model != config.model:
        raise RuntimeError(
            f"Index was built with embed model '{model}' but query uses '{config.model}'. "
            "Re-run: graph-layout-rag ingest --force --rebuild"
        )
    if dims is not None and int(dims) != config.dimensions:
        raise RuntimeError(
            f"Index was built with embed dims {dims} but query uses {config.dimensions}. "
            "Re-run: graph-layout-rag ingest --force --rebuild"
        )


def update_ingest_metadata(
    state: dict[str, Any],
    *,
    config: EmbedConfig,
    run_tokens: int,
) -> None:
    prev_tokens = int(state.get("total_tokens_embedded", 0))
    prev_cost = float(state.get("estimated_cost_usd", 0.0))
    run_cost = (run_tokens / 1_000_000) * EMBED_COST_PER_MILLION_TOKENS
    state["embed_model"] = config.model
    state["embed_dims"] = config.dimensions
    state["total_tokens_embedded"] = prev_tokens + run_tokens
    state["estimated_cost_usd"] = round(prev_cost + run_cost, 6)
    state["last_indexed_at"] = datetime.now(timezone.utc).isoformat()


def upsert_chunks(
    chunks: list[TextChunk],
    *,
    rebuild: bool = False,
    config: EmbedConfig | None = None,
    stats: EmbedStats | None = None,
    workers: int | None = None,
) -> int:
    if not chunks:
        return 0

    cfg = config or EmbedConfig.from_env()
    texts = [c.text for c in chunks]
    vectors = embed_texts(texts, config=cfg, stats=stats, workers=workers)
    rows = [_chunk_row(c, v) for c, v in zip(chunks, vectors)]

    LANCE_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCE_DIR))

    tables = _table_names(db)
    if rebuild or CHUNKS_TABLE not in tables:
        if CHUNKS_TABLE in tables:
            db.drop_table(CHUNKS_TABLE)
        db.create_table(CHUNKS_TABLE, data=rows)
        return len(rows)

    table = db.open_table(CHUNKS_TABLE)
    ids = [r["id"] for r in rows]
    if ids:
        id_list = ", ".join(f"'{i}'" for i in ids)
        try:
            table.delete(f"id IN ({id_list})")
        except Exception:
            pass
    table.add(rows)
    return len(rows)


def chunk_count() -> int:
    if not LANCE_DIR.exists():
        return 0
    db = lancedb.connect(str(LANCE_DIR))
    if CHUNKS_TABLE not in _table_names(db):
        return 0
    return db.open_table(CHUNKS_TABLE).count_rows()
