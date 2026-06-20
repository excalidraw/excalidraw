"""Tantivy BM25 lexical index for rag-literature-rag, paired with the dense LanceDB index.

Built during ingest (one index per embed profile, under ``{profile}/bm25/``) so it stays
in lock-step with the vector table and the ``--rebuild`` / resume semantics. Query-time
fusion lives in :mod:`rag_literature_rag.query.hybrid`. Rows mirror the LanceDB row shape
(comma-joined ``tags`` / ``pipeline_categories``, int ``year`` / ``page``) so dense and
sparse hits merge and render through the same code path.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import tantivy

from rag_literature_rag.ingest.chunk import TextChunk

# Sentinels for nullable integer fields (tantivy integers cannot be None).
_NO_YEAR = 0
_NO_PAGE = -1

_QUERY_FIELDS = ["title", "text", "tags", "pipeline_categories", "section_path"]


def _build_schema() -> tantivy.Schema:
    sb = tantivy.SchemaBuilder()
    sb.add_text_field("id", stored=True)
    sb.add_text_field("doc_id", stored=True)
    sb.add_text_field("title", stored=True)
    sb.add_text_field("text", stored=True)
    sb.add_text_field("tags", stored=True)
    sb.add_text_field("pipeline_categories", stored=True)
    sb.add_text_field("section_path", stored=True)
    sb.add_text_field("alias_doc_ids", stored=True)
    sb.add_text_field("alias_source_urls", stored=True)
    sb.add_text_field("alias_dois", stored=True)
    sb.add_text_field("canonical_sha256", stored=True)
    sb.add_text_field("source_url", stored=True)
    sb.add_integer_field("year", stored=True)
    sb.add_integer_field("page", stored=True)
    sb.add_integer_field("page_end", stored=True)
    return sb.build()


def _open_or_create_index(index_dir: Path) -> tantivy.Index:
    index_dir.mkdir(parents=True, exist_ok=True)
    return tantivy.Index(_build_schema(), path=str(index_dir))


def delete_doc_ids(index: tantivy.Index, doc_ids: set[str]) -> None:
    """Delete complete document rows so shorter replacements cannot leave stale tails."""
    if not doc_ids:
        return
    writer = index.writer()
    for doc_id in doc_ids:
        writer.delete_documents("doc_id", doc_id)
    writer.commit()
    index.reload()


def upsert_chunks(
    chunks: list[TextChunk],
    index_texts: list[str],
    *,
    index_dir: Path,
    rebuild: bool = False,
) -> int:
    """Index ``chunks`` for BM25. ``index_texts[i]`` is the searchable body for ``chunks[i]``
    (the same enriched text used for embedding, so lexical and dense see one surface form)."""
    if rebuild and index_dir.exists():
        shutil.rmtree(index_dir)
    if not chunks:
        return 0
    if len(index_texts) != len(chunks):
        raise ValueError(f"index_texts {len(index_texts)} != chunks {len(chunks)}")

    index = _open_or_create_index(index_dir)
    delete_doc_ids(index, {chunk.doc_id for chunk in chunks})
    writer = index.writer()
    for chunk, body in zip(chunks, index_texts):
        chunk_id = f"{chunk.doc_id}:{chunk.chunk_index}"
        # Replace any prior row for this id (incremental re-ingest).
        writer.delete_documents("id", chunk_id)
        writer.add_document(
            tantivy.Document(
                id=chunk_id,
                doc_id=chunk.doc_id,
                title=chunk.title or "",
                text=body,
                tags=",".join(chunk.tags),
                pipeline_categories=",".join(chunk.pipeline_categories),
                section_path=chunk.section_path,
                alias_doc_ids=",".join(chunk.alias_doc_ids),
                alias_source_urls=",".join(chunk.alias_source_urls),
                alias_dois=",".join(chunk.alias_dois),
                canonical_sha256=chunk.canonical_sha256 or "",
                source_url=chunk.source_url or "",
                year=chunk.year if chunk.year is not None else _NO_YEAR,
                page=chunk.page if chunk.page is not None else _NO_PAGE,
                page_end=chunk.page_end if chunk.page_end is not None else _NO_PAGE,
            )
        )
    writer.commit()
    index.reload()
    return len(chunks)


def search_bm25(query: str, *, index_dir: Path, limit: int = 40) -> list[dict[str, Any]]:
    if not index_dir.exists() or not (index_dir / "meta.json").exists():
        return []
    try:
        index = _open_or_create_index(index_dir)
    except Exception:
        # Older profile indexes may predate fields added to the lexical schema.
        # Dense retrieval remains valid; the next rebuild creates the new schema.
        return []
    index.reload()
    searcher = index.searcher()

    try:
        parsed = index.parse_query(query, _QUERY_FIELDS)
    except Exception:
        # Fall back to a sanitized term query if the raw text has special chars.
        safe = "".join(c if c.isalnum() or c.isspace() else " " for c in query)
        if not safe.strip():
            return []
        parsed = index.parse_query(safe, _QUERY_FIELDS)

    hits = searcher.search(parsed, limit).hits
    results: list[dict[str, Any]] = []
    for score, addr in hits:
        doc = searcher.doc(addr)
        year = doc.get_first("year")
        page = doc.get_first("page")
        page_end = doc.get_first("page_end")
        results.append(
            {
                "score": float(score),
                "id": doc.get_first("id"),
                "doc_id": doc.get_first("doc_id"),
                "title": doc.get_first("title"),
                "text": doc.get_first("text"),
                "tags": doc.get_first("tags") or "",
                "pipeline_categories": doc.get_first("pipeline_categories") or "",
                "section_path": doc.get_first("section_path") or "",
                "alias_doc_ids": doc.get_first("alias_doc_ids") or "",
                "alias_source_urls": doc.get_first("alias_source_urls") or "",
                "alias_dois": doc.get_first("alias_dois") or "",
                "canonical_sha256": doc.get_first("canonical_sha256") or "",
                "source_url": doc.get_first("source_url") or "",
                "year": None if year in (None, _NO_YEAR) else int(year),
                "page": None if page in (None, _NO_PAGE) else int(page),
                "page_end": None if page_end in (None, _NO_PAGE) else int(page_end),
            }
        )
    return results


def chunk_count(index_dir: Path) -> int:
    if not index_dir.exists() or not (index_dir / "meta.json").exists():
        return 0
    try:
        index = _open_or_create_index(index_dir)
    except Exception:
        return 0
    index.reload()
    return int(index.searcher().num_docs)
