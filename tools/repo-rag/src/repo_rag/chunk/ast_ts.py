from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import tiktoken
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Node, Parser, Tree

from repo_rag.chunk.markdown import chunk_markdown
from repo_rag.chunk.prefix import infer_package
from repo_rag.chunk.types import TextChunk
from repo_rag.harvest.manifest import FileEntry

MAX_CHUNK_TOKENS = 1500
CHUNKABLE_TYPES = {
    "function_declaration",
    "method_definition",
    "class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "lexical_declaration",
}


@dataclass
class _SymbolSlice:
    symbol: str
    kind: str
    start_line: int
    text: str


@lru_cache(maxsize=2)
def _parser_ts() -> Parser:
    parser = Parser(Language(tstypescript.language_typescript()))
    return parser


@lru_cache(maxsize=2)
def _parser_tsx() -> Parser:
    parser = Parser(Language(tstypescript.language_tsx()))
    return parser


@lru_cache(maxsize=1)
def _tokenizer():
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_tokenizer().encode(text))


def _node_text(source: bytes, node: Node) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _node_symbol(source: bytes, node: Node) -> str:
    name_node = node.child_by_field_name("name")
    if name_node is not None:
        return _node_text(source, name_node).strip()
    for child in node.children:
        if child.type in ("identifier", "property_identifier", "type_identifier"):
            return _node_text(source, child).strip()
    text = _node_text(source, node)
    first_line = text.splitlines()[0] if text else node.type
    return first_line[:120]


def _line_number(source: bytes, node: Node) -> int:
    return source[: node.start_byte].count(b"\n") + 1


def _collect_symbols(source: bytes, tree: Tree) -> list[_SymbolSlice]:
    symbols: list[_SymbolSlice] = []

    def walk(node: Node) -> None:
        if node.type in ("export_statement", "statement_block"):
            for child in node.children:
                walk(child)
            return
        if node.type in CHUNKABLE_TYPES:
            text = _node_text(source, node)
            if text.strip():
                symbols.append(
                    _SymbolSlice(
                        symbol=_node_symbol(source, node),
                        kind=node.type,
                        start_line=_line_number(source, node),
                        text=text,
                    )
                )
            return
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return symbols


def _split_large_text(text: str, symbol: str, kind: str, start_line: int) -> list[_SymbolSlice]:
    token_count = count_tokens(text)
    if token_count <= MAX_CHUNK_TOKENS:
        return [_SymbolSlice(symbol=symbol, kind=kind, start_line=start_line, text=text)]

    lines = text.splitlines()
    if len(lines) <= 1:
        mid = max(1, len(text) // 2)
        return [
            _SymbolSlice(symbol=symbol, kind=kind, start_line=start_line, text=text[:mid]),
            _SymbolSlice(symbol=symbol, kind=kind, start_line=start_line, text=text[mid:]),
        ]

    slices: list[_SymbolSlice] = []
    bucket: list[str] = []
    line_no = start_line
    header = lines[0] if lines else ""
    for line in lines:
        candidate = "\n".join(bucket + [line])
        if bucket and count_tokens(candidate) > MAX_CHUNK_TOKENS:
            slices.append(
                _SymbolSlice(
                    symbol=symbol,
                    kind=kind,
                    start_line=line_no,
                    text="\n".join(bucket),
                )
            )
            bucket = [header, line] if header and line != header else [line]
            line_no = start_line
        else:
            bucket.append(line)
    if bucket:
        slices.append(
            _SymbolSlice(
                symbol=symbol,
                kind=kind,
                start_line=line_no,
                text="\n".join(bucket),
            )
        )
    return slices


def _fallback_file_chunks(entry: FileEntry, content: str) -> list[TextChunk]:
    slices = _split_large_text(content, symbol=PathStem(entry.path), kind="file", start_line=1)
    chunks: list[TextChunk] = []
    for i, sl in enumerate(slices):
        chunks.append(
            TextChunk(
                chunk_id=f"{entry.path}:{i}",
                file_path=entry.path,
                text=sl.text,
                source_type=entry.source_type,
                package=infer_package(entry.path),
                symbol=sl.symbol,
                kind=sl.kind,
                start_line=sl.start_line,
                chunk_index=i,
                is_test=entry.is_test,
                tags=entry.tags,
            )
        )
    return chunks


def PathStem(path: str) -> str:
    from pathlib import Path

    return Path(path).stem


def chunk_typescript(entry: FileEntry, content: str) -> list[TextChunk]:
    source = content.encode("utf-8")
    parser = _parser_tsx() if entry.path.endswith(".tsx") else _parser_ts()
    tree = parser.parse(source)
    if tree.root_node.has_error:
        return _fallback_file_chunks(entry, content)

    symbols = _collect_symbols(source, tree)
    if not symbols:
        return _fallback_file_chunks(entry, content)

    expanded: list[_SymbolSlice] = []
    for sym in symbols:
        expanded.extend(_split_large_text(sym.text, sym.symbol, sym.kind, sym.start_line))

    chunks: list[TextChunk] = []
    for i, sl in enumerate(expanded):
        chunks.append(
            TextChunk(
                chunk_id=f"{entry.path}:{i}",
                file_path=entry.path,
                text=sl.text,
                source_type=entry.source_type,
                package=infer_package(entry.path),
                symbol=sl.symbol,
                kind=sl.kind,
                start_line=sl.start_line,
                chunk_index=i,
                is_test=entry.is_test,
                tags=entry.tags,
            )
        )
    return chunks


def chunk_file(entry: FileEntry, content: str) -> list[TextChunk]:
    if entry.path.endswith((".md", ".mdx")):
        return chunk_markdown(entry, content)
    if entry.path.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts")):
        return chunk_typescript(entry, content)
    return _fallback_file_chunks(entry, content)
