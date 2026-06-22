from __future__ import annotations

import hashlib
import json
import os
from dataclasses import replace
from dataclasses import dataclass
from typing import Any, Callable, Sequence

import numpy as np
from sklearn.decomposition import PCA
from sklearn.mixture import GaussianMixture

from rag_common.local_llm import DEFAULT_OLLAMA_MODEL

from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.ingest.doc_summary import DocumentSummary, SummaryCacheStats
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

RAPTOR_PROFILE = "mlx-qwen4b-raptor-gemma4-v1"
PROMPT_VERSION = "rag-lit-raptor-gemma4-v1"
CACHE_VERSION = 1
CACHE_DIR = DATA_DIR / "raptor_cache"
OLLAMA_ENV_PREFIX = "RAG_LIT_RAPTOR_"
MAX_SOURCE_CHARS = int(os.getenv("RAG_LIT_RAPTOR_SOURCE_CHARS", "6000"))
MAX_GENERATION_TOKENS = int(os.getenv("RAG_LIT_RAPTOR_MAX_TOKENS", "2048"))
MIN_SUMMARY_WORDS = int(os.getenv("RAG_LIT_RAPTOR_MIN_WORDS", "40"))
MAX_DEPTH = int(os.getenv("RAG_LIT_RAPTOR_MAX_DEPTH", "3"))
MIN_CLUSTER = int(os.getenv("RAG_LIT_RAPTOR_MIN_CLUSTER", "2"))
MAX_CLUSTERS = int(os.getenv("RAG_LIT_RAPTOR_MAX_CLUSTERS", "10"))


@dataclass(frozen=True)
class _TreeMember:
    node_id: str
    text: str
    source_ids: list[str]
    page: int | None
    page_end: int | None
    section_path: str
    vector: list[float]


def is_raptor_profile(profile: str | None = None) -> bool:
    return bool(profile and "raptor-gemma4" in profile)


def raptor_model() -> str:
    return resolve_ollama_model(env_prefix=OLLAMA_ENV_PREFIX, default=DEFAULT_OLLAMA_MODEL)


def ollama_host() -> str:
    return resolve_ollama_host(env_prefix=OLLAMA_ENV_PREFIX)


def unload_ollama_model_for_raptor(model: str | None = None) -> None:
    unload_ollama_model(model or raptor_model(), host=ollama_host())


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def raptor_cache_key(
    *,
    child_ids: list[str],
    model: str,
    prompt_version: str,
    source_hash: str,
) -> str:
    payload = {
        "v": CACHE_VERSION,
        "child_ids": child_ids,
        "model": model,
        "prompt_version": prompt_version,
        "source_text_hash": source_hash,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_path(key: str):
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


def _store_cached(key: str, *, child_ids: list[str], model: str, source_hash: str, summary: str) -> None:
    path = _cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "v": CACHE_VERSION,
        "child_ids": child_ids,
        "model": model,
        "prompt_version": PROMPT_VERSION,
        "source_text_hash": source_hash,
        "summary": summary,
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def cluster_nodes(vectors: Sequence[Sequence[float]], *, min_cluster: int = MIN_CLUSTER) -> list[int]:
    """Assign cluster labels with PCA-reduced GMM; BIC selects k."""
    count = len(vectors)
    if count < min_cluster * 2:
        return list(range(count))

    matrix = np.asarray(vectors, dtype=np.float64)
    if matrix.ndim != 2 or matrix.shape[0] < 2:
        return list(range(count))

    n_components = min(50, count - 1, matrix.shape[1])
    if n_components < 1:
        return list(range(count))

    reduced = PCA(n_components=n_components, random_state=42).fit_transform(matrix)
    max_k = min(MAX_CLUSTERS, count // min_cluster)
    if max_k < 2:
        return [0] * count

    best_k = 1
    best_bic = float("inf")
    for k in range(1, max_k + 1):
        gmm = GaussianMixture(n_components=k, random_state=42)
        gmm.fit(reduced)
        bic = gmm.bic(reduced)
        if bic < best_bic:
            best_bic = bic
            best_k = k

    if count >= min_cluster * 2:
        best_k = max(2, best_k)
    elif best_k <= 1:
        return [0] * count

    gmm = GaussianMixture(n_components=best_k, random_state=42)
    return gmm.fit_predict(reduced).tolist()


def _member_source_text(members: Sequence[_TreeMember]) -> str:
    parts: list[str] = []
    for member in members:
        section = f"Section: {member.section_path}\n" if member.section_path else ""
        parts.append(f"[node {member.node_id}]\n{section}{member.text.strip()}")
    return "\n\n".join(part for part in parts if part.strip())


def build_cluster_prompt(item: ManifestItem, members: Sequence[_TreeMember], source_text: str) -> str:
    return (
        "You write one source-grounded retrieval summary for a cluster of related "
        "passages from a RAG / information retrieval research paper.\n\n"
        f"Title: {item.title}\n"
        f"Year: {item.year or 'unknown'}\n"
        f"Authors: {', '.join(item.authors[:12]) if item.authors else 'unknown'}\n\n"
        "Task: Produce concise retrieval-oriented text that captures the shared themes, "
        "methods, findings, and terminology across the cluster.\n"
        "Rules:\n"
        "- Stay grounded in the supplied passages.\n"
        "- Do not invent citations, datasets, findings, or acronyms.\n"
        "- Preserve important acronyms, method names, and alternate names.\n"
        "- Output plain text only, 80-180 words.\n\n"
        "Cluster passages:\n"
        f"{bounded_source(source_text, max_chars=MAX_SOURCE_CHARS)}"
    )


def _summarize_cluster(
    item: ManifestItem,
    members: list[_TreeMember],
    *,
    model: str,
    stats: SummaryCacheStats | None,
) -> str | None:
    child_ids = sorted(member.node_id for member in members)
    source_text = _member_source_text(members)
    source_hash = _sha256_text(source_text)
    key = raptor_cache_key(
        child_ids=child_ids,
        model=model,
        prompt_version=PROMPT_VERSION,
        source_hash=source_hash,
    )
    cached = _load_cached(key)
    if cached:
        if stats:
            stats.hits += 1
        return cached

    if stats:
        stats.misses += 1
    prompt = build_cluster_prompt(item, members, source_text)
    try:
        summary = clean_summary(
            generate_ollama(
                prompt,
                model=model,
                host=ollama_host(),
                max_tokens=MAX_GENERATION_TOKENS,
            )
        )
        validate_summary(summary, min_words=MIN_SUMMARY_WORDS)
    except RuntimeError:
        if stats:
            stats.failures += 1
        return None

    _store_cached(key, child_ids=child_ids, model=model, source_hash=source_hash, summary=summary)
    if stats:
        stats.generated += 1
    return summary


def _level_name(depth: int, *, is_root: bool) -> str:
    if is_root:
        return "root"
    return f"L{depth}"


def build_raptor_tree(
    item: ManifestItem,
    chunks: list[TextChunk],
    vectors: list[list[float]],
    *,
    embed_texts: Callable[[list[str]], list[list[float]]],
    stats: SummaryCacheStats | None = None,
) -> list[DocumentSummary]:
    if not chunks or len(chunks) != len(vectors):
        return []

    first = chunks[0]
    model = raptor_model()
    nodes: list[DocumentSummary] = []
    current: list[_TreeMember] = []
    for chunk, vector in zip(chunks, vectors):
        node_id = f"{chunk.doc_id}:{chunk.chunk_index}"
        current.append(
            _TreeMember(
                node_id=node_id,
                text=chunk.text,
                source_ids=[node_id],
                page=chunk.page,
                page_end=chunk.page_end,
                section_path=chunk.section_path,
                vector=vector,
            )
        )

    depth = 0
    while len(current) >= MIN_CLUSTER * 2 and depth < MAX_DEPTH:
        labels = cluster_nodes([member.vector for member in current])
        unique_labels = sorted(set(labels))
        if len(unique_labels) >= len(current):
            break

        depth += 1
        next_level: list[_TreeMember] = []
        for label in unique_labels:
            members = [current[idx] for idx, assigned in enumerate(labels) if assigned == label]
            summary_text = _summarize_cluster(item, members, model=model, stats=stats)
            if not summary_text:
                continue
            child_ids = sorted(
                {
                    source_id
                    for member in members
                    for source_id in member.source_ids
                }
            )
            pages = [member.page for member in members if member.page is not None]
            page_ends = [
                member.page_end if member.page_end is not None else member.page
                for member in members
                if member.page is not None
            ]
            node_index = len(nodes)
            node_id = f"{item.id}:raptor:{depth}:{node_index}"
            is_root = len(unique_labels) == 1
            nodes.append(
                DocumentSummary(
                    id=node_id,
                    doc_id=item.id,
                    title=item.title,
                    text=summary_text,
                    summary_level=_level_name(depth, is_root=is_root and depth == MAX_DEPTH),
                    source_chunk_ids=child_ids,
                    page=min(pages) if pages else None,
                    page_end=max(page_ends) if page_ends else None,
                    section_path=f"raptor {_level_name(depth, is_root=False)}",
                    summary_model=model,
                    prompt_version=PROMPT_VERSION,
                    canonical_sha256=item.sha256,
                    tags=first.tags,
                    pipeline_categories=first.pipeline_categories,
                    source_url=first.source_url,
                    year=first.year,
                    authors=first.authors,
                    alias_doc_ids=first.alias_doc_ids,
                    alias_source_urls=first.alias_source_urls,
                    alias_dois=first.alias_dois,
                    source_text_hash=_sha256_text(summary_text),
                    cache_key=raptor_cache_key(
                        child_ids=child_ids,
                        model=model,
                        prompt_version=PROMPT_VERSION,
                        source_hash=_sha256_text(_member_source_text(members)),
                    ),
                    parent_id="",
                    tree_depth=depth,
                )
            )
            next_level.append(
                _TreeMember(
                    node_id=node_id,
                    text=summary_text,
                    source_ids=child_ids,
                    page=min(pages) if pages else None,
                    page_end=max(page_ends) if page_ends else None,
                    section_path=f"raptor {_level_name(depth, is_root=False)}",
                    vector=[],
                )
            )

        if len(next_level) < 2:
            if len(next_level) == 1 and nodes:
                nodes[-1] = replace(nodes[-1], summary_level="root")
            break

        unload_ollama_model_for_raptor(model)
        embedded = embed_texts([member.text for member in next_level])
        current = [
            _TreeMember(
                node_id=member.node_id,
                text=member.text,
                source_ids=member.source_ids,
                page=member.page,
                page_end=member.page_end,
                section_path=member.section_path,
                vector=vector,
            )
            for member, vector in zip(next_level, embedded)
        ]

    if nodes:
        max_depth = max(node.tree_depth for node in nodes)
        deepest = [node for node in nodes if node.tree_depth == max_depth]
        if len(deepest) == 1:
            root_id = deepest[0].id
            nodes = [
                replace(node, summary_level="root") if node.id == root_id else node
                for node in nodes
            ]
    return nodes


def build_raptor_tree_from_chunks(
    item: ManifestItem,
    chunks: list[TextChunk],
    *,
    embed_texts: Callable[[list[str]], list[list[float]]],
    stats: SummaryCacheStats | None = None,
) -> list[DocumentSummary]:
    if not chunks:
        return []
    from rag_literature_rag.ingest.chunk import embed_input_text

    vectors = embed_texts([embed_input_text(chunk) for chunk in chunks])
    return build_raptor_tree(item, chunks, vectors, embed_texts=embed_texts, stats=stats)


def cache_stats() -> dict[str, Any]:
    if not CACHE_DIR.exists():
        return {"entries": 0, "size_mb": 0}
    files = list(CACHE_DIR.rglob("*.json"))
    size = sum(path.stat().st_size for path in files)
    return {"entries": len(files), "size_mb": round(size / 1024 / 1024)}
