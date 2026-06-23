import json

from graph_layout_rag.ingest import contextual
from graph_layout_rag.ingest.chunk import TextChunk
from rag_common.local_llm import llm_backend


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
    model = contextual._context_model()
    backend = llm_backend()
    expected_key = f"graph-v1:{backend}:{model}:abc:0"
    assert data == {expected_key: "Covers rank assignment."}


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


def test_contextual_retries_transient_failure_then_succeeds(tmp_path, monkeypatch):
    cache_path = tmp_path / "contextual_cache.json"
    monkeypatch.setattr(contextual, "CACHE_PATH", cache_path)
    monkeypatch.setattr(contextual, "_context_workers", lambda: 1)
    monkeypatch.setattr(contextual.time, "sleep", lambda *_: None)

    calls = {"n": 0}

    def _flaky(*args):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("429 RESOURCE_EXHAUSTED")
        return "Covers rank assignment."

    monkeypatch.setattr(contextual, "_generate_context", _flaky)

    texts = contextual.augment_texts_for_context([_chunk()], ["plain text"])

    assert texts == ["Context: Covers rank assignment.\nplain text"]
    assert calls["n"] == 2


def test_contextual_hard_failure_falls_back_to_raw_chunk(tmp_path, monkeypatch):
    cache_path = tmp_path / "contextual_cache.json"
    monkeypatch.setattr(contextual, "CACHE_PATH", cache_path)
    monkeypatch.setattr(contextual, "_context_workers", lambda: 1)
    monkeypatch.setattr(contextual.time, "sleep", lambda *_: None)

    def _always_fails(*args):
        raise RuntimeError("not retryable: invalid request")

    monkeypatch.setattr(contextual, "_generate_context", _always_fails)

    texts = contextual.augment_texts_for_context([_chunk()], ["plain text"])

    assert texts == ["plain text"]
    assert json.loads(cache_path.read_text(encoding="utf-8")) == {}
