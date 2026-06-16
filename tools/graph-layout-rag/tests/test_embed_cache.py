from pathlib import Path

import graph_layout_rag.ingest.embed_cache as ec
from graph_layout_rag.ingest.chunk import TextChunk
from graph_layout_rag.ingest.index import upsert_chunks
from graph_layout_rag.paths import ProfileIndexPaths
from rag_common.config import EmbedConfig


def _redirect_cache(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(ec, "_CACHE_DIR", tmp_path / "embed_cache")


def test_put_get_round_trip(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    key = ec.cache_key(backend="gemini", model="m", dims=3, profile="p", title="T", text="hello")
    ec.put_many([key], [[1.0, 2.0, 3.0]])
    assert ec.get_many([key], dims=3) == [[1.0, 2.0, 3.0]]


def test_miss_returns_none(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    key = ec.cache_key(backend="gemini", model="m", dims=3, profile=None, title=None, text="nope")
    assert ec.get_many([key], dims=3) == [None]


def test_key_changes_with_every_field(monkeypatch, tmp_path: Path):
    base = dict(backend="gemini", model="m", dims=3, profile="p", title="T", text="x")
    k = ec.cache_key(**base)
    assert k != ec.cache_key(**{**base, "backend": "openai"})
    assert k != ec.cache_key(**{**base, "model": "m2"})
    assert k != ec.cache_key(**{**base, "dims": 4})
    assert k != ec.cache_key(**{**base, "profile": "q"})
    assert k != ec.cache_key(**{**base, "title": "U"})
    assert k != ec.cache_key(**{**base, "text": "y"})


def test_dims_mismatch_is_rejected_and_evicted(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    key = ec.cache_key(backend="gemini", model="m", dims=3, profile=None, title=None, text="t")
    ec.put_many([key], [[1.0, 2.0, 3.0]])
    # Reading with a different expected dims should miss and remove the stale entry.
    assert ec.get_many([key], dims=4) == [None]
    assert ec.get_many([key], dims=3) == [None]


def test_corrupt_entry_self_heals(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    key = ec.cache_key(backend="gemini", model="m", dims=3, profile=None, title=None, text="t")
    path = ec._cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{not json", encoding="utf-8")
    assert ec.get_many([key], dims=3) == [None]
    assert not path.exists()


def test_partial_batch_preserves_order(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    keys = [
        ec.cache_key(backend="g", model="m", dims=2, profile=None, title=None, text=t)
        for t in ("a", "b", "c")
    ]
    # Only the middle one is cached.
    ec.put_many([keys[1]], [[9.0, 9.0]])
    got = ec.get_many(keys, dims=2)
    assert got == [None, [9.0, 9.0], None]


def test_cache_stats_counts_entries(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    assert ec.cache_stats() == {"entries": 0, "size_mb": 0}
    keys = [
        ec.cache_key(backend="g", model="m", dims=2, profile=None, title=None, text=t)
        for t in ("a", "b")
    ]
    ec.put_many(keys, [[1.0, 1.0], [2.0, 2.0]])
    assert ec.cache_stats()["entries"] == 2


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


def test_upsert_chunks_uses_cache_on_second_pass(monkeypatch, tmp_path: Path):
    _redirect_cache(monkeypatch, tmp_path)
    paths = ProfileIndexPaths(
        "test", tmp_path, tmp_path / "lance", tmp_path / "state.json", tmp_path / "bm25"
    )
    cfg = EmbedConfig("local", "test", 2)

    embedded: list[list[str]] = []

    def fake_embed(texts, **kwargs):
        embedded.append(list(texts))
        return [[float(i), 1.0] for i, _ in enumerate(texts)]

    monkeypatch.setattr("graph_layout_rag.ingest.index.embed_texts", fake_embed)

    chunks = [_chunk(0), _chunk(1), _chunk(2)]
    upsert_chunks(chunks, rebuild=True, config=cfg, profile=paths)
    # First pass embeds all three.
    assert embedded and len(embedded[0]) == 3

    embedded.clear()
    # Second pass (e.g. a --force/--rebuild re-ingest): identical chunk text +
    # embed config means the cache serves every vector, no embed API call.
    upsert_chunks(chunks, rebuild=True, config=cfg, profile=paths)
    assert embedded == []
