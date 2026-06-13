from unittest.mock import MagicMock, patch

from graph_layout_rag.harvest import citations as cit
from graph_layout_rag.manifest import Manifest, ManifestItem


def _item(id_, source, doi):
    return ManifestItem(
        id=id_, title=id_, authors=[], year=2020, source=source,
        url=f"https://example.org/{id_}", status="ok", tags=[], doi=doi,
    )


def test_seed_dois_picks_high_signal_with_doi(monkeypatch):
    man = Manifest(version=1, updatedAt="x", items=[
        _item("a", "topic-seed", "10.1/a"),
        _item("b", "openalex", "10.1/b"),       # not high-signal -> skip
        _item("c", "handbook", None),            # no doi -> skip
        _item("d", "graphviz.org", "10.1/d"),
    ])
    monkeypatch.setattr(cit, "load_manifest", lambda: man)
    assert cit._seed_dois(max_seeds=10) == ["10.1/a", "10.1/d"]


def test_search_cites_paginates():
    page1 = {"results": [{"doi": "https://doi.org/10.1/x"}], "meta": {"next_cursor": "c2"}}
    page2 = {"results": [], "meta": {"next_cursor": None}}
    with patch("graph_layout_rag.harvest.citations.httpx.Client") as cc:
        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        client.get.side_effect = [
            MagicMock(status_code=200, raise_for_status=MagicMock(), json=MagicMock(return_value=page1)),
            MagicMock(status_code=200, raise_for_status=MagicMock(), json=MagicMock(return_value=page2)),
        ]
        cc.return_value = client
        out = cit._search_cites("W1", max_results=50)
    assert len(out) == 1
    assert cc.return_value.get.call_args_list[0].kwargs["params"]["filter"] == "cites:W1"


def test_harvest_strict_filters_and_dedups(monkeypatch):
    man = Manifest(version=1, updatedAt="x", items=[_item("a", "topic-seed", "10.1/seed")])
    monkeypatch.setattr(cit, "load_manifest", lambda: man)
    monkeypatch.setattr(cit, "_openalex_id_from_doi", lambda doi: "W999")
    citing = [
        {"doi": "https://doi.org/10.1/good", "display_name": "Sugiyama layered graph drawing crossing minimization"},
        {"doi": "https://doi.org/10.1/bad", "display_name": "Boreal tree root architecture ecology"},
    ]
    monkeypatch.setattr(cit, "_search_cites", lambda oa_id, max_results: citing)

    def _fake_resolve(doi, **kw):
        return ManifestItem(id="x", title=doi, authors=[], year=2021, source="forward-citation",
                            url="u", status="metadata_only", tags=["forward-citation", "graph-drawing"], doi=doi)
    monkeypatch.setattr(cit, "resolve_doi_with_fallbacks", _fake_resolve)

    items = cit.harvest_forward_citations(max_works=10, dry_run=True, workers=1)
    dois = {i.doi for i in items}
    assert "10.1/good" in dois
    assert "10.1/bad" not in dois  # off-topic rejected by strict gate
