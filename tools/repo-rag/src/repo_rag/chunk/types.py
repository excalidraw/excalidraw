from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TextChunk:
    chunk_id: str
    file_path: str
    text: str
    source_type: str
    package: str
    symbol: str
    kind: str
    start_line: int
    chunk_index: int
    is_test: bool = False
    tags: list[str] = field(default_factory=list)
