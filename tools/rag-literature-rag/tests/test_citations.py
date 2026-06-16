from rag_literature_rag.harvest import citations as cit
from rag_literature_rag.harvest.providers import OutcomeKind, RequestOutcome
from rag_literature_rag.manifest import Manifest, ManifestItem


def _item(id_, source, doi):
    return ManifestItem(
        id=id_, title=id_, authors=[], year=2020, source=source,
        url=f"https://example.org/{id_}", status="ok", tags=[], doi=doi,
    )


def test_seed_dois_picks_high_signal_with_doi(monkeypatch):
    man = Manifest(version=1, updatedAt="x", items=[
        _item("a", "topic-seed", "10.1/a"),
        _item("b", "forward-citation", "10.1/b"),
        _item("c", "awesome-rag-table", None),
        _item("d", "survey-seed", "10.1/d"),
    ])
    monkeypatch.setattr(cit, "load_manifest", lambda: man)
    assert cit._seed_dois(max_seeds=10) == ["10.1/a", "10.1/d"]


def test_search_cites_paginates(monkeypatch):
    page1 = {"results": [{"doi": "https://doi.org/10.1/x"}], "meta": {"next_cursor": "c2"}}
    page2 = {"results": [], "meta": {"next_cursor": None}}
    calls = []
    pages = iter([page1, page2])

    def fake_request(*args, **kwargs):
        calls.append(kwargs)
        return RequestOutcome(OutcomeKind.SUCCESS, data=next(pages), status_code=200)

    monkeypatch.setattr(cit.OPENALEX, "request_openalex", fake_request)
    out = cit._search_cites("W1", max_results=50)
    assert len(out) == 1
    assert calls[0]["params"]["filter"] == "cites:W1"


def test_harvest_strict_filters_and_dedups(monkeypatch):
    man = Manifest(version=1, updatedAt="x", items=[_item("a", "topic-seed", "10.1/seed")])
    monkeypatch.setattr(cit, "load_manifest", lambda: man)
    monkeypatch.setattr(cit, "_openalex_id_from_doi", lambda doi: "W999")
    citing = [
        {"doi": "https://doi.org/10.1/good", "display_name": "Self-RAG retrieval augmented generation reflection"},
        {"doi": "https://doi.org/10.1/bad", "display_name": "Boreal tree root architecture ecology"},
    ]
    monkeypatch.setattr(cit, "_search_cites", lambda oa_id, max_results: citing)

    def _fake_resolve(doi, **kw):
        return ManifestItem(
            id="x", title=doi, authors=[], year=2021, source="forward-citation",
            url="u", status="metadata_only", tags=["forward-citation"], doi=doi,
        )

    monkeypatch.setattr(cit, "resolve_doi_with_fallbacks", _fake_resolve)

    items = cit.harvest_forward_citations(max_works=10, dry_run=True, workers=1)
    dois = {i.doi for i in items}
    assert "10.1/good" in dois
    assert "10.1/bad" not in dois
