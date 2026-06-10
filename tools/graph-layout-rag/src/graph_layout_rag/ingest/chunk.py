from __future__ import annotations

from dataclasses import dataclass

from graph_layout_rag.ingest.extract import PageText
from graph_layout_rag.manifest import ManifestItem

CHUNK_CHARS = 4000
OVERLAP_CHARS = 600


@dataclass
class TextChunk:
    doc_id: str
    title: str
    text: str
    page: int | None
    chunk_index: int
    source_url: str
    year: int | None
    tags: list[str]
    authors: list[str]


def _split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks


def chunk_pages(item: ManifestItem, pages: list[PageText]) -> list[TextChunk]:
    chunks: list[TextChunk] = []
    idx = 0
    for page in pages:
        for part in _split_text(page.text, CHUNK_CHARS, OVERLAP_CHARS):
            chunks.append(
                TextChunk(
                    doc_id=item.id,
                    title=item.title,
                    text=part,
                    page=page.page,
                    chunk_index=idx,
                    source_url=item.url,
                    year=item.year,
                    tags=item.tags,
                    authors=item.authors,
                )
            )
            idx += 1
    return chunks


def chunk_metadata(item: ManifestItem, text: str) -> list[TextChunk]:
    return [
        TextChunk(
            doc_id=item.id,
            title=item.title,
            text=text,
            page=None,
            chunk_index=0,
            source_url=item.url,
            year=item.year,
            tags=item.tags,
            authors=item.authors,
        )
    ]
