from __future__ import annotations

from dataclasses import dataclass

import fitz

from graph_layout_rag.manifest import ManifestItem
from graph_layout_rag.paths import PKG_ROOT


@dataclass
class PageText:
    page: int
    text: str


def extract_pdf_pages(item: ManifestItem) -> list[PageText]:
    if not item.localPath:
        return []
    path = PKG_ROOT / item.localPath
    doc = fitz.open(path)
    try:
        pages: list[PageText] = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            if text:
                pages.append(PageText(page=i + 1, text=text))
        return pages
    finally:
        doc.close()


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
