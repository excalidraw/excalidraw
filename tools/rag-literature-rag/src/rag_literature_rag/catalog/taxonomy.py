"""RAG literature taxonomy for catalog classification and harvest relevance."""

from __future__ import annotations

RAG_CATEGORIES: tuple[str, ...] = (
    "foundations",
    "dense-retrieval",
    "sparse-retrieval",
    "hybrid-retrieval",
    "chunking",
    "query-expansion",
    "reranking",
    "self-correcting",
    "graphrag",
    "agentic",
    "memory",
    "long-context",
    "evaluation",
    "training",
    "engineering",
    "survey",
)

# Back-compat alias used across query/catalog/harvest code.
PIPELINE_CATEGORIES = RAG_CATEGORIES

UNCATEGORIZED = "uncategorized"

TAG_TO_CATEGORIES: dict[str, list[str]] = {
    "foundations": ["foundations"],
    "generation": ["foundations"],
    "dense-retrieval": ["dense-retrieval"],
    "late-interaction": ["dense-retrieval"],
    "sparse-retrieval": ["sparse-retrieval"],
    "hybrid-retrieval": ["hybrid-retrieval"],
    "chunking": ["chunking"],
    "hierarchical-index": ["chunking"],
    "contextual-retrieval": ["chunking"],
    "query-expansion": ["query-expansion"],
    "query-rewriting": ["query-expansion"],
    "reranking": ["reranking"],
    "unified": ["reranking"],
    "self-correcting": ["self-correcting"],
    "reflection": ["self-correcting"],
    "evaluator": ["self-correcting"],
    "graphrag": ["graphrag"],
    "community": ["graphrag"],
    "ppr": ["graphrag"],
    "agentic": ["agentic"],
    "iterative-retrieval": ["agentic"],
    "planning": ["agentic"],
    "repair": ["agentic"],
    "memory": ["memory"],
    "draft-retrieval": ["memory"],
    "long-context": ["long-context"],
    "comparison": ["long-context"],
    "evaluation": ["evaluation"],
    "metrics": ["evaluation"],
    "robustness": ["evaluation"],
    "training": ["training"],
    "dual-tuning": ["training"],
    "engineering": ["engineering"],
    "implementer-guide": ["engineering"],
    "survey": ["survey"],
    "taxonomy": ["survey"],
    "sok": ["survey"],
    "embeddings": ["dense-retrieval"],
    "citation": ["dense-retrieval"],
    "framework": ["engineering"],
    "filtering": ["self-correcting"],
    "compression": ["chunking"],
    "adaptive": ["agentic"],
    "uncertainty": ["agentic"],
    "noise": ["self-correcting"],
    "trust": ["engineering"],
    "interfaces": ["agentic"],
    "reasoning": ["agentic"],
    "multi-hop": ["evaluation"],
    "bm25": ["sparse-retrieval"],
    "topic-seed": [],
    "awesome-rag-table": [],
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "foundations": [
        "retrieval-augmented generation",
        "retrieval augmented generation",
        "dense passage retrieval",
        "fusion-in-decoder",
        "open-domain question answering",
        "knowledge-intensive",
    ],
    "dense-retrieval": [
        "dense retrieval",
        "bi-encoder",
        "dual encoder",
        "colbert",
        "late interaction",
        "passage embedding",
        "text embedding",
        "specter",
        "scincl",
    ],
    "sparse-retrieval": [
        "bm25",
        "sparse retrieval",
        "splade",
        "lexical retrieval",
        "inverted index",
    ],
    "hybrid-retrieval": [
        "hybrid retrieval",
        "reciprocal rank fusion",
        "rrf",
        "dense sparse fusion",
        "hybrid search",
    ],
    "chunking": [
        "document chunking",
        "chunk size",
        "contextual retrieval",
        "contextual embedding",
        "hierarchical summar",
        "raptor",
        "structure-aware chunk",
        "sentence window",
    ],
    "query-expansion": [
        "hyde",
        "hypothetical document",
        "query expansion",
        "query rewriting",
        "multi-query",
        "step-back",
    ],
    "reranking": [
        "rerank",
        "cross-encoder",
        "listwise rerank",
        "rankrag",
        "relevance scoring",
    ],
    "self-correcting": [
        "self-rag",
        "corrective rag",
        "crag",
        "reflection token",
        "retrieval evaluator",
        "chain-of-note",
        "filco",
        "filter context",
    ],
    "graphrag": [
        "graphrag",
        "graph rag",
        "knowledge graph retrieval",
        "community summary",
        "hipporag",
        "lightrag",
        "noderag",
        "entity relation graph",
    ],
    "agentic": [
        "agentic rag",
        "iterative retrieval",
        "active retrieval",
        "flare",
        "auto-rag",
        "multi-hop retrieval",
        "retrieval loop",
        "plan then retrieve",
    ],
    "memory": [
        "memorag",
        "memory-augmented",
        "hypergraph memory",
        "long-term memory rag",
    ],
    "long-context": [
        "long context",
        "long-context",
        "context window",
        "longrag",
        "million token",
    ],
    "evaluation": [
        "rag evaluation",
        "ragas",
        "faithfulness",
        "retrieval benchmark",
        "rgb benchmark",
        "frames benchmark",
        "ndcg",
        "answer relevance",
    ],
    "training": [
        "ra-dit",
        "raft",
        "instruction tuning rag",
        "fine-tuning retrieval",
        "retrieval-aware training",
    ],
    "engineering": [
        "best practices",
        "rag pipeline",
        "rag stack",
        "production rag",
        "deployment rag",
        "dspy",
    ],
    "survey": [
        "survey",
        "systematization of knowledge",
        "sok",
        "taxonomy",
        "comprehensive review",
    ],
}


def categories_from_tags(tags: list[str]) -> set[str]:
    out: set[str] = set()
    for tag in tags:
        out.update(TAG_TO_CATEGORIES.get(tag, []))
    return out


def categories_from_keywords(text: str) -> set[str]:
    hay = text.lower()
    out: set[str] = set()
    for category, phrases in CATEGORY_KEYWORDS.items():
        if any(phrase in hay for phrase in phrases):
            out.add(category)
    return out
