"""Contextual Retrieval (Anthropic) for repo-rag chunks.

For each AST chunk, generate a 1-2 sentence blurb situating it within its file, so
the text that gets embedded *and* BM25-indexed carries surrounding context
("Contextual Embeddings" + "Contextual BM25"). The LLM path uses Claude Haiku with
**prompt caching on the file body** — processing a file's chunks consecutively keeps
the cached document prefix warm, so only the per-chunk suffix is billed at full rate.

Falls back to a deterministic header (the file's leading comment block) when
contextualization is disabled, no API key is present, or the API call fails — so
indexing never hard-fails on this optional enrichment.
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache

from repo_rag.chunk.types import TextChunk

log = logging.getLogger("repo_rag.contextualize")

# Cheapest current Haiku — fast + cheap for a high-volume 1-2 sentence task.
CONTEXT_MODEL = os.getenv("RAG_CONTEXTUAL_MODEL", "claude-haiku-4-5").strip() or "claude-haiku-4-5"
MAX_CONTEXT_TOKENS = 160
# Bound the document body so a huge file can't blow up request size / cost.
MAX_FILE_CHARS = 48_000
MAX_CONTEXT_CHARS = 320

_CHUNK_PROMPT = (
    "Here is a chunk taken from the file shown above:\n"
    "<chunk>\n{chunk}\n</chunk>\n\n"
    "Give a short, succinct 1-2 sentence context that situates this chunk within the "
    "file for the purposes of improving search retrieval — what it does and how it "
    "relates to the rest of the file. Answer with only the context and nothing else."
)


def contextual_enabled() -> bool:
    return os.getenv("RAG_CONTEXTUAL_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")


@lru_cache(maxsize=1)
def _client():
    import anthropic

    return anthropic.Anthropic()


def _heuristic_context(file_path: str, file_text: str) -> str:
    """Deterministic fallback: the file's leading comment block, else a path note."""
    lead: list[str] = []
    for raw in file_text.splitlines():
        line = raw.strip()
        if not line:
            if lead:
                break
            continue
        if line.startswith(("//", "#", "/*", "*", "*/")):
            cleaned = line.lstrip("/#* ").rstrip("*/ ").strip()
            if cleaned:
                lead.append(cleaned)
            if len(" ".join(lead)) >= MAX_CONTEXT_CHARS:
                break
            continue
        break
    if lead:
        return " ".join(lead)[:MAX_CONTEXT_CHARS]
    return f"From {file_path}."


def _llm_context(file_path: str, file_text: str, chunk_text: str) -> str:
    document = file_text[:MAX_FILE_CHARS]
    resp = _client().messages.create(
        model=CONTEXT_MODEL,
        max_tokens=MAX_CONTEXT_TOKENS,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f'<document path="{file_path}">\n{document}\n</document>',
                        # Cache the file body so a file's other chunks read it cheaply.
                        "cache_control": {"type": "ephemeral"},
                    },
                    {"type": "text", "text": _CHUNK_PROMPT.format(chunk=chunk_text)},
                ],
            }
        ],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    return re.sub(r"\s+", " ", text)[:MAX_CONTEXT_CHARS]


def contextualize_chunks(chunks: list[TextChunk], file_text: str, *, use_llm: bool = True) -> None:
    """Populate ``chunk.context`` for every chunk of one file, in place.

    Pass ``use_llm=False`` (or leave the Anthropic SDK / API key unavailable) to use
    the deterministic heuristic only. Any per-chunk LLM failure degrades to the
    heuristic for that chunk rather than aborting the index run.
    """
    if not chunks:
        return
    file_path = chunks[0].file_path
    llm_ok = use_llm
    for chunk in chunks:
        context = ""
        if llm_ok:
            try:
                context = _llm_context(file_path, file_text, chunk.text)
            except Exception as exc:  # noqa: BLE001 — never fail an index over enrichment
                log.warning("contextualize LLM failed for %s (%s); using heuristic", file_path, exc)
                llm_ok = False
        chunk.context = context or _heuristic_context(file_path, file_text)
