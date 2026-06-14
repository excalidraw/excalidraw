from __future__ import annotations

from repo_rag.chunk import contextualize as ctx
from repo_rag.chunk.prefix import build_prefixed_text
from repo_rag.chunk.types import TextChunk


def _chunk(text: str = "export function foo() {}", context: str = "") -> TextChunk:
    return TextChunk(
        chunk_id="f.ts:0",
        file_path="pkg/f.ts",
        text=text,
        source_type="code",
        package="@x/pkg",
        symbol="foo",
        kind="function",
        start_line=1,
        chunk_index=0,
        context=context,
    )


def test_heuristic_uses_leading_comment_block():
    file_text = "// Layout engine for the compound pipeline view.\n// Handles banding.\n\nexport function foo() {}"
    out = ctx._heuristic_context("pkg/f.ts", file_text)
    assert "Layout engine for the compound pipeline" in out
    assert "Handles banding" in out


def test_heuristic_falls_back_to_path_when_no_comment():
    out = ctx._heuristic_context("pkg/f.ts", "export function foo() {}\n")
    assert out == "From pkg/f.ts."


def test_contextualize_chunks_heuristic_populates_context():
    chunks = [_chunk()]
    ctx.contextualize_chunks(chunks, "// Does a thing.\nexport function foo() {}", use_llm=False)
    assert chunks[0].context == "Does a thing."


def test_contextualize_chunks_llm_path(monkeypatch):
    class _Block:
        type = "text"
        text = "  Situates foo within the\nfile. "

    class _Resp:
        content = [_Block()]

    class _Msgs:
        def create(self, **kwargs):
            # Document body is cached; chunk prompt is the second (uncached) block.
            blocks = kwargs["messages"][0]["content"]
            assert blocks[0]["cache_control"] == {"type": "ephemeral"}
            assert "<chunk>" in blocks[1]["text"]
            return _Resp()

    class _Client:
        messages = _Msgs()

    monkeypatch.setattr(ctx, "_client", lambda: _Client())
    chunks = [_chunk()]
    ctx.contextualize_chunks(chunks, "file body", use_llm=True)
    # Whitespace collapsed, trimmed.
    assert chunks[0].context == "Situates foo within the file."


def test_contextualize_chunks_llm_failure_degrades_to_heuristic(monkeypatch):
    def _boom():
        raise RuntimeError("no anthropic")

    monkeypatch.setattr(ctx, "_client", _boom)
    chunks = [_chunk()]
    ctx.contextualize_chunks(chunks, "// A widget.\nexport function foo() {}", use_llm=True)
    assert chunks[0].context == "A widget."


def test_prefix_includes_context_for_embedding_and_bm25():
    with_ctx = build_prefixed_text(_chunk(context="Situates foo in the module."))
    assert "# context: Situates foo in the module." in with_ctx
    # Absent when not contextualized.
    assert "# context:" not in build_prefixed_text(_chunk())
