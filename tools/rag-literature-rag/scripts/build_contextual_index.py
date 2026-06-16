"""Build the contextual-retrieval index by reusing existing production chunks.

Rather than re-extract + re-chunk every PDF (slow, needs docling), this reads the
already-built chunks from the production ``gemini-2-structure-v1`` LanceDB,
reconstructs TextChunk objects, and calls upsert_chunks under the
``gemini-2-contextual-v1`` profile — which triggers the contextual augmentation
hook (LLM context line per chunk) before embedding. Fair A/B: identical chunks,
only the embed/BM25 text gains a context prefix.
"""
from __future__ import annotations

import sys

import lancedb

from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.ingest.embed import embed_config_from_env
from rag_literature_rag.ingest.index import CHUNKS_TABLE, upsert_chunks
from rag_literature_rag.paths import profile_index_paths

SRC_PROFILE = "gemini-2-structure-v1"
DST_PROFILE = "gemini-2-contextual-v1"


def _split(v) -> list[str]:
    if v is None or (isinstance(v, float) and v != v):  # NaN
        return []
    return [x for x in str(v).split(",") if x]


def _int_or_none(v, *, none_values=(None, -1)) -> int | None:
    if v is None or (isinstance(v, float) and v != v):  # NaN
        return None
    iv = int(v)
    return None if iv in none_values else iv


def _str(v) -> str:
    if v is None or (isinstance(v, float) and v != v):  # NaN
        return ""
    return str(v)


def _row_to_chunk(r: dict) -> TextChunk:
    return TextChunk(
        doc_id=r["doc_id"],
        title=_str(r.get("title")),
        text=_str(r.get("text")),
        page=_int_or_none(r.get("page")),
        chunk_index=_int_or_none(r.get("chunk_index"), none_values=()) or 0,
        source_url=_str(r.get("source_url")),
        year=_int_or_none(r.get("year"), none_values=(None, 0)),
        tags=_split(r.get("tags")),
        authors=_split(r.get("authors")),
        pipeline_categories=_split(r.get("pipeline_categories")),
        page_end=_int_or_none(r.get("page_end")),
        section_path=_str(r.get("section_path")),
        alias_doc_ids=_split(r.get("alias_doc_ids")),
        alias_source_urls=_split(r.get("alias_source_urls")),
        alias_dois=_split(r.get("alias_dois")),
        canonical_sha256=_str(r.get("canonical_sha256")),
    )


def main() -> int:
    from rag_literature_rag.env import load_env_file

    load_env_file()  # Vertex creds + RAG_LLM_LOCATION + context model for the LLM/embed calls
    src = profile_index_paths(SRC_PROFILE)
    db = lancedb.connect(str(src.lance_dir))
    rows = db.open_table(CHUNKS_TABLE).to_pandas().drop(columns=["vector"]).to_dict("records")
    print(f"read {len(rows)} chunks from {SRC_PROFILE}", flush=True)

    chunks = [_row_to_chunk(r) for r in rows]
    cfg = embed_config_from_env(profile=DST_PROFILE)
    print(f"embedding under {DST_PROFILE}: backend={cfg.backend} model={cfg.model} dims={cfg.dimensions}", flush=True)

    written = upsert_chunks(chunks, rebuild=True, config=cfg, profile=DST_PROFILE)
    print(f"contextual index written: {written} rows -> {profile_index_paths(DST_PROFILE).root}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
