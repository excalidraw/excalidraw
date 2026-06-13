from graph_layout_rag.ingest.canonical import canonical_ingest_projection
from graph_layout_rag.ingest.run import ExtractionOutcome, _mark_outcome_ingested
from graph_layout_rag.manifest import ManifestItem


def _item(doc_id: str, source: str, *, status: str = "ok", sha: str | None = "same", doi: str | None = None, tags=()):
    return ManifestItem(
        id=doc_id,
        title=f"Title {doc_id}",
        authors=["Author"] if tags else [],
        source=source,
        url=f"https://example.test/{doc_id}",
        localPath=f"data/{doc_id}.pdf" if status == "ok" else None,
        status=status,
        sha256=sha,
        doi=doi,
        tags=list(tags),
    )


def test_projection_selects_trusted_rich_canonical_and_merges_aliases():
    discovery = _item("a-discovery", "openalex")
    curated = _item("z-curated", "curated", tags=("layered",))
    metadata_alias = _item("meta", "dblp", status="metadata_only", sha=None, doi="10/x")
    curated = curated.model_copy(update={"doi": "10/x"})
    docs = canonical_ingest_projection([discovery, curated, metadata_alias])
    assert len(docs) == 1
    assert docs[0].item.id == "z-curated"
    assert docs[0].alias_doc_ids == ["a-discovery", "meta"]
    assert "layered" in docs[0].item.tags


def test_all_aliases_checkpointed_after_outcome():
    canonical = _item("canonical", "curated")
    aliases = [_item("alias", "openalex")]
    state = {}
    _mark_outcome_ingested(ExtractionOutcome(canonical, [], aliases=aliases), state)
    assert state == {"canonical": "same", "alias": "same"}
