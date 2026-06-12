from __future__ import annotations

import logging
from dataclasses import dataclass

from graph_layout_rag.manifest import ManifestItem
from graph_layout_rag.paths import PKG_ROOT
from graph_layout_rag.pdf_text import PdfExtractResult, extract_pages_from_path

log = logging.getLogger("graph_layout_rag.ingest.extract")


@dataclass
class PageText:
    page: int
    text: str


def extract_pdf_result(item: ManifestItem) -> PdfExtractResult:
    if not item.localPath:
        return PdfExtractResult(open_error="no localPath")
    return extract_pages_from_path(PKG_ROOT / item.localPath)


def extract_pdf_pages(item: ManifestItem) -> list[PageText]:
    result = extract_pdf_result(item)
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
