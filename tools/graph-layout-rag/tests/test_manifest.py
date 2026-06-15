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


def test_upsert_merges_provider_provenance_by_doi_without_downgrading_pdf():
    manifest = Manifest()
    upsert_item(
        manifest,
        ManifestItem(
            id="openalex-a",
            title="Paper",
            source="openalex",
            url="https://example.test/paper.pdf",
            localPath="data/raw/pdf/a.pdf",
            status="ok",
            doi="10.1/a",
            tags=["openalex"],
            discoverySources=["openalex"],
            sourceUrls=["https://example.test/paper.pdf"],
        ),
    )
    upsert_item(
        manifest,
        ManifestItem(
            id="crossref-a",
            title="Paper",
            source="crossref",
            url="https://doi.org/10.1/a",
            status="metadata_only",
            doi="https://doi.org/10.1/A",
            abstract="Useful abstract",
            abstractSource="crossref",
            tags=["crossref"],
            discoverySources=["crossref"],
            sourceUrls=["https://doi.org/10.1/a"],
            externalIds={"DOI": "10.1/a"},
        ),
    )

    assert len(manifest.items) == 1
    item = manifest.items[0]
    assert item.id == "openalex-a"
    assert item.status == "ok"
    assert item.localPath == "data/raw/pdf/a.pdf"
    assert item.abstract == "Useful abstract"
    assert item.discoverySources == ["crossref", "openalex"]
    assert item.tags == ["crossref", "openalex"]
