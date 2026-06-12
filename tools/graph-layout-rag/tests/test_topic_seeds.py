from graph_layout_rag.harvest.topic_seeds import (
    PIPELINE_LAYOUT_DOI_SEEDS,
    TOPIC_DOI_SEEDS,
    TOPIC_METADATA_SEEDS,
    TOPIC_PDF_SEEDS,
    harvest_topic_seeds,
)


def test_topic_pdf_seed_ids():
    ids = {s["id"] for s in TOPIC_PDF_SEEDS}
    assert "elk-eclipse-layout-kernel-arxiv" in ids
    assert "sander-compound-directed-graphs" in ids
    assert "stratisfimal-layout" in ids
    assert "eades-1984-spring-heuristic" in ids


def test_topic_doi_seed_count():
    assert len(TOPIC_DOI_SEEDS) >= 40
    assert len(PIPELINE_LAYOUT_DOI_SEEDS) >= 12


def test_research_thread_metadata():
    ids = {s["id"] for s in TOPIC_METADATA_SEEDS}
    assert "research-thread-compaction" in ids
    assert "research-thread-packing" in ids
    assert "research-thread-overlap" in ids


def test_harvest_topic_seeds_dry_run():
    items = harvest_topic_seeds(dry_run=True)
    ids = {i.id for i in items}
    assert "elk-eclipse-layout-kernel-arxiv" in ids
    assert "mermaid-layouts-docs" in ids
    assert "research-thread-compaction" in ids
    assert any(i.tags and "topic-seed" in i.tags for i in items)
