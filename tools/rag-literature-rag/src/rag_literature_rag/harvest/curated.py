"""Curated implementer guides and metadata stubs for RAG practitioners."""

from __future__ import annotations

from rag_literature_rag.manifest import ManifestItem


IMPLEMENTER_GUIDES = [
    {
        "id": "haystack-rag-pipeline",
        "title": "Haystack RAG Pipeline Documentation",
        "authors": ["deepset"],
        "year": 2024,
        "url": "https://docs.haystack.deepset.ai/docs/retrieval-augmented-generation",
        "source": "implementer-guide",
        "tags": ["engineering", "implementer-guide"],
        "abstract": "Production RAG pipeline patterns: retrievers, generators, and eval hooks.",
    },
    {
        "id": "langchain-rag",
        "title": "LangChain Retrieval-Augmented Generation",
        "authors": ["LangChain"],
        "year": 2024,
        "url": "https://python.langchain.com/docs/tutorials/rag/",
        "source": "implementer-guide",
        "tags": ["engineering", "implementer-guide"],
        "abstract": "Tutorial covering indexing, retrieval, and generation in LangChain RAG.",
    },
]


def harvest_curated(*, dry_run: bool = False, workers: int | None = None) -> list[ManifestItem]:
    del dry_run, workers
    return [
        ManifestItem(
            id=spec["id"],
            title=spec["title"],
            authors=spec.get("authors", []),
            year=spec.get("year"),
            source=spec["source"],
            url=spec["url"],
            localPath="",
            contentType="text/html",
            status="metadata_only",
            tags=list(spec.get("tags", [])),
            abstract=spec.get("abstract"),
        )
        for spec in IMPLEMENTER_GUIDES
    ]
