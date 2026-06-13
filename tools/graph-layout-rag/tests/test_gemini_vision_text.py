import types
from pathlib import Path

import pytest

from graph_layout_rag import gemini_vision_text
from graph_layout_rag.ingest import extract as extract_mod
from graph_layout_rag.manifest import ManifestItem
from graph_layout_rag.pdf_text import PdfExtractResult


def _n_page_pdf(tmp_path: Path, n: int = 1) -> Path:
    import fitz

    pdf = tmp_path / "doc.pdf"
    doc = fitz.open()
    for i in range(n):
        page = doc.new_page()
        page.insert_text((72, 72), f"graph layout page {i + 1}")
    doc.save(pdf)
    doc.close()
    return pdf


def _one_page_pdf(tmp_path: Path) -> Path:
    return _n_page_pdf(tmp_path, 1)


def _item(pdf: Path) -> ManifestItem:
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


class _FakeUsage:
    total_token_count = 1234


class _FakeResp:
    def __init__(self, text: str):
        self.text = text
        self.usage_metadata = _FakeUsage()


def _fake_client(markdown: str):
    """A stand-in google-genai client whose generate_content returns canned Markdown."""

    def generate_content(*, model, contents):  # noqa: ARG001
        return _FakeResp(markdown)

    models = types.SimpleNamespace(generate_content=generate_content)
    return types.SimpleNamespace(models=models)


def _fake_async_client(markdown: str, *, counter: dict | None = None):
    """A stand-in client exposing ``client.aio.models.generate_content`` (awaitable)."""

    async def generate_content(*, model, contents):  # noqa: ARG001
        if counter is not None:
            counter["calls"] = counter.get("calls", 0) + 1
        return _FakeResp(markdown)

    aio_models = types.SimpleNamespace(generate_content=generate_content)
    return types.SimpleNamespace(aio=types.SimpleNamespace(models=aio_models))


def test_missing_file(tmp_path: Path):
    result = gemini_vision_text.extract_pages_gemini(tmp_path / "nope.pdf")
    assert result.open_error == "file missing"


def test_unconfigured_client_degrades(tmp_path: Path, monkeypatch):
    pdf = _one_page_pdf(tmp_path)
    gemini_vision_text._client.cache_clear()

    def boom():
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is missing")

    monkeypatch.setattr(gemini_vision_text, "_client", boom)
    result = gemini_vision_text.extract_pages_gemini(pdf)
    assert result.open_error.startswith("gemini not configured")
    assert not result.pages


def test_transcribes_with_fake_client(tmp_path: Path, monkeypatch):
    pdf = _one_page_pdf(tmp_path)
    monkeypatch.setenv("GRAPH_RAG_GEMINI_VISION_CONCURRENCY", "1")  # exercise the sync path
    gemini_vision_text._client.cache_clear()

    # Skip the real google.genai types import in _transcribe_page.
    monkeypatch.setattr(
        gemini_vision_text,
        "_transcribe_page",
        lambda client, png: ("## Heading\n\nAT&amp;T paper", 1234),
    )
    monkeypatch.setattr(gemini_vision_text, "_client", lambda: _fake_client(""))

    result = gemini_vision_text.extract_pages_gemini(pdf, clean=True)
    assert result.open_error is None
    assert len(result.pages) == 1
    page_no, text = result.pages[0]
    assert page_no == 1
    assert "## Heading" in text
    assert "AT&T paper" in text  # entity unescaped by clean_markdown_text
    assert result.tokens == 1234


def test_clean_false_skips_normalization(tmp_path: Path, monkeypatch):
    pdf = _one_page_pdf(tmp_path)
    monkeypatch.setenv("GRAPH_RAG_GEMINI_VISION_CONCURRENCY", "1")
    gemini_vision_text._client.cache_clear()
    monkeypatch.setattr(
        gemini_vision_text,
        "_transcribe_page",
        lambda client, png: ("ﬁgure   spaced", 0),
    )
    monkeypatch.setattr(gemini_vision_text, "_client", lambda: _fake_client(""))

    result = gemini_vision_text.extract_pages_gemini(pdf, clean=False)
    # clean=False: only html.unescape + strip; the ligature/whitespace survive.
    assert result.pages[0][1] == "ﬁgure   spaced"


def test_parallel_path_transcribes_all_pages_in_order(tmp_path: Path, monkeypatch):
    pdf = _n_page_pdf(tmp_path, 3)
    monkeypatch.setenv("GRAPH_RAG_GEMINI_VISION_CONCURRENCY", "4")  # async pool path
    gemini_vision_text._client.cache_clear()
    counter: dict = {}
    monkeypatch.setattr(
        gemini_vision_text, "_client", lambda: _fake_async_client("## P", counter=counter)
    )

    result = gemini_vision_text.extract_pages_gemini(pdf, clean=True)
    assert result.open_error is None
    assert [p for p, _t in result.pages] == [1, 2, 3]  # ordered despite concurrency
    assert counter["calls"] == 3  # one async call per page
    assert result.tokens == 3 * 1234  # tokens summed across pages
    assert not result.failed_pages


def test_concurrency_clamped_to_hard_cap(monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_GEMINI_VISION_CONCURRENCY", "9999")
    assert gemini_vision_text._concurrency() == gemini_vision_text.MAX_CONCURRENCY
    monkeypatch.setenv("GRAPH_RAG_GEMINI_VISION_CONCURRENCY", "0")
    assert gemini_vision_text._concurrency() == 1  # floor
    monkeypatch.setenv("GRAPH_RAG_GEMINI_VISION_CONCURRENCY", "16")
    assert gemini_vision_text._concurrency() == 16  # in-range passthrough


def test_backend_routes_to_gemini(tmp_path: Path, monkeypatch):
    pdf = _one_page_pdf(tmp_path)
    item = _item(pdf)
    sentinel = PdfExtractResult(pages=[(1, "vision text")])

    monkeypatch.setattr(
        "graph_layout_rag.gemini_vision_text.extract_pages_gemini",
        lambda path, *, clean=True: sentinel,
    )
    result = extract_mod.extract_pdf_result(item, backend="gemini")
    assert result is sentinel


def test_default_pdf_backend_accepts_gemini(monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_PDF_BACKEND", "gemini")
    assert extract_mod.default_pdf_backend() == "gemini"
