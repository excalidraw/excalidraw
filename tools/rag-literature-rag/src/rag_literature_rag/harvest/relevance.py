"""Relevance filter for retrieval-augmented generation research literature."""

from __future__ import annotations

import re

CURATED_SOURCES = frozenset(
    {
        "topic-seed",
        "survey-seed",
        "awesome-rag-table",
        "anthropic-cookbook",
        "implementer-guide",
        "curated",
        "trusted-venue",
        "crossref",
        "arxiv",
    }
)

STRONG_LAYOUT_TERMS = frozenset(
    {
        "retrieval-augmented generation",
        "retrieval augmented generation",
        "retrieval-augmented",
        "retrieval augmented",
        "dense passage retrieval",
        "passage retrieval",
        "open-domain question answering",
        "open domain qa",
        "graphrag",
        "graph rag",
        "graph retrieval-augmented",
        "agentic rag",
        "agentic retrieval",
        "self-rag",
        "self rag",
        "corrective rag",
        "crag",
        "hyde",
        "hypothetical document embedding",
        "reciprocal rank fusion",
        "hybrid retrieval",
        "ragas",
        "fusion-in-decoder",
        "colbert",
        "late interaction",
        "raptor",
        "hipporag",
        "lightrag",
        "memorag",
        "rankrag",
        "rewrite-retrieve-read",
        "contextual retrieval",
        "knowledge-intensive nlp",
        "retrieval augmented language",
    }
)

WEAK_LAYOUT_TERMS = frozenset(
    {
        "retrieval",
        "retriever",
        "rerank",
        "reranking",
        "embedding",
        "embeddings",
        "chunk",
        "chunking",
        "passage",
        "passages",
        "indexing",
        "vector search",
        "semantic search",
        "bm25",
        "hallucination",
        "grounding",
        "citation",
        "multi-hop",
        "question answering",
        "knowledge base",
        "external knowledge",
    }
)

DRAWING_CONTEXT_TERMS = frozenset(
    {
        "retrieval",
        "rag",
        "augmented",
        "passage",
        "language model",
        "llm",
        "embedding",
        "chunk",
        "retriever",
        "generation",
        "knowledge-intensive",
    }
)

OFF_TOPIC_DOI_PREFIXES: tuple[str, ...] = (
    "10.1371/",
    "10.1186/",
    "10.1038/s41586",
    "10.1016/j.neuro",
    "10.1016/j.brainres",
    "10.1523/",
)

OFF_TOPIC_KEYWORDS = frozenset(
    {
        "graph drawing",
        "graph layout",
        "graph visualization layout",
        "sugiyama",
        "force-directed layout",
        "crossing minimization",
        "petroleum",
        "drilling operations",
        "reservoir simulation",
        "medical imaging",
        "clinical trial",
        "oncology",
        "protein folding",
        "genome sequencing",
        "wind turbine",
        "autoregressive time series",
        "recommendation system",
        "collaborative filtering",
        "diffusion model",
        "text-to-image",
        "video generation",
        "speech recognition",
        "object detection",
        "semantic segmentation",
    }
)

_OFF_TOPIC_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(k) for k in sorted(OFF_TOPIC_KEYWORDS, key=len, reverse=True)) + r")"
)


def is_known_offtopic_doi(doi: str) -> bool:
    doi_lower = doi.lower()
    return any(doi_lower.startswith(p.lower()) for p in OFF_TOPIC_DOI_PREFIXES)


def is_off_topic(title: str, abstract: str | None = None) -> bool:
    return bool(_OFF_TOPIC_RE.search(_haystack(title, abstract)))


def _haystack(title: str, abstract: str | None) -> str:
    return f"{title} {abstract or ''}".lower()


def _has_strong(hay: str) -> bool:
    return any(term in hay for term in STRONG_LAYOUT_TERMS)


def layout_relevance_score(title: str, abstract: str | None = None) -> int:
    hay = _haystack(title, abstract)
    if _OFF_TOPIC_RE.search(hay):
        return -100
    score = 3 * sum(1 for term in STRONG_LAYOUT_TERMS if term in hay)
    if any(ctx in hay for ctx in DRAWING_CONTEXT_TERMS):
        score += sum(1 for term in WEAK_LAYOUT_TERMS if term in hay)
    return score


def is_pipeline_relevant(title: str, abstract: str | None = None) -> bool:
    from rag_literature_rag.catalog.taxonomy import categories_from_keywords

    return bool(categories_from_keywords(_haystack(title, abstract)))


def is_layout_relevant(
    title: str,
    abstract: str | None = None,
    *,
    strict: bool = False,
) -> bool:
    hay = _haystack(title, abstract)
    score = layout_relevance_score(title, abstract)
    if strict:
        return score >= 3 and _has_strong(hay)
    return score >= 3


# Preferred names for new code.
rag_relevance_score = layout_relevance_score
is_rag_relevant = is_layout_relevant
is_rag_topic_relevant = is_pipeline_relevant
