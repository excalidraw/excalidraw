import lancedb

from rag_common.config import EmbedConfig
from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.ingest.doc_summary import (
    DocumentSummary,
    PROMPT_VERSION,
    SummaryCacheStats,
    build_document_summary,
    summary_cache_key,
)
from rag_literature_rag.ingest.index import chunk_count, summary_count, upsert_chunks, upsert_summaries
from rag_literature_rag.manifest import ManifestItem
from rag_literature_rag.paths import CHUNKS_TABLE, SUMMARIES_TABLE, ProfileIndexPaths


def _item() -> ManifestItem:
    return ManifestItem(
        id="doc",
        title="Doc Summary Paper",
        source="test",
        url="https://example.test/doc.pdf",
        localPath="data/raw/pdf/doc.pdf",
        status="ok",
        sha256="pdf-sha",
        tags=["rag"],
        authors=["A. Author"],
        year=2026,
    )


def _chunk(idx: int = 0) -> TextChunk:
    return TextChunk(
        doc_id="doc",
        title="Doc Summary Paper",
        text=f"This paper studies retrieval summaries and evaluates BM25 plus dense search. chunk {idx}",
        page=idx + 1,
        chunk_index=idx,
        source_url="https://example.test/doc.pdf",
        year=2026,
        tags=["rag"],
        authors=["A. Author"],
        pipeline_categories=["engineering"],
        canonical_sha256="pdf-sha",
    )


def test_docsummary_cache_key_changes_on_required_inputs():
    base = {
        "pdf_sha256": "pdf-a",
        "model": "gemma4:e4b",
        "prompt_version": PROMPT_VERSION,
        "extraction_options": {"backend": "docling", "tables": "true"},
        "source_hash": "source-a",
    }
    original = summary_cache_key(**base)

    for field, value in (
        ("pdf_sha256", "pdf-b"),
        ("model", "other-model"),
        ("prompt_version", "prompt-v2"),
        ("extraction_options", {"backend": "docling", "tables": "false"}),
        ("source_hash", "source-b"),
    ):
        changed = dict(base)
        changed[field] = value
        assert summary_cache_key(**changed) != original


def test_docsummary_generation_uses_separate_cache(tmp_path, monkeypatch):
    monkeypatch.setattr("rag_literature_rag.ingest.doc_summary.CACHE_DIR", tmp_path / "docsummary_cache")
    monkeypatch.setattr("rag_literature_rag.ingest.doc_summary.docsummary_model", lambda: "gemma4:e4b")
    calls = {"count": 0}

    def fake_generate(prompt: str, *, model: str) -> str:
        calls["count"] += 1
        assert "problem, methods, datasets" in prompt
        assert model == "gemma4:e4b"
        return (
                "This grounded retrieval summary describes the paper problem, BM25 and dense retrieval "
                "methods, evaluated datasets, important acronyms, reported findings, known aliases, "
                "and limitations without adding unsupported claims beyond the supplied source text. "
                "It preserves retrieval terminology and connects the document to relevant query language."
            )

    monkeypatch.setattr("rag_literature_rag.ingest.doc_summary._generate_ollama", fake_generate)
    stats = SummaryCacheStats()
    first = build_document_summary(
        _item(),
        [_chunk(0), _chunk(1)],
        pdf_sha256="pdf-sha",
        extraction_options={"backend": "docling"},
        stats=stats,
    )
    second = build_document_summary(
        _item(),
        [_chunk(0), _chunk(1)],
        pdf_sha256="pdf-sha",
        extraction_options={"backend": "docling"},
        stats=stats,
    )

    assert first is not None and second is not None
    assert first.text == second.text
    assert calls["count"] == 1
    assert stats.misses == 1
    assert stats.hits == 1
    assert stats.generated == 1


def test_summary_index_preserves_provenance_without_overwriting_chunks(tmp_path, monkeypatch):
    monkeypatch.setattr("rag_literature_rag.ingest.embed_cache._CACHE_DIR", tmp_path / "embed_cache")
    paths = ProfileIndexPaths(
        "test",
        tmp_path,
        tmp_path / "lance",
        tmp_path / "state.json",
        tmp_path / "bm25",
        tmp_path / "bm25_parent",
        tmp_path / "bm25_summary",
    )
    cfg = EmbedConfig("local", "test", 2)
    monkeypatch.setattr(
        "rag_literature_rag.ingest.index.embed_texts",
        lambda texts, **kwargs: [[float(idx), 1.0] for idx, _ in enumerate(texts)],
    )
    chunks = [_chunk(0)]
    upsert_chunks(chunks, rebuild=True, config=cfg, profile=paths)
    summary = DocumentSummary(
        id="doc:-1",
        doc_id="doc",
        title="Doc Summary Paper",
        text="Document-level summary text.",
        summary_level="document",
        source_chunk_ids=["doc:0"],
        page=1,
        page_end=1,
        section_path="document summary",
        summary_model="gemma4:e4b",
        prompt_version=PROMPT_VERSION,
        canonical_sha256="pdf-sha",
        tags=["rag"],
        pipeline_categories=["engineering"],
        source_url="https://example.test/doc.pdf",
        year=2026,
        authors=["A. Author"],
        source_text_hash="source-hash",
        cache_key="cache-key",
    )
    upsert_summaries([summary], rebuild=True, config=cfg, profile=paths)

    assert chunk_count(paths) == 1
    assert summary_count(paths) == 1
    db = lancedb.connect(str(paths.lance_dir))
    chunk_row = db.open_table(CHUNKS_TABLE).to_pandas().to_dict("records")[0]
    summary_row = db.open_table(SUMMARIES_TABLE).to_pandas().to_dict("records")[0]
    assert chunk_row["text"].startswith("This paper studies")
    assert summary_row["summary_level"] == "document"
    assert summary_row["source_chunk_ids"] == "doc:0"
    assert summary_row["text"] == "Document-level summary text."
