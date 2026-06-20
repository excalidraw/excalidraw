from pathlib import Path

import lancedb

from rag_literature_rag.ingest import bm25
from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.ingest.index import chunk_count, upsert_chunks
from rag_literature_rag.paths import CHUNKS_TABLE, ProfileIndexPaths
from rag_common.config import EmbedConfig


def _chunk(idx: int) -> TextChunk:
    return TextChunk(
        doc_id="doc",
        title="Doc",
        text=f"body {idx}",
        page=1,
        chunk_index=idx,
        source_url="https://example.test",
        year=2020,
        tags=[],
        authors=[],
        pipeline_categories=[],
    )


def test_bm25_replacement_removes_stale_tail(tmp_path: Path):
    index = tmp_path / "bm25"
    bm25.upsert_chunks([_chunk(0), _chunk(1), _chunk(2)], ["a", "b", "stale"], index_dir=index, rebuild=True)
    bm25.upsert_chunks([_chunk(0)], ["fresh"], index_dir=index)
    assert bm25.chunk_count(index) == 1
    assert bm25.search_bm25("stale", index_dir=index) == []


def test_lancedb_replacement_removes_stale_tail(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("rag_literature_rag.ingest.embed_cache._CACHE_DIR", tmp_path / "embed_cache")
    paths = ProfileIndexPaths("test", tmp_path, tmp_path / "lance", tmp_path / "state.json", tmp_path / "bm25")
    cfg = EmbedConfig("local", "test", 2)
    monkeypatch.setattr(
        "rag_literature_rag.ingest.index.embed_texts",
        lambda texts, **kwargs: [[float(idx), 1.0] for idx, _ in enumerate(texts)],
    )
    upsert_chunks([_chunk(0), _chunk(1), _chunk(2)], rebuild=True, config=cfg, profile=paths)
    upsert_chunks([_chunk(0)], config=cfg, profile=paths)
    assert chunk_count(paths) == 1


def test_lancedb_append_filters_new_fields_for_old_schema(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("rag_literature_rag.ingest.embed_cache._CACHE_DIR", tmp_path / "embed_cache")
    paths = ProfileIndexPaths("test", tmp_path, tmp_path / "lance", tmp_path / "state.json", tmp_path / "bm25")
    cfg = EmbedConfig("local", "test", 2)
    monkeypatch.setattr(
        "rag_literature_rag.ingest.index.embed_texts",
        lambda texts, **kwargs: [[float(idx), 1.0] for idx, _ in enumerate(texts)],
    )

    paths.lance_dir.mkdir(parents=True)
    db = lancedb.connect(str(paths.lance_dir))
    db.create_table(
        CHUNKS_TABLE,
        data=[
            {
                "id": "doc:99",
                "doc_id": "doc",
                "title": "Doc",
                "text": "stale",
                "page": 1,
                "chunk_index": 99,
                "source_url": "https://example.test",
                "year": 2020,
                "page_end": None,
                "section_path": "",
                "alias_doc_ids": "",
                "alias_source_urls": "",
                "alias_dois": "",
                "canonical_sha256": None,
                "tags": "",
                "pipeline_categories": "",
                "authors": "",
                "vector": [0.0, 1.0],
            }
        ],
    )

    upsert_chunks([_chunk(0)], config=cfg, profile=paths)
    assert chunk_count(paths) == 1
