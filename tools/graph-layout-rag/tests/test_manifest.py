from graph_layout_rag.manifest import Manifest, ManifestItem, slug_id, upsert_item


def test_slug_id():
    assert slug_id("A Technique for Drawing Directed Graphs") == "a-technique-for-drawing-directed-graphs"


def test_upsert_replaces_by_id():
    manifest = Manifest()
    item = ManifestItem(
        id="test-1",
        title="First",
        source="test",
        url="https://example.com/1",
        status="ok",
    )
    upsert_item(manifest, item)
    assert len(manifest.items) == 1

    updated = item.model_copy(update={"title": "Updated"})
    upsert_item(manifest, updated)
    assert len(manifest.items) == 1
    assert manifest.items[0].title == "Updated"
