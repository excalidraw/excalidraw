"""Safe PyMuPDF text extraction with MuPDF stderr capture."""

from __future__ import annotations

import contextlib
import io
import logging
from dataclasses import dataclass, field
from pathlib import Path

import fitz

log = logging.getLogger("graph_layout_rag.pdf")


@dataclass
class PdfExtractResult:
    pages: list[tuple[int, str]] = field(default_factory=list)
    mupdf_messages: str = ""
    failed_pages: list[int] = field(default_factory=list)
    open_error: str | None = None

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


def extract_pages_from_path(path: Path) -> PdfExtractResult:
    """Extract per-page text; tolerate MuPDF font warnings and per-page failures."""
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
