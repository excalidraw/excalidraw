import json

from graph_layout_rag.ingest import contextual
from graph_layout_rag.ingest.chunk import TextChunk


def _chunk() -> TextChunk:
    return TextChunk(
        doc_id="doc-1",
        title="A Layout Paper",
        text="This chunk discusses rank assignment.",
        page=1,
        chunk_index=0,
        source_url="https://example.test/paper.pdf",
        year=2026,
        tags=["layer-assignment"],
        authors=[],
        pipeline_categories=[],
        canonical_sha256="abc",
    )


def test_contextual_cache_does_not_persist_empty_failures(tmp_path, monkeypatch):
    cache_path = tmp_path / "contextual_cache.json"
    monkeypatch.setattr(contextual, "CACHE_PATH", cache_path)
    monkeypatch.setattr(contextual, "_generate_context", lambda *args: "")
    monkeypatch.setattr(contextual, "_context_workers", lambda: 1)

    texts = contextual.augment_texts_for_context([_chunk()], ["plain text"])

    assert texts == ["plain text"]
    assert json.loads(cache_path.read_text(encoding="utf-8")) == {}


def test_contextual_cache_persists_success(tmp_path, monkeypatch):
    cache_path = tmp_path / "contextual_cache.json"
    monkeypatch.setattr(contextual, "CACHE_PATH", cache_path)
    monkeypatch.setattr(contextual, "_generate_context", lambda *args: "Covers rank assignment.")
    monkeypatch.setattr(contextual, "_context_workers", lambda: 1)

    texts = contextual.augment_texts_for_context([_chunk()], ["plain text"])

    assert texts == ["Context: Covers rank assignment.\nplain text"]
    data = json.loads(cache_path.read_text(encoding="utf-8"))
    assert data == {"abc:0": "Covers rank assignment."}
