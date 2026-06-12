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
    pipeline_categories: list[str]


def embed_input_text(chunk: TextChunk) -> str:
    """Rich prefix for embedding (stored text remains chunk.text)."""
    topics = ", ".join(chunk.pipeline_categories) if chunk.pipeline_categories else ""
    tags = ", ".join(chunk.tags) if chunk.tags else ""
    header = f"Title: {chunk.title}\n"
    if topics:
        header += f"Topics: {topics}\n"
    if tags:
        header += f"Tags: {tags}\n"
    return f"{header}---\n{chunk.text}"


def _make_chunk(
    item: ManifestItem,
    *,
    text: str,
    page: int | None,
    chunk_index: int,
    pipeline_categories: list[str],
) -> TextChunk:
    merged_tags = sorted(set(item.tags) | set(pipeline_categories))
    return TextChunk(
        doc_id=item.id,
        title=item.title,
        text=text,
        page=page,
        chunk_index=chunk_index,
        source_url=item.url,
        year=item.year,
        tags=merged_tags,
        authors=item.authors,
        pipeline_categories=pipeline_categories,
    )


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


def chunk_pages(
    item: ManifestItem,
    pages: list[PageText],
    *,
    pipeline_categories: list[str] | None = None,
) -> list[TextChunk]:
    cats = pipeline_categories or []
    chunks: list[TextChunk] = []
    idx = 0
    for page in pages:
        for part in _split_text(page.text, CHUNK_CHARS, OVERLAP_CHARS):
            chunks.append(
                _make_chunk(
                    item,
                    text=part,
                    page=page.page,
                    chunk_index=idx,
                    pipeline_categories=cats,
                )
            )
            idx += 1
    return chunks


def chunk_metadata(
    item: ManifestItem,
    text: str,
    *,
    pipeline_categories: list[str] | None = None,
) -> list[TextChunk]:
    return [
        _make_chunk(
            item,
            text=text,
            page=None,
            chunk_index=0,
            pipeline_categories=pipeline_categories or [],
        )
    ]
