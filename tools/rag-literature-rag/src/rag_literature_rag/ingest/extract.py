from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from rag_literature_rag.manifest import ManifestItem
from rag_literature_rag.paths import PKG_ROOT
from rag_literature_rag.pdf_text import PdfExtractResult, extract_pages_from_path

log = logging.getLogger("rag_literature_rag.ingest.extract")

PDF_BACKENDS = ("pymupdf", "docling", "gemini")


def default_pdf_backend() -> str:
    """Backend used unless overridden; opt into Docling via RAG_LIT_PDF_BACKEND."""
    backend = os.getenv("RAG_LIT_PDF_BACKEND", "pymupdf").strip().lower()
    return backend if backend in PDF_BACKENDS else "pymupdf"


@dataclass
class PageText:
    page: int
    text: str


def extract_pdf_result(
    item: ManifestItem, *, clean: bool = True, backend: str = "pymupdf"
) -> PdfExtractResult:
    if not item.localPath:
        return PdfExtractResult(open_error="no localPath")
    path = PKG_ROOT / item.localPath
    if backend == "pymupdf":
        return extract_pages_from_path(path, clean=clean)
    if backend == "docling":
        from rag_literature_rag.docling_text import extract_pages_docling

        return extract_pages_docling(path, clean=clean)
    if backend == "gemini":
        from rag_literature_rag.gemini_vision_text import extract_pages_gemini

        return extract_pages_gemini(path, clean=clean)
    raise ValueError(f"Unknown PDF backend {backend!r}. Choose from: {', '.join(PDF_BACKENDS)}")


def extract_pdf_pages(
    item: ManifestItem, *, clean: bool = True, backend: str = "pymupdf"
) -> list[PageText]:
    result = extract_pdf_result(item, clean=clean, backend=backend)
    if result.open_error:
        log.warning("PDF open failed for %s: %s", item.id, result.open_error)
        return []
    if result.mupdf_messages:
        log.warning(
            "MuPDF messages for %s (%s): %s",
            item.id,
            item.localPath,
            result.mupdf_messages[:400],
        )
    if result.failed_pages:
        log.warning(
            "PDF page extract failures for %s: pages %s",
            item.id,
            result.failed_pages,
        )
    return [PageText(page=page_no, text=text) for page_no, text in result.pages]


def extract_metadata_text(item: ManifestItem) -> str:
    parts = [item.title]
    if item.authors:
        parts.append("Authors: " + ", ".join(item.authors))
    if item.year:
        parts.append(f"Year: {item.year}")
    if item.abstract:
        parts.append(item.abstract)
    if item.doi:
        parts.append(f"DOI: {item.doi}")
    return "\n\n".join(parts)
