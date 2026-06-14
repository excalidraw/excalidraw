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
    # Contextual Retrieval (Anthropic): a short blurb situating this chunk in its
    # file/module, prepended before embedding + BM25. Empty unless contextualization
    # is enabled at index time. See chunk/contextualize.py.
    context: str = ""
