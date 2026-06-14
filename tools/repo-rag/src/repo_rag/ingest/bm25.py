from __future__ import annotations

from pathlib import Path

import tantivy

from repo_rag.chunk.prefix import build_prefixed_text
from repo_rag.chunk.types import TextChunk
from repo_rag.paths import BM25_DIR

INDEX_SUBDIR = "index"


def _index_path() -> Path:
    return BM25_DIR / INDEX_SUBDIR


def _open_or_create_index() -> tantivy.Index:
    path = _index_path()
    path.mkdir(parents=True, exist_ok=True)

    schema_builder = tantivy.SchemaBuilder()
    schema_builder.add_text_field("id", stored=True)
    schema_builder.add_text_field("file_path", stored=True)
    # Untokenized mirror of file_path so delete-by-file matches the whole path as a
    # single term. Deleting on the tokenized `file_path` field is a no-op (the term
    # dictionary holds the path's *tokens*, never the full path), which silently
    # leaks stale chunks on every incremental reindex. See delete_chunks_for_file.
    schema_builder.add_text_field("file_path_raw", tokenizer_name="raw")
    schema_builder.add_text_field("symbol", stored=True)
    schema_builder.add_text_field("source_type", stored=True)
    schema_builder.add_text_field("package", stored=True)
    schema_builder.add_text_field("text", stored=True)
    schema_builder.add_text_field("prefixed_text", stored=True)
    schema_builder.add_integer_field("start_line", stored=True)
    schema_builder.add_integer_field("chunk_index", stored=True)
    schema_builder.add_integer_field("is_test", stored=True)
    schema = schema_builder.build()

    if (path / "meta.json").exists():
        return tantivy.Index(schema, path=str(path))
    return tantivy.Index(schema, path=str(path))


def delete_chunks_for_file(file_path: str) -> None:
    if not _index_path().exists():
        return
    index = _open_or_create_index()
    writer = index.writer()
    writer.delete_documents("file_path_raw", file_path)
    writer.commit()
    index.reload()


def upsert_chunks(chunks: list[TextChunk], *, rebuild: bool = False) -> int:
    if rebuild and _index_path().exists():
        import shutil

        shutil.rmtree(_index_path())

    if not chunks:
        return 0

    index = _open_or_create_index()
    writer = index.writer()

    for chunk in chunks:
        prefixed = build_prefixed_text(chunk)
        writer.add_document(
            tantivy.Document(
                id=chunk.chunk_id,
                file_path=chunk.file_path,
                file_path_raw=chunk.file_path,
                symbol=chunk.symbol,
                source_type=chunk.source_type,
                package=chunk.package,
                text=chunk.text,
                prefixed_text=prefixed,
                start_line=chunk.start_line,
                chunk_index=chunk.chunk_index,
                is_test=1 if chunk.is_test else 0,
            )
        )

    writer.commit()
    index.reload()
    return len(chunks)


def search_bm25(
    query: str,
    *,
    limit: int = 40,
    source_type: str | None = None,
    package: str | None = None,
    path_contains: str | None = None,
) -> list[dict]:
    if not _index_path().exists():
        return []

    index = _open_or_create_index()
    index.reload()
    searcher = index.searcher()

    terms = query.strip()
    if source_type:
        terms += f" source_type:{source_type}"
    if package:
        terms += f" package:{package}"
    if path_contains:
        terms += f" {path_contains}"

    try:
        parsed = index.parse_query(terms, ["prefixed_text", "text", "symbol", "file_path"])
    except Exception:
        parsed = index.parse_query(query, ["prefixed_text", "text", "symbol", "file_path"])

    hits = searcher.search(parsed, limit)
    results: list[dict] = []
    seen: set[str] = set()
    for score, doc_address in hits.hits:
        doc = searcher.doc(doc_address)
        chunk_id = doc.get_first("id")
        if chunk_id in seen:
            continue
        seen.add(chunk_id)
        results.append(
            {
                "score": float(score),
                "id": chunk_id,
                "file_path": doc.get_first("file_path"),
                "symbol": doc.get_first("symbol"),
                "source_type": doc.get_first("source_type"),
                "package": doc.get_first("package"),
                "text": doc.get_first("text"),
                "start_line": doc.get_first("start_line"),
                "chunk_index": doc.get_first("chunk_index"),
            }
        )
    return results


def chunk_count() -> int:
    if not _index_path().exists():
        return 0
    index = _open_or_create_index()
    index.reload()
    return int(index.searcher().num_docs)
