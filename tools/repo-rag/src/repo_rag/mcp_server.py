"""MCP server exposing repo-rag as a seed-and-navigate toolbox for coding agents.

The 2026 shift in code retrieval is *agentic*: rather than one-shot top-k, an agent
iterates — seed with hybrid search, then follow the AST graph (symbol → neighbors →
context) and read source. This server surfaces exactly those primitives over MCP so
an agent (Claude Code, etc.) can drive that loop, while repo-rag stays the fast
seed + graph layer underneath.

Thin wrappers only — all logic lives in query/search.py, graph.py, context.py.

Run: ``uv run repo-rag mcp``  (stdio transport)
Requires the ``mcp`` extra: ``uv sync --extra mcp``.
"""

from __future__ import annotations

from typing import Any

from repo_rag.context import assemble_context, read_entity
from repo_rag.graph import find_entities, neighbors as graph_neighbors
from repo_rag.query.search import search as hybrid_search


def build_server() -> Any:
    """Construct the FastMCP server. Imported lazily so the package needn't depend on mcp."""
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP("repo-rag")

    @mcp.tool()
    def search(
        query: str,
        top: int = 8,
        source_type: str | None = None,
        package: str | None = None,
        path_contains: str | None = None,
        rerank: bool | None = None,
    ) -> list[dict[str, Any]]:
        """Hybrid BM25 + vector search over this repo. The SEED step — start here, then
        navigate with `symbol`/`neighbors`/`context` and read the real files.

        Returns excerpts only (~600 chars); always read the file at file_path + start_line
        before editing. Filters: source_type (handoff|terraform|code|app|test|doc),
        package, path_contains. Set rerank=true for a cross-encoder precision pass
        (~2x latency; default follows RAG_RERANK_ENABLED).
        """
        return hybrid_search(
            query,
            top=top,
            source_type=source_type,
            package=package,
            path_contains=path_contains,
            rerank=rerank,
        )

    @mcp.tool()
    def symbol(name: str) -> list[dict[str, Any]]:
        """Exact symbol or file lookup in the AST graph (no embeddings needed). Use when
        you already know a function/class/file name and want its precise location(s)."""
        return find_entities(name)

    @mcp.tool()
    def neighbors(entity: str, edge: str | None = None, depth: int = 1) -> list[dict[str, Any]]:
        """Traverse the import/call graph from a symbol or file — incoming and outgoing.
        edge filters to imports|calls|contains|tests; depth 1-5. The NAVIGATE step:
        follow callers/callees a static top-k can't reach."""
        return graph_neighbors(entity, edge, depth)

    @mcp.tool()
    def context(task: str, budget: int = 6000) -> dict[str, Any]:
        """Assemble task-aware context: hybrid seeds + 1-hop graph neighbors, token-budgeted.
        Best single call for multi-file tasks before chasing imports by hand."""
        return assemble_context(task, budget)

    @mcp.tool()
    def read(entity: str) -> list[dict[str, Any]]:
        """Read an indexed entity (symbol/file) with its enclosing source context."""
        return read_entity(entity)

    return mcp


def run() -> None:
    """Launch the MCP server on stdio."""
    build_server().run()
