from __future__ import annotations

from repo_rag.chunk.types import TextChunk


def build_prefixed_text(chunk: TextChunk) -> str:
    """Context-enriched chunk text for embedding and BM25."""
    lines = [
        f"# file: {chunk.file_path}",
        f"# package: {chunk.package}",
        f"# source_type: {chunk.source_type}",
    ]
    if chunk.symbol:
        lines.append(f"# symbol: {chunk.symbol}")
    if chunk.kind:
        lines.append(f"# kind: {chunk.kind}")
    if chunk.tags:
        lines.append(f"# tags: {', '.join(chunk.tags)}")
    if chunk.is_test:
        lines.append("# is_test: true")
    if chunk.context:
        # Contextual Retrieval: situating blurb flows into both embedding and BM25.
        lines.append(f"# context: {chunk.context}")
    lines.append("")
    lines.append(chunk.text)
    return "\n".join(lines)


def infer_package(file_path: str) -> str:
    if file_path.startswith("packages/excalidraw/"):
        return "@excalidraw/excalidraw"
    if file_path.startswith("packages/element/"):
        return "@excalidraw/element"
    if file_path.startswith("packages/common/"):
        return "@excalidraw/common"
    if file_path.startswith("packages/math/"):
        return "@excalidraw/math"
    if file_path.startswith("packages/utils/"):
        return "@excalidraw/utils"
    if file_path.startswith("packages/backend/"):
        return "@excalidraw/backend"
    if file_path.startswith("excalidraw-app/"):
        return "excalidraw-app"
    if file_path.startswith("functions/"):
        return "cloudflare-functions"
    return "repo-root"
