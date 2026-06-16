from pathlib import Path
from unittest.mock import MagicMock, patch

from rag_literature_rag.pdf_text import (
    PdfExtractResult,
    _dehyphenate,
    _normalize_unicode,
    clean_page_text,
    extract_pages_from_path,
)


def test_dehyphenate_joins_lowercase_break():
    assert _dehyphenate("net-\nwork layout") == "network layout"


def test_dehyphenate_keeps_capitalized_or_numeric_continuation():
    # Capitalized continuation (compound/identifier) and numeric stay hyphenated.
    assert _dehyphenate("IEEE-\n1394 bus") == "IEEE-\n1394 bus"
    assert _dehyphenate("Force-\nDirected") == "Force-\nDirected"


def test_normalize_unicode_folds_ligatures_and_whitespace():
    assert _normalize_unicode("ﬁgure") == "figure"  # ﬁ ligature -> "fi"
    assert _normalize_unicode("a    b") == "a b"
    assert _normalize_unicode("a\n\n\n\nb") == "a\n\nb"


def test_clean_page_text_composes_dehyphenate_and_normalize():
    raw = "strati-\nfied   ﬁgure\n\n\n\ndrawing"
    assert clean_page_text(raw) == "stratified figure\n\ndrawing"


def test_extract_missing_file(tmp_path: Path):
    result = extract_pages_from_path(tmp_path / "missing.pdf")
    assert result.open_error == "file missing"
    assert not result.pages


def test_extract_captures_pages(tmp_path: Path):
    pdf = tmp_path / "tiny.pdf"
    # Minimal valid-enough stub: use fitz to create a real one-page PDF
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "hello graph layout")
    doc.save(pdf)
    doc.close()

    result = extract_pages_from_path(pdf)
    assert result.open_error is None
    assert len(result.pages) == 1
    assert "hello graph layout" in result.pages[0][1]


def test_clean_vs_raw_dehyphenation_on_real_pdf(tmp_path: Path):
    pdf = tmp_path / "hyphen.pdf"
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    # A hyphenated word split across two lines, as PDFs do at column wraps.
    page.insert_text((72, 72), "strati-\nfied drawing")
    doc.save(pdf)
    doc.close()

    raw = extract_pages_from_path(pdf, clean=False)
    clean = extract_pages_from_path(pdf, clean=True)
    assert "strati-\nfied" in raw.pages[0][1]
    assert "stratified drawing" in clean.pages[0][1]


def test_has_font_warnings():
    r = PdfExtractResult(mupdf_messages="MuPDF error: syntax error: unknown cid font type")
    assert r.has_font_warnings


def test_per_page_failure_continues(tmp_path: Path):
    pdf = tmp_path / "paper.pdf"
    pdf.write_bytes(b"%PDF-1.4 stub")

    good_page = MagicMock()
    good_page.get_text.return_value = "recovered text"
    bad_page = MagicMock()
    bad_page.get_text.side_effect = RuntimeError("bad page")

    mock_doc = MagicMock()
    mock_doc.__iter__ = MagicMock(return_value=iter([bad_page, good_page]))
    mock_doc.close = MagicMock()

    with patch("rag_literature_rag.pdf_text.fitz.open", return_value=mock_doc):
        result = extract_pages_from_path(pdf)

    assert result.failed_pages == [1]
    assert result.pages == [(2, "recovered text")]
