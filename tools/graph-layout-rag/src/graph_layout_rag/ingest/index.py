from __future__ import annotations

import json
from typing import Any

import lancedb

from graph_layout_rag.ingest.chunk import TextChunk
from graph_layout_rag.ingest.embed import embed_texts
from graph_layout_rag.paths import CHUNKS_TABLE, INGEST_STATE_PATH, LANCE_DIR


def load_ingest_state() -> dict[str, str]:
    if not INGEST_STATE_PATH.exists():
        return {}
    return json.loads(INGEST_STATE_PATH.read_text(encoding="utf-8"))


def save_ingest_state(state: dict[str, str]) -> None:
    INGEST_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    INGEST_STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


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


def upsert_chunks(chunks: list[TextChunk], *, rebuild: bool = False) -> int:
    if not chunks:
        return 0

    LANCE_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCE_DIR))

    texts = [c.text for c in chunks]
    vectors = embed_texts(texts)
    rows = [_chunk_row(c, v) for c, v in zip(chunks, vectors)]

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
