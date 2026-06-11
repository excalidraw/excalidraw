from __future__ import annotations

import re

from repo_rag.chunk.prefix import infer_package
from repo_rag.chunk.types import TextChunk
from repo_rag.harvest.manifest import FileEntry

_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)


def chunk_markdown(entry: FileEntry, content: str) -> list[TextChunk]:
    lines = content.splitlines()
    sections: list[tuple[str, int, str]] = []
    current_heading = "document"
    current_start = 1
    current_lines: list[str] = []

    for idx, line in enumerate(lines, start=1):
        match = _HEADING_RE.match(line)
        if match and match.group(1) in ("##", "###"):
            if current_lines:
                sections.append((current_heading, current_start, "\n".join(current_lines)))
            current_heading = match.group(2).strip()
            current_start = idx
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_heading, current_start, "\n".join(current_lines)))

    if not sections:
        sections = [("document", 1, content)]

    chunks: list[TextChunk] = []
    for i, (heading, start_line, body) in enumerate(sections):
        if not body.strip():
            continue
        symbol = heading[:120]
        chunks.append(
            TextChunk(
                chunk_id=f"{entry.path}:{i}",
                file_path=entry.path,
                text=body,
                source_type=entry.source_type,
                package=infer_package(entry.path),
                symbol=symbol,
                kind="markdown_section",
                start_line=start_line,
                chunk_index=i,
                is_test=entry.is_test,
                tags=entry.tags,
            )
        )
    return chunks
