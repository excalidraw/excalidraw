from pathlib import Path

from graph_layout_rag.ingest import bm25
from graph_layout_rag.ingest.chunk import TextChunk
from graph_layout_rag.ingest.index import chunk_count, upsert_chunks
from graph_layout_rag.paths import ProfileIndexPaths
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
    paths = ProfileIndexPaths("test", tmp_path, tmp_path / "lance", tmp_path / "state.json", tmp_path / "bm25")
    cfg = EmbedConfig("local", "test", 2)
    monkeypatch.setattr(
        "graph_layout_rag.ingest.index.embed_texts",
        lambda texts, **kwargs: [[float(idx), 1.0] for idx, _ in enumerate(texts)],
    )
    upsert_chunks([_chunk(0), _chunk(1), _chunk(2)], rebuild=True, config=cfg, profile=paths)
    upsert_chunks([_chunk(0)], config=cfg, profile=paths)
    assert chunk_count(paths) == 1
