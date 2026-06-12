from graph_layout_rag.catalog.classify import classify_item
from graph_layout_rag.catalog.taxonomy import categories_from_tags
from graph_layout_rag.manifest import ManifestItem


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


def test_sander_compound_by_tag():
    item = _item(
        id="sander-compound-directed-graphs",
        title="Layout of Compound Directed Graphs",
        tags=["compound", "layered", "dagre", "clustering"],
    )
    categories, methods = classify_item(item)
    assert "compound" in categories
    assert methods[categories.index("compound")] == "tag"


def test_gansner_tse93_layer_assignment_by_tag():
    item = _item(
        id="gansner-tse93",
        title="A Technique for Drawing Directed Graphs",
        tags=["dot", "hierarchical", "layered", "rank"],
    )
    categories, methods = classify_item(item)
    assert "layer-assignment" in categories
    assert methods[categories.index("layer-assignment")] == "tag"


def test_left_edge_packing_by_tag():
    item = _item(
        title="Wire routing by optimizing channel assignment",
        tags=["packing", "channel-routing", "left-edge"],
    )
    categories, _ = classify_item(item)
    assert "packing" in categories
    assert "routing" in categories


def test_keyword_fallback_crossing():
    item = _item(
        title="Using Sifting for k-Layer Straightline Crossing Minimization",
        tags=["graph-drawing"],
        abstract="We study crossing minimization in layered graphs.",
    )
    categories, methods = classify_item(item)
    assert "crossing" in categories
    assert "layer-assignment" in categories
    assert methods[categories.index("crossing")] == "keyword"


def test_multi_category_compound_and_crossing():
    item = _item(
        title="Applying Crossing Reduction Strategies to Layered Compound Graphs",
        tags=["compound", "crossing", "layered"],
    )
    categories, _ = classify_item(item)
    assert "compound" in categories
    assert "crossing" in categories
    assert "layer-assignment" in categories


def test_uncategorized_generic_title():
    item = _item(
        title="R: A Language and Environment for Statistical Computing",
        tags=["openalex", "graph-drawing"],
    )
    categories, _ = classify_item(item)
    assert categories == []


def test_ports_maps_to_constraints_and_routing():
    assert "constraints" in categories_from_tags(["ports"])
    assert "routing" in categories_from_tags(["ports"])
