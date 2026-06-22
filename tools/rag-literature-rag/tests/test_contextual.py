import json

from rag_common.local_llm import llm_backend
from rag_literature_rag.ingest import contextual
from rag_literature_rag.ingest.chunk import TextChunk


def _chunk() -> TextChunk:
    return TextChunk(
        doc_id="doc-1",
        title="A RAG Paper",
        text="This chunk discusses HyDE query expansion.",
        page=1,
        chunk_index=0,
        source_url="https://example.test/paper.pdf",
        year=2026,
        tags=["query-expansion"],
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
    monkeypatch.setattr(contextual, "_generate_context", lambda *args: "Covers HyDE query expansion.")
    monkeypatch.setattr(contextual, "_context_workers", lambda: 1)

    texts = contextual.augment_texts_for_context([_chunk()], ["plain text"])

    assert texts == ["Context: Covers HyDE query expansion.\nplain text"]
    data = json.loads(cache_path.read_text(encoding="utf-8"))
    model = contextual._context_model()
    backend = llm_backend()
    expected_key = f"rag-v2:{backend}:{model}:abc:0"
    assert data == {expected_key: "Covers HyDE query expansion."}


def test_contextual_cache_key_scopes_backend_and_model():
    chunk = _chunk()

    assert contextual._cache_key(chunk, backend="ollama", model="gemma4:e4b") != contextual._cache_key(
        chunk,
        backend="gemini",
        model="gemini-2.5-flash",
    )


def test_contextual_ollama_model_identity_uses_active_ollama_model(monkeypatch):
    monkeypatch.setenv("RAG_LLM_BACKEND", "ollama")
    monkeypatch.setenv("RAG_OLLAMA_MODEL", "gemma4:e4b")

    assert contextual._context_model() == "gemma4:e4b"
