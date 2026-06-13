"""Safe PyMuPDF text extraction with MuPDF stderr capture."""

from __future__ import annotations

import contextlib
import html
import io
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import fitz

log = logging.getLogger("graph_layout_rag.pdf")

# Line-break hyphen: a lowercase letter, a hyphen, end-of-line, then a lowercase letter.
# Splicing these repairs words split across line/column wraps (``net-\nwork`` -> ``network``)
# while a capitalized or numeric continuation (``IEEE-\n1394``) keeps its hyphen.
_HYPHEN_BREAK = re.compile(r"([a-z])-\n([a-z])")
# Collapse runs of spaces/tabs and 3+ newlines (NFKC can expand some glyphs to spaces).
_MULTISPACE = re.compile(r"[ \t]{2,}")
_MULTINEWLINE = re.compile(r"\n{3,}")


def _dehyphenate(text: str) -> str:
    """Join words split by a hyphen at a line/column break.

    Heuristic: only ``<lower>-\\n<lower>`` is spliced; a capitalized or numeric
    continuation keeps its hyphen (e.g. compound names, identifiers). Tunable.
    """
    return _HYPHEN_BREAK.sub(r"\1\2", text)


def _normalize_unicode(text: str) -> str:
    """NFKC-normalize (folds ``ﬁ``/``ﬂ`` ligatures, CID glyphs) and tidy whitespace."""
    text = unicodedata.normalize("NFKC", text)
    text = _MULTISPACE.sub(" ", text)
    # Strip per-line leading/trailing spaces (sort=True block extraction leaves a leading
    # space on each line), then collapse runs of blank lines.
    text = "\n".join(line.strip(" \t") for line in text.split("\n"))
    text = _MULTINEWLINE.sub("\n\n", text)
    return text


def clean_page_text(text: str) -> str:
    """De-hyphenate then Unicode-normalize a page's extracted text."""
    return _normalize_unicode(_dehyphenate(text)).strip()


def clean_markdown_text(md: str, *, clean: bool) -> str:
    """Post-process Markdown emitted by a backend (Docling, Gemini-vision).

    Unescapes HTML entities (``&amp;`` -> ``&``) that Markdown serializers emit, then
    applies :func:`clean_page_text` when ``clean``. NFKC + de-hyphenation only touch
    ``-\\n`` joins and glyph folding, so Markdown structure (``|``/``#``) is preserved.
    Shared by both Markdown backends so their cleaning stays identical.
    """
    md = html.unescape(md)
    return clean_page_text(md) if clean else md.strip()


@dataclass
class PdfExtractResult:
    pages: list[tuple[int, str]] = field(default_factory=list)
    mupdf_messages: str = ""
    failed_pages: list[int] = field(default_factory=list)
    open_error: str | None = None
    # Tokens billed by an LLM backend (e.g. Gemini-vision); 0 for local backends.
    tokens: int = 0

    @property
    def ok(self) -> bool:
        return self.open_error is None and bool(self.pages)

    @property
    def has_font_warnings(self) -> bool:
        low = self.mupdf_messages.lower()
        return "cid font" in low or "font" in low or "syntax error" in low


@contextlib.contextmanager
def _quiet_mupdf_stderr():
    """Suppress MuPDF console noise; capture anything still emitted."""
    restore_errors: bool | None = None
    restore_warnings: bool | None = None
    tools = getattr(fitz, "TOOLS", None)
    if tools is not None:
        try:
            restore_errors = tools.mupdf_display_errors(False)
            restore_warnings = tools.mupdf_display_warnings(False)
        except (AttributeError, TypeError):
            restore_errors = restore_warnings = None

    buf = io.StringIO()
    try:
        with contextlib.redirect_stderr(buf):
            yield buf
    finally:
        if tools is not None:
            try:
                if restore_errors is not None:
                    tools.mupdf_display_errors(restore_errors)
                if restore_warnings is not None:
                    tools.mupdf_display_warnings(restore_warnings)
            except (AttributeError, TypeError):
                pass


def extract_pages_from_path(path: Path, *, clean: bool = True) -> PdfExtractResult:
    """Extract per-page text; tolerate MuPDF font warnings and per-page failures.

    With ``clean=True`` (default), pages are extracted in reading order
    (``sort=True``, the two-column fix) and run through :func:`clean_page_text`
    (de-hyphenation + NFKC normalization). With ``clean=False`` the behavior is the
    legacy bare ``get_text().strip()`` — kept as a true A/B baseline.
    """
    result = PdfExtractResult()
    if not path.is_file():
        result.open_error = "file missing"
        return result

    with _quiet_mupdf_stderr() as mupdf_buf:
        try:
            doc = fitz.open(path)
        except Exception as exc:
            result.open_error = str(exc)
            result.mupdf_messages = mupdf_buf.getvalue().strip()
            return result

        try:
            for i, page in enumerate(doc):
                page_no = i + 1
                try:
                    if clean:
                        text = clean_page_text(page.get_text("text", sort=True))
                    else:
                        text = page.get_text().strip()
                except Exception as exc:
                    result.failed_pages.append(page_no)
                    log.debug("page %d extract failed for %s: %s", page_no, path.name, exc)
                    continue
                if text:
                    result.pages.append((page_no, text))
        finally:
            doc.close()

    result.mupdf_messages = mupdf_buf.getvalue().strip()
    return result
