from rag_literature_rag.catalog.classify import classify_item
from rag_literature_rag.catalog.taxonomy import categories_from_tags
from rag_literature_rag.manifest import ManifestItem


def _item(**kwargs) -> ManifestItem:
    defaults = {
        "id": "test-doc",
        "title": "Untitled",
        "source": "test",
        "url": "https://example.com",
        "status": "ok",
    }
    defaults.update(kwargs)
    return ManifestItem(**defaults)


def test_self_rag_by_tag():
    item = _item(
        id="self-rag",
        title="Self-RAG: Learning to Retrieve, Generate, and Critique",
        tags=["self-correcting", "reflection"],
    )
    categories, methods = classify_item(item)
    assert "self-correcting" in categories
    assert methods[categories.index("self-correcting")] == "tag"


def test_graphrag_by_tag():
    item = _item(
        title="From Local to Global: A Graph RAG Approach",
        tags=["graphrag", "community"],
    )
    categories, _ = classify_item(item)
    assert "graphrag" in categories


def test_keyword_fallback_hybrid_retrieval():
    item = _item(
        title="Hybrid dense sparse retrieval with reciprocal rank fusion",
        tags=["openalex"],
        abstract="We combine BM25 and dense embeddings using RRF.",
    )
    categories, methods = classify_item(item)
    assert "hybrid-retrieval" in categories
    assert methods[categories.index("hybrid-retrieval")] == "keyword"


def test_multi_category_agentic_and_evaluation():
    item = _item(
        title="SoK: Agentic RAG evaluation trajectory formalization",
        tags=["agentic", "sok", "evaluation"],
    )
    categories, _ = classify_item(item)
    assert "agentic" in categories
    assert "evaluation" in categories or "survey" in categories


def test_uncategorized_generic_title():
    item = _item(
        title="R: A Language and Environment for Statistical Computing",
        tags=["openalex", "rag-literature"],
    )
    categories, _ = classify_item(item)
    assert categories == []


def test_tag_maps_for_rag_pipeline():
    assert "dense-retrieval" in categories_from_tags(["late-interaction"])
    assert "query-expansion" in categories_from_tags(["query-rewriting"])
    assert "chunking" in categories_from_tags(["hierarchical-index"])
    cats = categories_from_tags(["graphrag", "community"])
    assert "graphrag" in cats
