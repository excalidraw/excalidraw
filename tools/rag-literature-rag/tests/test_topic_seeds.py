from rag_literature_rag.catalog.taxonomy import RAG_CATEGORIES
from rag_literature_rag.harvest.topic_seeds import (
    TOPIC_DOI_SEEDS,
    TOPIC_METADATA_SEEDS,
    TOPIC_PDF_SEEDS,
    harvest_topic_seeds,
)


def test_topic_pdf_seed_ids():
    ids = {s["id"] for s in TOPIC_PDF_SEEDS}
    assert "arxiv-2005-11401" in ids
    assert "arxiv-2004-04906" in ids
    assert "arxiv-2004-12832" in ids
    assert "arxiv-2312-10997" in ids


def test_topic_doi_seed_count():
    assert len(TOPIC_DOI_SEEDS) >= 40
    dois = {s["doi"] for s in TOPIC_DOI_SEEDS}
    assert "10.48550/arXiv.2310.11511" in dois  # Self-RAG
    assert "10.48550/arXiv.2404.16130" in dois  # GraphRAG
    assert "10.48550/arXiv.2603.07379" in dois  # SoK Agentic RAG


def test_topic_seed_tags_use_rag_taxonomy():
    from rag_literature_rag.catalog.taxonomy import RAG_CATEGORIES

    allowed = set(RAG_CATEGORIES) | {
        "topic-seed", "late-interaction", "parametric-memory", "pretraining", "reader",
        "generation", "taxonomy", "reflection", "evaluator", "hierarchical-index",
        "iterative-retrieval", "query-rewriting", "dual-tuning", "compression", "noise",
        "filtering", "adaptive", "uncertainty", "unified", "draft-retrieval", "ablation",
        "community", "ppr", "dual-level", "heterogeneous", "query-aware", "reasoning", "sok",
        "trust", "interfaces", "repair", "planning", "framework", "optimization", "robustness",
        "dynamic", "multi-hop", "bm25", "contextual", "citation", "comparison",
        "contextual-retrieval", "implementer-guide", "embeddings", "context", "metrics",
    }
    for spec in [*TOPIC_PDF_SEEDS, *TOPIC_DOI_SEEDS, *TOPIC_METADATA_SEEDS]:
        for tag in spec.get("tags", []):
            assert tag in allowed, f"unknown tag {tag!r} on {spec.get('id') or spec.get('doi')}"


def test_metadata_seeds_present():
    ids = {s["id"] for s in TOPIC_METADATA_SEEDS}
    assert "anthropic-contextual-retrieval-cookbook" in ids
    assert "llamaindex-advanced-rag" in ids


def test_harvest_topic_seeds_dry_run():
    items = harvest_topic_seeds(dry_run=True)
    ids = {i.id for i in items}
    assert "arxiv-2005-11401" in ids
    assert "anthropic-contextual-retrieval-cookbook" in ids
    assert any(i.tags and "topic-seed" in i.tags for i in items)
