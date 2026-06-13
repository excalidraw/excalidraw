import builtins
from pathlib import Path

import pytest

from graph_layout_rag import docling_text
from graph_layout_rag.ingest import extract as extract_mod
from graph_layout_rag.manifest import ManifestItem
from graph_layout_rag.pdf_text import PdfExtractResult


def _item(tmp_path: Path) -> ManifestItem:
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF-1.4 stub")
    return ManifestItem(
        id="doc1",
        title="T",
        authors=["A"],
        year=2020,
        source="s",
        url="https://example.org/doc1",
        status="ok",
        localPath=str(pdf),
    )


def test_docling_missing_dep_degrades(tmp_path: Path, monkeypatch):
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF-1.4 stub")
    docling_text._converter.cache_clear()

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name.startswith("docling"):
            raise ImportError("no docling")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    result = docling_text.extract_pages_docling(pdf)
    assert result.open_error == "docling not installed"
    assert not result.pages
    docling_text._converter.cache_clear()


def test_docling_missing_file(tmp_path: Path):
    result = docling_text.extract_pages_docling(tmp_path / "nope.pdf")
    assert result.open_error == "file missing"


def test_backend_routes_to_docling(tmp_path: Path, monkeypatch):
    item = _item(tmp_path)
    sentinel = PdfExtractResult(pages=[(1, "docling text")])
    called = {}

    def stub(path, *, clean=True):
        called["path"] = path
        called["clean"] = clean
        return sentinel

    monkeypatch.setattr(
        "graph_layout_rag.docling_text.extract_pages_docling", stub
    )
    result = extract_mod.extract_pdf_result(item, backend="docling")
    assert result is sentinel
    assert called["clean"] is True


def test_backend_routes_to_pymupdf(tmp_path: Path, monkeypatch):
    item = _item(tmp_path)
    sentinel = PdfExtractResult(pages=[(1, "pymupdf text")])

    monkeypatch.setattr(
        "graph_layout_rag.ingest.extract.extract_pages_from_path",
        lambda path, *, clean=True: sentinel,
    )
    result = extract_mod.extract_pdf_result(item, backend="pymupdf")
    assert result is sentinel


def test_unknown_backend_raises(tmp_path: Path):
    item = _item(tmp_path)
    with pytest.raises(ValueError):
        extract_mod.extract_pdf_result(item, backend="bogus")


def test_default_pdf_backend_env(monkeypatch):
    monkeypatch.delenv("GRAPH_RAG_PDF_BACKEND", raising=False)
    assert extract_mod.default_pdf_backend() == "pymupdf"
    monkeypatch.setenv("GRAPH_RAG_PDF_BACKEND", "docling")
    assert extract_mod.default_pdf_backend() == "docling"
    monkeypatch.setenv("GRAPH_RAG_PDF_BACKEND", "bogus")
    assert extract_mod.default_pdf_backend() == "pymupdf"


def test_pipeline_options_defaults(monkeypatch):
    for name in (
        "GRAPH_RAG_DOCLING_OCR",
        "GRAPH_RAG_DOCLING_TABLES",
        "GRAPH_RAG_DOCLING_TIMEOUT_S",
        "GRAPH_RAG_DOCLING_DEVICE",
        "GRAPH_RAG_DOCLING_THREADS",
    ):
        monkeypatch.delenv(name, raising=False)

    options = docling_text._pipeline_options()
    assert options.do_ocr is False
    assert options.do_table_structure is True
    assert options.document_timeout == 600
    assert options.accelerator_options.device == "auto"
    assert options.accelerator_options.num_threads == 2


def test_pipeline_options_valid_overrides(monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_DOCLING_OCR", "1")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_TABLES", "0")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_TIMEOUT_S", "42")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_DEVICE", "cpu")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_THREADS", "7")

    options = docling_text._pipeline_options()
    assert options.do_ocr is True
    assert options.do_table_structure is False
    assert options.document_timeout == 42
    assert options.accelerator_options.device == "cpu"
    assert options.accelerator_options.num_threads == 7


def test_pipeline_options_invalid_values_fall_back(monkeypatch, caplog):
    monkeypatch.setenv("GRAPH_RAG_DOCLING_OCR", "sometimes")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_TABLES", "maybe")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_TIMEOUT_S", "0")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_DEVICE", "tpu")
    monkeypatch.setenv("GRAPH_RAG_DOCLING_THREADS", "many")

    options = docling_text._pipeline_options()
    assert options.do_ocr is False
    assert options.do_table_structure is True
    assert options.document_timeout == 600
    assert options.accelerator_options.device == "auto"
    assert options.accelerator_options.num_threads == 2
    assert caplog.text.count("invalid GRAPH_RAG_DOCLING_") == 5


def test_converter_is_cached_and_configured(monkeypatch):
    calls = []

    class FakeConverter:
        def __init__(self, **kwargs):
            calls.append(kwargs)

    monkeypatch.setattr("docling.document_converter.DocumentConverter", FakeConverter)
    docling_text._converter.cache_clear()
    first = docling_text._converter()
    second = docling_text._converter()
    assert first is second
    assert len(calls) == 1
    assert calls[0]["format_options"]
    docling_text._converter.cache_clear()
