from __future__ import annotations

import dataclasses
import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rag_common.local_llm import DEFAULT_OLLAMA_MODEL

from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.ingest.local_summarize import (
    bounded_source,
    clean_summary,
    generate_ollama,
    resolve_ollama_host,
    resolve_ollama_model,
    unload_ollama_model,
    validate_summary,
)
from rag_literature_rag.manifest import ManifestItem
from rag_literature_rag.paths import DATA_DIR

DOCSUMMARY_PROFILE = "cuda-qwen0.6b-docsummary-gemma4-v1"
PROMPT_VERSION = "rag-lit-docsummary-gemma4-v2"
DEFAULT_MODEL = DEFAULT_OLLAMA_MODEL
CACHE_VERSION = 1
CACHE_DIR = DATA_DIR / "docsummary_cache"
MAX_SOURCE_CHARS = int(os.getenv("RAG_LIT_DOCSUMMARY_SOURCE_CHARS", "6000"))
MAX_GENERATION_TOKENS = int(os.getenv("RAG_LIT_DOCSUMMARY_MAX_TOKENS", "2048"))
MIN_SUMMARY_WORDS = int(os.getenv("RAG_LIT_DOCSUMMARY_MIN_WORDS", "40"))
OLLAMA_ENV_PREFIX = "RAG_LIT_DOCSUMMARY_"


@dataclass
class SummaryCacheStats:
    hits: int = 0
    misses: int = 0
    generated: int = 0
    failures: int = 0


@dataclass(frozen=True)
class DocumentSummary:
    id: str
    doc_id: str
    title: str
    text: str
    summary_level: str
    source_chunk_ids: list[str]
    page: int | None
    page_end: int | None
    section_path: str
    summary_model: str
    prompt_version: str
    canonical_sha256: str | None
    tags: list[str]
    pipeline_categories: list[str]
    source_url: str
    year: int | None
    authors: list[str] = field(default_factory=list)
    alias_doc_ids: list[str] = field(default_factory=list)
    alias_source_urls: list[str] = field(default_factory=list)
    alias_dois: list[str] = field(default_factory=list)
    source_text_hash: str = ""
    cache_key: str = ""
    parent_id: str = ""
    tree_depth: int = 0


def is_docsummary_profile(profile: str | None = None) -> bool:
    return bool(profile and "docsummary-gemma4" in profile)


def docsummary_model() -> str:
    return resolve_ollama_model(env_prefix=OLLAMA_ENV_PREFIX, default=DEFAULT_MODEL)


def ollama_host() -> str:
    return resolve_ollama_host(env_prefix=OLLAMA_ENV_PREFIX)


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_source_text(chunks: list[TextChunk]) -> str:
    parts: list[str] = []
    for chunk in chunks:
        section = f"Section: {chunk.section_path}\n" if chunk.section_path else ""
        page = f"Pages: {chunk.page}-{chunk.page_end}\n" if chunk.page_end else f"Page: {chunk.page}\n"
        parts.append(
            f"[chunk {chunk.doc_id}:{chunk.chunk_index}]\n"
            f"{section}{page}{(chunk.text or '').strip()}"
        )
    return "\n\n".join(part for part in parts if part.strip())


def source_text_hash(chunks: list[TextChunk]) -> str:
    return _sha256_text(normalize_source_text(chunks))


def summary_cache_key(
    *,
    pdf_sha256: str,
    model: str,
    prompt_version: str,
    extraction_options: dict[str, object] | None,
    source_hash: str,
) -> str:
    payload = {
        "v": CACHE_VERSION,
        "pdf_sha256": pdf_sha256,
        "model": model,
        "prompt_version": prompt_version,
        "extraction_options": extraction_options or {},
        "source_text_hash": source_hash,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    return CACHE_DIR / key[:2] / f"{key}.json"


def _load_cached(key: str) -> str | None:
    path = _cache_path(key)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    text = data.get("summary")
    return text.strip() if isinstance(text, str) and text.strip() else None


def _store_cached(
    key: str,
    *,
    pdf_sha256: str,
    model: str,
    prompt_version: str,
    extraction_options: dict[str, object] | None,
    source_hash: str,
    summary: str,
) -> None:
    path = _cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "v": CACHE_VERSION,
        "pdf_sha256": pdf_sha256,
        "model": model,
        "prompt_version": prompt_version,
        "extraction_options": extraction_options or {},
        "source_text_hash": source_hash,
        "summary": summary,
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def build_prompt(item: ManifestItem, chunks: list[TextChunk], source_text: str) -> str:
    aliases = sorted({alias for chunk in chunks for alias in chunk.alias_doc_ids})
    tags = sorted({tag for chunk in chunks for tag in chunk.tags})
    categories = sorted({cat for chunk in chunks for cat in chunk.pipeline_categories})
    return (
        "You write one source-grounded retrieval summary chunk for a RAG / information "
        "retrieval research paper.\n\n"
        f"Title: {item.title}\n"
        f"Year: {item.year or 'unknown'}\n"
        f"Authors: {', '.join(item.authors[:12]) if item.authors else 'unknown'}\n"
        f"Known tags/categories: {', '.join([*categories, *tags][:30]) or 'unknown'}\n"
        f"Known aliases/doc IDs: {', '.join(aliases[:20]) or 'none'}\n\n"
        "Task: Produce concise retrieval-oriented text covering the paper's problem, "
        "methods, datasets or benchmarks, key terms, findings, limitations, and aliases.\n"
        "Rules:\n"
        "- Stay grounded in the supplied source text.\n"
        "- Do not invent citations, datasets, findings, limitations, or acronyms.\n"
        "- Preserve important acronyms, method names, dataset names, and alternate names.\n"
        "- If a requested detail is absent, omit it instead of guessing.\n"
        "- Output plain text only, 120-220 words.\n\n"
        "Source text:\n"
        f"{bounded_source(source_text, max_chars=MAX_SOURCE_CHARS)}"
    )


def _generate_ollama(prompt: str, *, model: str) -> str:
    return generate_ollama(
        prompt,
        model=model,
        host=ollama_host(),
        max_tokens=MAX_GENERATION_TOKENS,
    )


def unload_ollama_model_for_docsummary(model: str | None = None) -> None:
    unload_ollama_model(model or docsummary_model(), host=ollama_host())


# Backward-compatible alias used by ingest/run.py
unload_ollama_model = unload_ollama_model_for_docsummary


def build_document_summary(
    item: ManifestItem,
    chunks: list[TextChunk],
    *,
    pdf_sha256: str,
    extraction_options: dict[str, object] | None,
    stats: SummaryCacheStats | None = None,
) -> DocumentSummary | None:
    if not pdf_sha256 or not chunks:
        return None
    source_text = normalize_source_text(chunks)
    src_hash = _sha256_text(source_text)
    model = docsummary_model()
    key = summary_cache_key(
        pdf_sha256=pdf_sha256,
        model=model,
        prompt_version=PROMPT_VERSION,
        extraction_options=extraction_options,
        source_hash=src_hash,
    )
    summary = _load_cached(key)
    if summary:
        if stats:
            stats.hits += 1
    else:
        if stats:
            stats.misses += 1
        prompt = build_prompt(item, chunks, source_text)
        try:
            summary = clean_summary(_generate_ollama(prompt, model=model))
            validate_summary(summary, min_words=MIN_SUMMARY_WORDS)
        except RuntimeError:
            if stats:
                stats.failures += 1
            return None
        if not summary:
            if stats:
                stats.failures += 1
            return None
        _store_cached(
            key,
            pdf_sha256=pdf_sha256,
            model=model,
            prompt_version=PROMPT_VERSION,
            extraction_options=extraction_options,
            source_hash=src_hash,
            summary=summary,
        )
        if stats:
            stats.generated += 1

    source_chunk_ids = [f"{chunk.doc_id}:{chunk.chunk_index}" for chunk in chunks]
    pages = [chunk.page for chunk in chunks if chunk.page is not None]
    page_ends = [
        chunk.page_end if chunk.page_end is not None else chunk.page
        for chunk in chunks
        if chunk.page is not None
    ]
    first = chunks[0]
    return DocumentSummary(
        id=f"{item.id}:-1",
        doc_id=item.id,
        title=item.title,
        text=summary,
        summary_level="document",
        source_chunk_ids=source_chunk_ids,
        page=min(pages) if pages else None,
        page_end=max(page_ends) if page_ends else None,
        section_path="document summary",
        summary_model=model,
        prompt_version=PROMPT_VERSION,
        canonical_sha256=pdf_sha256,
        tags=first.tags,
        pipeline_categories=first.pipeline_categories,
        source_url=first.source_url,
        year=first.year,
        authors=first.authors,
        alias_doc_ids=first.alias_doc_ids,
        alias_source_urls=first.alias_source_urls,
        alias_dois=first.alias_dois,
        source_text_hash=src_hash,
        cache_key=key,
    )


def summary_to_chunk(summary: DocumentSummary) -> TextChunk:
    return TextChunk(
        doc_id=summary.doc_id,
        title=summary.title,
        text=summary.text,
        page=summary.page,
        page_end=summary.page_end,
        chunk_index=-1,
        source_url=summary.source_url,
        year=summary.year,
        tags=summary.tags,
        authors=summary.authors,
        pipeline_categories=summary.pipeline_categories,
        section_path=summary.section_path,
        alias_doc_ids=summary.alias_doc_ids,
        alias_source_urls=summary.alias_source_urls,
        alias_dois=summary.alias_dois,
        canonical_sha256=summary.canonical_sha256,
    )


def summary_row(summary: DocumentSummary, vector: list[float]) -> dict[str, Any]:
    return {
        **dataclasses.asdict(summary),
        "source_chunk_ids": ",".join(summary.source_chunk_ids),
        "tags": ",".join(summary.tags),
        "pipeline_categories": ",".join(summary.pipeline_categories),
        "authors": ",".join(summary.authors),
        "alias_doc_ids": ",".join(summary.alias_doc_ids),
        "alias_source_urls": ",".join(summary.alias_source_urls),
        "alias_dois": ",".join(summary.alias_dois),
        "vector": vector,
    }


def cache_stats() -> dict[str, int]:
    if not CACHE_DIR.exists():
        return {"entries": 0, "size_mb": 0}
    files = list(CACHE_DIR.rglob("*.json"))
    size = sum(path.stat().st_size for path in files)
    return {"entries": len(files), "size_mb": round(size / 1024 / 1024)}
