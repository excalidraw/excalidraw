from repo_rag.chunk.ast_ts import chunk_file, chunk_typescript, count_tokens
from repo_rag.chunk.markdown import chunk_markdown
from repo_rag.harvest.manifest import FileEntry


def _entry(path: str, source_type: str = "code") -> FileEntry:
    return FileEntry(
        path=path,
        sha256="abc",
        source_type=source_type,
        package="@excalidraw/excalidraw",
    )


def test_typescript_chunks_at_function_boundaries():
    content = """
export function alpha(x: number): number {
  return x + 1;
}

export function beta(y: string): string {
  return y.toUpperCase();
}
""".strip()
    chunks = chunk_typescript(_entry("packages/excalidraw/components/sample.ts"), content)
    symbols = {c.symbol for c in chunks}
    assert "alpha" in symbols
    assert "beta" in symbols
    assert all(c.kind in ("function_declaration", "export_statement", "file") for c in chunks)


def test_markdown_splits_on_headings():
    content = "# Title\n\nIntro\n\n## Section A\n\nBody A\n\n### Sub B\n\nBody B"
    chunks = chunk_markdown(_entry("docs/sample.md", "handoff"), content)
    assert len(chunks) >= 2
    assert any("Section A" in c.symbol for c in chunks)


def test_count_tokens_positive():
    assert count_tokens("hello world") > 0


def test_chunk_file_routes_markdown():
    content = "## Section\n\nBody"
    chunks = chunk_file(_entry("docs/sample.md", "handoff"), content)
    assert len(chunks) >= 1
