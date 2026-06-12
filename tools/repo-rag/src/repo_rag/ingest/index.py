from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import lancedb

from repo_rag.chunk.prefix import build_prefixed_text
from repo_rag.chunk.types import TextChunk
from repo_rag.ingest.embed import ENV_PREFIX, EmbedConfig, EmbedStats, embed_config_from_env, embed_texts, prepare_embed_config
from rag_common.config import embed_cost_per_million

from repo_rag.paths import CHUNKS_TABLE, INGEST_STATE_PATH, LANCE_DIR


def load_ingest_state() -> dict[str, Any]:
    if not INGEST_STATE_PATH.exists():
        return {}
    return json.loads(INGEST_STATE_PATH.read_text(encoding="utf-8"))


def save_ingest_state(state: dict[str, Any]) -> None:
    INGEST_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    INGEST_STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def _table_names(db: lancedb.DBConnection) -> list[str]:
    tables = db.list_tables()
    if isinstance(tables, list):
        return tables
    return list(getattr(tables, "tables", tables))


def _chunk_row(chunk: TextChunk, vector: list[float], prefixed: str) -> dict[str, Any]:
    return {
        "id": chunk.chunk_id,
        "file_path": chunk.file_path,
        "symbol": chunk.symbol,
        "kind": chunk.kind,
        "source_type": chunk.source_type,
        "package": chunk.package,
        "is_test": chunk.is_test,
        "tags": ",".join(chunk.tags),
        "text": chunk.text,
        "prefixed_text": prefixed,
        "start_line": chunk.start_line,
        "chunk_index": chunk.chunk_index,
        "vector": vector,
    }


def delete_chunks_for_file(file_path: str) -> None:
    if not LANCE_DIR.exists():
        return
    db = lancedb.connect(str(LANCE_DIR))
    if CHUNKS_TABLE not in _table_names(db):
        return
    table = db.open_table(CHUNKS_TABLE)
    safe = file_path.replace("'", "''")
    try:
        table.delete(f"file_path = '{safe}'")
    except Exception:
        pass


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

    cfg = config or embed_config_from_env()
    prefixed = [build_prefixed_text(c) for c in chunks]
    vectors = embed_texts(
        prefixed,
        config=cfg,
        stats=stats,
        workers=workers,
        prefix=ENV_PREFIX,
        allow_fallback=False,
        probe=False,
    )
    rows = [_chunk_row(c, v, p) for c, v, p in zip(chunks, vectors, prefixed)]

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


def update_ingest_metadata(
    state: dict[str, Any],
    *,
    config: EmbedConfig,
    run_tokens: int,
) -> None:
    prev_tokens = int(state.get("total_tokens_embedded", 0))
    prev_cost = float(state.get("estimated_cost_usd", 0.0))
    run_cost = (run_tokens / 1_000_000) * embed_cost_per_million(config.backend)
    state["embed_backend"] = config.backend
    state["embed_model"] = config.model
    state["embed_dims"] = config.dimensions
    if config.profile:
        state["embed_profile"] = config.profile
    if config.quant:
        state["embed_quant"] = config.quant
    state["total_tokens_embedded"] = prev_tokens + run_tokens
    state["estimated_cost_usd"] = round(prev_cost + run_cost, 6)
    state["last_indexed_at"] = datetime.now(timezone.utc).isoformat()


def embed_config_from_state(state: dict[str, Any]) -> EmbedConfig | None:
    backend = state.get("embed_backend")
    if not backend:
        return None
    quant = state.get("embed_quant")
    return EmbedConfig(
        backend=backend,
        model=state.get("embed_model", ""),
        dimensions=int(state.get("embed_dims", 0)),
        profile=state.get("embed_profile"),
        quant=quant if quant else None,
    )


def embed_config_mismatch(state: dict[str, Any], config: EmbedConfig) -> bool:
    indexed = embed_config_from_state(state)
    if indexed is None:
        return False
    if indexed.profile and config.profile and indexed.profile != config.profile:
        return True
    return (
        indexed.backend != config.backend
        or indexed.model != config.model
        or indexed.dimensions != config.dimensions
    )


def ensure_embed_config_matches(state: dict[str, Any], config: EmbedConfig) -> None:
    indexed = embed_config_from_state(state)
    if indexed is None:
        return
    if indexed.backend != config.backend:
        raise RuntimeError(
            f"Index was built with embed backend '{indexed.backend}' "
            f"but query uses '{config.backend}'. Re-run: repo-rag index --force --rebuild"
        )
    if indexed.model != config.model:
        raise RuntimeError(
            f"Index was built with embed model '{indexed.model}' but query uses '{config.model}'. "
            "Re-run: repo-rag index --force --rebuild"
        )
    if indexed.dimensions != config.dimensions:
        raise RuntimeError(
            f"Index was built with embed dims {indexed.dimensions} but query uses {config.dimensions}. "
            "Re-run: repo-rag index --force --rebuild"
        )
    if indexed.profile and config.profile and indexed.profile != config.profile:
        raise RuntimeError(
            f"Index was built with embed profile '{indexed.profile}' "
            f"but query uses '{config.profile}'. "
            "Re-run: repo-rag index --force --rebuild"
        )
