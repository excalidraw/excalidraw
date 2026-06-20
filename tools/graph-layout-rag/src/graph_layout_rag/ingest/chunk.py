from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from graph_layout_rag.ingest.extract import PageText
from graph_layout_rag.manifest import ManifestItem

CHUNK_STRATEGY = "markdown-structure-v1"
TARGET_TOKENS = 800
MAX_TOKENS = 1200
MIN_PREFERRED_TOKENS = 200
OVERLAP_TOKENS = 120
DEDUPLICATION_VERSION = "canonical-sha256-v1"

# Kept for compatibility with callers/tests that imported the old constants.
CHUNK_CHARS = MAX_TOKENS * 4
OVERLAP_CHARS = OVERLAP_TOKENS * 4

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_LIST_RE = re.compile(r"^\s*(?:[-+*]|\d+[.)])\s+")
_FENCE_RE = re.compile(r"^\s*(```+|~~~+)")
_FORMULA_RE = re.compile(r"^\s*\$\$\s*$")
_SENTENCE_RE = re.compile(r"(?<=[.!?])(?:[\"')\]]*)\s+")


@dataclass(frozen=True)
class ChunkLimits:
    variant: str
    target_tokens: int
    max_tokens: int
    min_preferred_tokens: int
    overlap_tokens: int


DEFAULT_LIMITS = ChunkLimits(
    "default",
    TARGET_TOKENS,
    MAX_TOKENS,
    MIN_PREFERRED_TOKENS,
    OVERLAP_TOKENS,
)
SMALL2BIG_LIMITS = ChunkLimits(
    "small2big-v1",
    350,
    550,
    120,
    80,
)


def chunk_profile_variant(profile: str | None = None) -> str:
    if profile and "small2big" in profile:
        return SMALL2BIG_LIMITS.variant
    return DEFAULT_LIMITS.variant


def _limits_for_profile(profile: str | None = None) -> ChunkLimits:
    return SMALL2BIG_LIMITS if chunk_profile_variant(profile) == SMALL2BIG_LIMITS.variant else DEFAULT_LIMITS


def is_section_enriched_profile(profile: str | None = None) -> bool:
    return bool(profile and "section-v1" in profile)


def estimate_tokens(text: str) -> int:
    """Fast, deterministic estimate suitable for chunk-size enforcement."""
    return max(1, math.ceil(len(text) / 4)) if text else 0


def chunking_fingerprint(profile: str | None = None) -> dict[str, object]:
    limits = _limits_for_profile(profile)
    fingerprint: dict[str, object] = {
        "strategy": CHUNK_STRATEGY,
        "target_tokens": limits.target_tokens,
        "max_tokens": limits.max_tokens,
        "min_preferred_tokens": limits.min_preferred_tokens,
        "overlap_tokens": limits.overlap_tokens,
        "deduplication_version": DEDUPLICATION_VERSION,
    }
    if limits.variant != DEFAULT_LIMITS.variant:
        fingerprint["variant"] = limits.variant
    return fingerprint


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
    page_end: int | None = None
    section_path: str = ""
    alias_doc_ids: list[str] = field(default_factory=list)
    alias_source_urls: list[str] = field(default_factory=list)
    alias_dois: list[str] = field(default_factory=list)
    canonical_sha256: str | None = None


@dataclass
class StructuralBlock:
    kind: str
    text: str
    page: int
    page_end: int
    section_path: str = ""


def _topics_tags_header(chunk: TextChunk) -> str:
    lines: list[str] = []
    if chunk.section_path:
        lines.append(f"Section: {chunk.section_path}")
    if chunk.pipeline_categories:
        lines.append(f"Topics: {', '.join(chunk.pipeline_categories)}")
    if chunk.tags:
        lines.append(f"Tags: {', '.join(chunk.tags)}")
    return "\n".join(lines) + ("\n" if lines else "")


def embed_input_text(chunk: TextChunk) -> str:
    """Rich prefix for embedding/BM25 while stored text remains readable."""
    return f"Title: {chunk.title}\n{_topics_tags_header(chunk)}---\n{chunk.text}"


def embed_body_text(chunk: TextChunk) -> str:
    """Embedding-2 body; title is supplied separately by the task formatter."""
    header = _topics_tags_header(chunk)
    return f"{header}---\n{chunk.text}" if header else chunk.text


def enrich_texts_for_section(chunks: list[TextChunk], texts: list[str]) -> list[str]:
    enriched: list[str] = []
    for chunk, text in zip(chunks, texts):
        lines = [f"Document: {chunk.title}"]
        if chunk.year:
            lines.append(f"Year: {chunk.year}")
        if chunk.authors:
            lines.append(f"Authors: {', '.join(chunk.authors[:8])}")
        if chunk.source_url:
            lines.append(f"Source URL: {chunk.source_url}")
        if chunk.section_path:
            lines.append(f"Section path: {chunk.section_path}")
        if chunk.pipeline_categories:
            lines.append(f"Categories: {', '.join(chunk.pipeline_categories)}")
        if chunk.tags:
            lines.append(f"Tags: {', '.join(chunk.tags)}")
        if chunk.alias_doc_ids:
            lines.append(f"Alias doc IDs: {', '.join(chunk.alias_doc_ids[:8])}")
        if chunk.alias_dois:
            lines.append(f"Alias DOIs: {', '.join(chunk.alias_dois[:8])}")
        enriched.append("\n".join(lines) + "\n---\n" + text)
    return enriched


def _make_chunk(
    item: ManifestItem,
    *,
    text: str,
    page: int | None,
    chunk_index: int,
    pipeline_categories: list[str],
    page_end: int | None = None,
    section_path: str = "",
    alias_doc_ids: list[str] | None = None,
    alias_source_urls: list[str] | None = None,
    alias_dois: list[str] | None = None,
    canonical_sha256: str | None = None,
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
        page_end=page_end,
        section_path=section_path,
        alias_doc_ids=alias_doc_ids or [],
        alias_source_urls=alias_source_urls or [],
        alias_dois=alias_dois or [],
        canonical_sha256=canonical_sha256 or item.sha256,
    )


def _is_table(lines: list[str], idx: int) -> bool:
    if idx + 1 >= len(lines) or "|" not in lines[idx]:
        return False
    separator = lines[idx + 1].strip().strip("|")
    cells = [cell.strip() for cell in separator.split("|")]
    return len(cells) >= 2 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def parse_markdown_blocks(pages: list[PageText]) -> list[StructuralBlock]:
    """Parse page-scoped Docling Markdown into provenance-bearing blocks."""
    blocks: list[StructuralBlock] = []
    headings: list[str] = []
    for page in pages:
        lines = (page.text or "").splitlines()
        idx = 0
        while idx < len(lines):
            line = lines[idx]
            if not line.strip():
                idx += 1
                continue
            heading = _HEADING_RE.match(line)
            if heading:
                level = len(heading.group(1))
                headings = headings[: level - 1] + [heading.group(2).strip()]
                blocks.append(
                    StructuralBlock("heading", line.strip(), page.page, page.page, " > ".join(headings))
                )
                idx += 1
                continue

            section = " > ".join(headings)
            if _is_table(lines, idx):
                table = [line, lines[idx + 1]]
                idx += 2
                while idx < len(lines) and lines[idx].strip() and "|" in lines[idx]:
                    table.append(lines[idx])
                    idx += 1
                blocks.append(StructuralBlock("table", "\n".join(table), page.page, page.page, section))
                continue

            fence = _FENCE_RE.match(line)
            formula = _FORMULA_RE.match(line)
            if fence or formula:
                marker = fence.group(1) if fence else "$$"
                body = [line]
                idx += 1
                while idx < len(lines):
                    body.append(lines[idx])
                    end = lines[idx].strip()
                    idx += 1
                    if (marker == "$$" and end == "$$") or (
                        marker != "$$" and end.startswith(marker)
                    ):
                        break
                blocks.append(
                    StructuralBlock("formula" if formula else "code", "\n".join(body), page.page, page.page, section)
                )
                continue

            if _LIST_RE.match(line):
                body = [line]
                idx += 1
                while idx < len(lines) and (
                    _LIST_RE.match(lines[idx]) or (lines[idx].strip() and lines[idx][:1].isspace())
                ):
                    body.append(lines[idx])
                    idx += 1
                blocks.append(StructuralBlock("list", "\n".join(body), page.page, page.page, section))
                continue

            body = [line]
            idx += 1
            while idx < len(lines) and lines[idx].strip():
                if _HEADING_RE.match(lines[idx]) or _FENCE_RE.match(lines[idx]) or _FORMULA_RE.match(lines[idx]):
                    break
                if _is_table(lines, idx) or _LIST_RE.match(lines[idx]):
                    break
                body.append(lines[idx])
                idx += 1
            blocks.append(StructuralBlock("paragraph", "\n".join(body), page.page, page.page, section))
    return blocks


def _pack_units(
    units: list[str],
    *,
    max_tokens: int,
    prefix: str = "",
    suffix: str = "",
    separator: str = "\n",
) -> list[str]:
    max_chars = max_tokens * 4
    out: list[str] = []
    current: list[str] = []
    for unit in units:
        candidate = prefix + separator.join([*current, unit]) + suffix
        if current and len(candidate) > max_chars:
            out.append(prefix + separator.join(current) + suffix)
            current = [unit]
        elif not current and len(candidate) > max_chars:
            for start in range(0, len(unit), max_chars):
                out.append(prefix + unit[start : start + max_chars] + suffix)
        else:
            current.append(unit)
    if current:
        out.append(prefix + separator.join(current) + suffix)
    return out


def _split_block(block: StructuralBlock, *, max_tokens: int) -> list[StructuralBlock]:
    if estimate_tokens(block.text) <= max_tokens:
        return [block]
    if block.kind == "table":
        lines = block.text.splitlines()
        header = lines[:2]
        pieces = _pack_units(lines[2:], max_tokens=max_tokens, prefix="\n".join(header) + "\n")
    elif block.kind in {"code", "formula"}:
        lines = block.text.splitlines()
        prefix = lines[0] + "\n" if len(lines) > 1 else ""
        suffix = "\n" + lines[-1] if len(lines) > 2 else ""
        pieces = _pack_units(
            lines[1:-1] if len(lines) > 2 else lines,
            max_tokens=max_tokens,
            prefix=prefix,
            suffix=suffix,
        )
    elif block.kind == "list":
        pieces = _pack_units(block.text.splitlines(), max_tokens=max_tokens)
    else:
        sentences = [s.strip() for s in _SENTENCE_RE.split(block.text) if s.strip()]
        pieces = _pack_units(sentences, max_tokens=max_tokens, separator=" ")
    return [
        StructuralBlock(block.kind, piece, block.page, block.page_end, block.section_path)
        for piece in pieces
        if piece.strip()
    ]


def _trailing_paragraph(blocks: list[StructuralBlock], *, overlap_tokens: int) -> StructuralBlock | None:
    for block in reversed(blocks):
        if block.kind == "paragraph" and estimate_tokens(block.text) <= overlap_tokens:
            return block
    return None


def _assemble_blocks(
    blocks: list[StructuralBlock],
    *,
    chunk_profile: str | None = None,
) -> list[list[StructuralBlock]]:
    limits = _limits_for_profile(chunk_profile)
    expanded = [part for block in blocks for part in _split_block(block, max_tokens=limits.max_tokens)]
    groups: list[list[StructuralBlock]] = []
    current: list[StructuralBlock] = []
    for block in expanded:
        candidate = "\n\n".join([*(b.text for b in current), block.text])
        if current and estimate_tokens(candidate) > limits.max_tokens:
            groups.append(current)
            overlap = _trailing_paragraph(current, overlap_tokens=limits.overlap_tokens)
            current = [overlap, block] if overlap and overlap is not block else [block]
        else:
            current.append(block)
        if current and estimate_tokens("\n\n".join(b.text for b in current)) >= limits.target_tokens:
            groups.append(current)
            overlap = _trailing_paragraph(current, overlap_tokens=limits.overlap_tokens)
            current = [overlap] if overlap else []
    if current:
        if groups and estimate_tokens("\n\n".join(b.text for b in current)) < limits.min_preferred_tokens:
            merged = "\n\n".join(b.text for b in [*groups[-1], *current])
            if estimate_tokens(merged) <= limits.max_tokens:
                groups[-1].extend(current)
            else:
                groups.append(current)
        else:
            groups.append(current)
    return groups


def chunk_pages(
    item: ManifestItem,
    pages: list[PageText],
    *,
    pipeline_categories: list[str] | None = None,
    alias_doc_ids: list[str] | None = None,
    alias_source_urls: list[str] | None = None,
    alias_dois: list[str] | None = None,
    canonical_sha256: str | None = None,
    chunk_profile: str | None = None,
) -> list[TextChunk]:
    cats = pipeline_categories or []
    groups = _assemble_blocks(parse_markdown_blocks(pages), chunk_profile=chunk_profile)
    chunks: list[TextChunk] = []
    for idx, group in enumerate(groups):
        text = "\n\n".join(block.text for block in group)
        chunks.append(
            _make_chunk(
                item,
                text=text,
                page=min(block.page for block in group),
                page_end=max(block.page_end for block in group),
                chunk_index=idx,
                pipeline_categories=cats,
                section_path=next((b.section_path for b in reversed(group) if b.section_path), ""),
                alias_doc_ids=alias_doc_ids,
                alias_source_urls=alias_source_urls,
                alias_dois=alias_dois,
                canonical_sha256=canonical_sha256,
            )
        )
    return chunks


def chunk_metadata(
    item: ManifestItem,
    text: str,
    *,
    pipeline_categories: list[str] | None = None,
    alias_doc_ids: list[str] | None = None,
    alias_source_urls: list[str] | None = None,
    alias_dois: list[str] | None = None,
) -> list[TextChunk]:
    return [
        _make_chunk(
            item,
            text=text,
            page=None,
            chunk_index=0,
            pipeline_categories=pipeline_categories or [],
            alias_doc_ids=alias_doc_ids,
            alias_source_urls=alias_source_urls,
            alias_dois=alias_dois,
        )
    ]
