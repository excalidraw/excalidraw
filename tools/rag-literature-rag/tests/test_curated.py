from rag_literature_rag.harvest.curated import IMPLEMENTER_GUIDES, harvest_curated
from rag_literature_rag.harvest.relevance import CURATED_SOURCES


def test_implementer_guides_cover_rag_frameworks():
    ids = {d["id"] for d in IMPLEMENTER_GUIDES}
    assert {"haystack-rag-pipeline", "langchain-rag"} <= ids


def test_implementer_sources_are_kept_by_prune():
    for doc in IMPLEMENTER_GUIDES:
        assert doc["source"] in CURATED_SOURCES, doc["source"]


def test_implementer_guides_have_urls_and_tags():
    for doc in IMPLEMENTER_GUIDES:
        assert doc.get("url"), doc["id"]
        assert doc["tags"]


def test_harvest_curated_dry_run():
    items = harvest_curated(dry_run=True)
    by_id = {i.id: i for i in items}
    haystack = by_id.get("haystack-rag-pipeline")
    assert haystack is not None
    assert haystack.status == "metadata_only"
    assert haystack.source == "implementer-guide"
    assert "engineering" in haystack.tags
