from unittest.mock import MagicMock, patch

from graph_layout_rag.harvest.crossref import (
    VENUES,
    _authors,
    _pdf_link,
    _search_crossref,
    _work_to_spec,
    _year,
)


def test_lipics_venues_present():
    labels = {v["label"] for v in VENUES}
    assert "GD & Network Visualization (LIPIcs)" in labels
    assert "SoCG (LIPIcs)" in labels
    # JGAA/CGTA still there
    assert "JGAA" in labels


def test_visualization_and_vlsi_venues_present():
    labels = {v["label"] for v in VENUES}
    # Visualization venues (overlap removal + general layout)
    assert "IEEE TVCG" in labels
    assert "Computer Graphics Forum (EuroVis)" in labels
    # VLSI CAD venues (compaction + packing)
    assert "IEEE TCAD" in labels
    assert "Int'l Symposium on Physical Design (ISPD)" in labels


def test_broad_venues_are_strictly_gated():
    # Broad journals must NOT be trusted — they carry large non-layout volume that
    # the strict relevance gate filters out.
    by_label = {v["label"]: v for v in VENUES}
    for label in ("IEEE TVCG", "Computer Graphics Forum (EuroVis)", "IEEE TCAD"):
        assert by_label[label]["trusted"] is False


def test_venue_specs_are_well_formed():
    for v in VENUES:
        assert v["params"]  # filter or query.container-title
        assert v["tags"]
        assert isinstance(v["trusted"], bool)


def _work():
    return {
        "DOI": "10.7155/jgaa.00474",
        "title": ["A Flow Formulation for Horizontal Coordinate Assignment"],
        "author": [{"given": "Ulf", "family": "Rüegg"}, {"family": "Carstens"}],
        "issued": {"date-parts": [[2018, 6]]},
        "abstract": "<jats:p>We present a <jats:italic>flow</jats:italic> formulation.</jats:p>",
        "link": [
            {"URL": "https://example.org/x.html", "content-type": "text/html"},
            {"URL": "https://jgaa.info/x.pdf", "content-type": "application/pdf"},
        ],
    }


def test_field_parsers():
    w = _work()
    assert _year(w) == 2018
    assert _authors(w) == ["Ulf Rüegg", "Carstens"]
    assert _pdf_link(w) == "https://jgaa.info/x.pdf"


def test_work_to_spec_strips_jats_abstract():
    spec = _work_to_spec(_work(), tags=["jgaa", "graph-drawing"])
    assert spec["doi"] == "10.7155/jgaa.00474"
    assert spec["abstract"] == "We present a flow formulation."
    assert spec["pdf_link"] == "https://jgaa.info/x.pdf"
    assert spec["tags"] == ["jgaa", "graph-drawing"]


def test_work_to_spec_requires_title():
    assert _work_to_spec({"DOI": "10.1/x"}, tags=[]) is None


def test_search_crossref_paginates_with_cursor():
    page1 = {"message": {"items": [{"DOI": "10.1/a"}], "next-cursor": "c2"}}
    page2 = {"message": {"items": [{"DOI": "10.1/b"}], "next-cursor": "c3"}}
    page3 = {"message": {"items": [], "next-cursor": "c4"}}

    with patch("graph_layout_rag.harvest.crossref.httpx.Client") as client_cls:
        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        client.get.side_effect = [
            MagicMock(status_code=200, json=MagicMock(return_value=page1)),
            MagicMock(status_code=200, json=MagicMock(return_value=page2)),
            MagicMock(status_code=200, json=MagicMock(return_value=page3)),
        ]
        client_cls.return_value = client
        results = _search_crossref({"filter": "issn:1526-1719"}, max_results=10, rows=1)

    assert [r["DOI"] for r in results] == ["10.1/a", "10.1/b"]
