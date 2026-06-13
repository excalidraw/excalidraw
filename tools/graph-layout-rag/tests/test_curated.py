from graph_layout_rag.harvest.curated import LIBRARY_DOCS, harvest_curated
from graph_layout_rag.harvest.relevance import CURATED_SOURCES


def test_library_docs_cover_layout_engines():
    sources = {d["source"] for d in LIBRARY_DOCS}
    assert {"ogdf", "elk", "dagre", "graphviz.org"} <= sources


def test_library_doc_sources_are_kept_by_prune():
    # New engine-doc sources must survive precision prune.
    for source in {d["source"] for d in LIBRARY_DOCS}:
        assert source in CURATED_SOURCES, source


def test_library_docs_have_scrapable_content_urls():
    for doc in LIBRARY_DOCS:
        assert doc.get("content_url"), doc["id"]
        assert doc["tags"]


def test_harvest_curated_dry_run_includes_library_docs():
    items = harvest_curated(dry_run=True)
    by_id = {i.id: i for i in items}
    ogdf = by_id.get("ogdf-modules-overview")
    assert ogdf is not None
    assert ogdf.status == "metadata_only"
    assert ogdf.source == "ogdf"
    assert "source-code-docs" in ogdf.tags
    # existing curated items still present
    assert "terrastruct-crossing-minimization-blog" in by_id
