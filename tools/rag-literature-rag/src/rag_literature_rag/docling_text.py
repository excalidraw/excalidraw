"""Docling extraction backend — layout-aware Markdown, conforms to PdfExtractResult.

Optional: requires the ``docling`` extra (``uv sync --extra docling``). The import is
lazy so the CLI degrades gracefully when the extra isn't installed, mirroring the
dep-missing fallbacks in ``rag_common/embed.py``.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from rag_literature_rag.pdf_text import PdfExtractResult, clean_markdown_text as _md_text

log = logging.getLogger("rag_literature_rag.docling")

DEFAULT_OCR = False
DEFAULT_TABLES = True
DEFAULT_TIMEOUT_S = 600
DEFAULT_DEVICE = "auto"
DEFAULT_THREADS = 2


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    log.warning("invalid %s=%r; using %s", name, raw, int(default))
    return default


def _env_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
        if value > 0:
            return value
    except ValueError:
        pass
    log.warning("invalid %s=%r; using %d", name, raw, default)
    return default


def _pipeline_options():
    """Build Docling pipeline options from env without constructing a converter."""
    from docling.datamodel.pipeline_options import AcceleratorDevice, AcceleratorOptions
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    device = os.getenv("RAG_LIT_DOCLING_DEVICE", DEFAULT_DEVICE).strip().lower()
    valid_devices = {value.value for value in AcceleratorDevice}
    if device not in valid_devices:
        log.warning(
            "invalid RAG_LIT_DOCLING_DEVICE=%r; using %s",
            device,
            DEFAULT_DEVICE,
        )
        device = DEFAULT_DEVICE

    return PdfPipelineOptions(
        do_ocr=_env_bool("RAG_LIT_DOCLING_OCR", DEFAULT_OCR),
        do_table_structure=_env_bool("RAG_LIT_DOCLING_TABLES", DEFAULT_TABLES),
        document_timeout=_env_positive_int(
            "RAG_LIT_DOCLING_TIMEOUT_S", DEFAULT_TIMEOUT_S
        ),
        accelerator_options=AcceleratorOptions(
            device=device,
            num_threads=_env_positive_int("RAG_LIT_DOCLING_THREADS", DEFAULT_THREADS),
        ),
    )


@lru_cache(maxsize=1)
def _converter():
    """Build one DocumentConverter per process (model load is expensive)."""
    from docling.datamodel.base_models import InputFormat
    from docling.document_converter import DocumentConverter, PdfFormatOption

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=_pipeline_options()),
        }
    )


def extract_pages_docling(path: Path, *, clean: bool = True) -> PdfExtractResult:
    """Extract per-page Markdown via Docling; conform to PdfExtractResult.

    Returns ``open_error="docling not installed"`` when the optional dep is missing,
    so callers never hard-crash.
    """
    result = PdfExtractResult()
    if not path.is_file():
        result.open_error = "file missing"
        return result

    try:
        converter = _converter()
    except ImportError:
        result.open_error = "docling not installed"
        return result

    try:
        doc = converter.convert(path).document
    except Exception as exc:
        result.open_error = str(exc)
        return result

    try:
        num_pages = doc.num_pages()
    except Exception:
        num_pages = 0

    if num_pages:
        for page_no in range(1, num_pages + 1):
            try:
                md = doc.export_to_markdown(page_no=page_no)
            except Exception as exc:
                result.failed_pages.append(page_no)
                log.debug("docling page %d export failed for %s: %s", page_no, path.name, exc)
                continue
            text = _md_text(md, clean=clean)
            if text:
                result.pages.append((page_no, text))

    # Fallback: per-page export unavailable/empty → whole-doc export as a single page.
    if not result.pages:
        try:
            md = doc.export_to_markdown()
        except Exception as exc:
            result.open_error = result.open_error or str(exc)
            return result
        text = _md_text(md, clean=clean)
        if text:
            result.pages.append((1, text))
            log.debug("docling fell back to whole-doc export for %s", path.name)

    return result
