from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any

import lancedb

from rag_common.gemini_embed import is_gemini_embedding_2

from graph_layout_rag.ingest.chunk import TextChunk, embed_input_text
from graph_layout_rag.ingest.log import get_logger
from graph_layout_rag.ingest.embed import (
    ENV_PREFIX,
    EmbedConfig,
    EmbedStats,
    embed_config_from_env,
    embed_texts,
)
from rag_common.config import embed_cost_per_million

from graph_layout_rag.paths import (
    CHUNKS_TABLE,
    ProfileIndexPaths,
    profile_index_paths,
)

METADATA_KEYS = frozenset(
    {
        "embed_backend",
        "embed_model",
        "embed_dims",
        "embed_profile",
        "embed_quant",
        "total_tokens_embedded",
        "estimated_cost_usd",
        "last_indexed_at",
    }
)


def _paths(profile: str | ProfileIndexPaths | None) -> ProfileIndexPaths:
    if isinstance(profile, ProfileIndexPaths):
        return profile
    return profile_index_paths(profile)


def load_ingest_state(profile: str | ProfileIndexPaths | None = None) -> dict[str, Any]:
    paths = _paths(profile)
    if not paths.ingest_state.is_file():
        return {}
    return json.loads(paths.ingest_state.read_text(encoding="utf-8"))


def save_ingest_state(
    state: dict[str, Any],
    profile: str | ProfileIndexPaths | None = None,
) -> None:
    paths = _paths(profile)
    paths.root.mkdir(parents=True, exist_ok=True)
    paths.ingest_state.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


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
        "pipeline_categories": ",".join(chunk.pipeline_categories),
        "authors": ",".join(chunk.authors),
        "vector": vector,
    }


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
            f"but query uses '{config.backend}'. "
            "Re-run: graph-layout-rag ingest --force --rebuild"
        )
    if indexed.model != config.model:
        raise RuntimeError(
            f"Index was built with embed model '{indexed.model}' but query uses '{config.model}'. "
            "Re-run: graph-layout-rag ingest --force --rebuild"
        )
    if indexed.dimensions != config.dimensions:
        raise RuntimeError(
            f"Index was built with embed dims {indexed.dimensions} but query uses {config.dimensions}. "
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


def upsert_chunks(
    chunks: list[TextChunk],
    *,
    rebuild: bool = False,
    config: EmbedConfig | None = None,
    stats: EmbedStats | None = None,
    workers: int | None = None,
    profile: str | ProfileIndexPaths | None = None,
) -> int:
    if not chunks:
        return 0

    paths = _paths(profile)
    log = get_logger()
    cfg = config or embed_config_from_env()
    if is_gemini_embedding_2(cfg.model):
        texts = [c.text for c in chunks]
        titles = [c.title for c in chunks]
    else:
        texts = [embed_input_text(c) for c in chunks]
        titles = None
    doc_ids = len({c.doc_id for c in chunks})
    profile_note = f" profile={cfg.profile}" if cfg.profile else ""
    log.info(
        "embedding %d chunk(s) from %d doc(s) backend=%s model=%s dims=%d%s index=%s",
        len(chunks),
        doc_ids,
        cfg.backend,
        cfg.model,
        cfg.dimensions,
        profile_note,
        paths.root,
    )
    t0 = time.monotonic()
    vectors = embed_texts(
        texts,
        config=cfg,
        stats=stats,
        workers=workers,
        prefix=ENV_PREFIX,
        allow_fallback=True,
        probe=False,
        titles=titles,
    )
    embed_s = time.monotonic() - t0
    log.info("embedded %d chunk(s) in %.1fs", len(chunks), embed_s)

    rows = [_chunk_row(c, v) for c, v in zip(chunks, vectors)]

    paths.lance_dir.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(paths.lance_dir))

    tables = _table_names(db)
    if rebuild or CHUNKS_TABLE not in tables:
        if CHUNKS_TABLE in tables:
            log.info("dropping LanceDB table %s for rebuild", CHUNKS_TABLE)
            db.drop_table(CHUNKS_TABLE)
        log.info("creating LanceDB table %s with %d row(s)", CHUNKS_TABLE, len(rows))
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
    log.debug("upserting %d row(s) into %s", len(rows), CHUNKS_TABLE)
    table.add(rows)
    return len(rows)


def describe_profile_index(profile: str | ProfileIndexPaths) -> dict[str, Any]:
    paths = _paths(profile)
    state = load_ingest_state(paths)
    return {
        "profile": paths.profile,
        "path": str(paths.root),
        "chunks": chunk_count(paths),
        "embed_backend": state.get("embed_backend"),
        "embed_model": state.get("embed_model"),
        "embed_dims": state.get("embed_dims"),
        "embed_profile": state.get("embed_profile"),
        "last_indexed_at": state.get("last_indexed_at"),
        "total_tokens_embedded": state.get("total_tokens_embedded", 0),
        "estimated_cost_usd": state.get("estimated_cost_usd", 0.0),
    }


def chunk_count(profile: str | ProfileIndexPaths | None = None) -> int:
    paths = _paths(profile)
    if not paths.lance_dir.exists():
        return 0
    db = lancedb.connect(str(paths.lance_dir))
    if CHUNKS_TABLE not in _table_names(db):
        return 0
    return db.open_table(CHUNKS_TABLE).count_rows()
