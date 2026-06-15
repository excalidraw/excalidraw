from graph_layout_rag.manifest import Manifest, ManifestItem
from graph_layout_rag.query import identity
from graph_layout_rag.query.search import format_results


def _item(
    doc_id: str,
    *,
    source: str = "openalex",
    doi: str | None = None,
    sha: str | None = None,
    external_ids: dict[str, str] | None = None,
) -> ManifestItem:
    return ManifestItem(
        id=doc_id,
        title=f"Title {doc_id}",
        source=source,
        url=f"https://example.test/{doc_id}",
        status="ok",
        localPath=f"data/{doc_id}.pdf",
        doi=doi,
        sha256=sha,
        externalIds=external_ids or {},
    )


def test_identity_map_unions_doi_sha_and_provider_ids(monkeypatch):
    manifest = Manifest(
        items=[
            _item("curated", source="curated", doi="10.1/shared"),
            _item("doi-alias", doi="https://doi.org/10.1/shared"),
            _item("sha-alias", sha="same"),
            _item("provider-alias", sha="same", external_ids={"OpenAlex": "W1"}),
            _item("provider-alias-2", external_ids={"openalex": "w1"}),
        ]
    )
    monkeypatch.setattr(identity, "load_manifest", lambda: manifest)
    identity.clear_identity_cache()

    identities = identity.canonical_identity_map()
    assert identities.canonical_by_doc["doi-alias"] == "curated"
    assert identities.canonical_by_doc["sha-alias"] == "provider-alias"
    assert identities.canonical_by_doc["provider-alias-2"] == "provider-alias"

    identity.clear_identity_cache()


def test_format_results_groups_aliases_and_retains_ranked_evidence(monkeypatch):
    manifest = Manifest(
        items=[
            _item("canonical", source="curated", doi="10.1/shared"),
            _item("alias", doi="10.1/shared"),
            _item("other", doi="10.1/other"),
        ]
    )
    monkeypatch.setattr(identity, "load_manifest", lambda: manifest)
    monkeypatch.setattr("graph_layout_rag.query.search.catalog_maps", lambda: ({}, frozenset()))
    identity.clear_identity_cache()

    rows = [
        {
            "id": "alias:0",
            "doc_id": "alias",
            "title": "Shared paper",
            "text": "best evidence",
            "score": 0.9,
            "tags": "",
            "pipeline_categories": "",
        },
        {
            "id": "canonical:1",
            "doc_id": "canonical",
            "title": "Shared paper",
            "text": "second evidence",
            "score": 0.8,
            "tags": "",
            "pipeline_categories": "",
        },
        {
            "id": "other:0",
            "doc_id": "other",
            "title": "Other paper",
            "text": "other evidence",
            "score": 0.7,
            "tags": "",
            "pipeline_categories": "",
        },
    ]

    results = format_results(rows, top=5, max_per_doc=2)
    assert [row["canonical_doc_id"] for row in results] == ["canonical", "other"]
    assert results[0]["alias_doc_ids"] == ["alias"]
    assert [row["chunk_id"] for row in results[0]["evidence"]] == [
        "alias:0",
        "canonical:1",
    ]

    identity.clear_identity_cache()
