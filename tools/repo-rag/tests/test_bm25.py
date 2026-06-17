"""Regression tests for the BM25 incremental delete path.

Deleting on the *tokenized* `file_path` field is a silent no-op (the term dict holds
the path's tokens, never the whole path), so every incremental reindex used to leak the
old chunks. The `file_path_raw` (untokenized) field fixes delete-by-file — these tests
pin that behavior so a live watcher can't drift the index.
"""

import repo_rag.ingest.bm25 as bm25
from repo_rag.chunk.types import TextChunk
from repo_rag.paths import ProfileIndexPaths


def _chunk(file_path: str, i: int) -> TextChunk:
    return TextChunk(
        chunk_id=f"{file_path}:{i}",
        file_path=file_path,
        text=f"symbol body number {i} in {file_path}",
        source_type="code",
        package="excalidraw",
        symbol=f"fn{i}",
        kind="function",
        start_line=i + 1,
        chunk_index=i,
    )


def _isolate(tmp_path, monkeypatch):
    paths = ProfileIndexPaths(
        profile="test",
        root=tmp_path,
        lance_dir=tmp_path / "lancedb",
        ingest_state=tmp_path / "ingest_state.json",
        bm25_dir=tmp_path / "bm25",
    )
    monkeypatch.setattr(bm25, "profile_index_paths", lambda profile=None: paths)


def test_delete_by_file_actually_removes_chunks(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    bm25.upsert_chunks(
        [_chunk("pkg/a.ts", i) for i in range(3)] + [_chunk("pkg/b.ts", i) for i in range(2)],
        rebuild=True,
    )
    assert bm25.chunk_count() == 5

    bm25.delete_chunks_for_file("pkg/a.ts")
    assert bm25.chunk_count() == 2  # the 3 a.ts chunks are gone (was a no-op before the fix)


def test_incremental_reindex_does_not_drift(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    bm25.upsert_chunks([_chunk("pkg/a.ts", i) for i in range(3)], rebuild=True)
    assert bm25.chunk_count() == 3

    # Simulate a watcher reindex of a.ts whose content changed (now 4 chunks):
    # purge then re-add, exactly as run.py's incremental path does.
    bm25.delete_chunks_for_file("pkg/a.ts")
    bm25.upsert_chunks([_chunk("pkg/a.ts", i) for i in range(4)], rebuild=False)
    assert bm25.chunk_count() == 4  # not 7 — no leaked duplicates
