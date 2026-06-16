from unittest.mock import MagicMock, patch

from rag_literature_rag.harvest.crossref import (
    VENUES,
    _authors,
    _pdf_link,
    _search_crossref,
    _work_to_spec,
    _year,
)


def test_nlp_ir_venues_present():
    labels = {v["label"] for v in VENUES}
    assert "ACL Anthology" in labels
    assert "SIGIR" in labels
    assert "NeurIPS" in labels


def test_broad_venues_are_strictly_gated():
    by_label = {v["label"]: v for v in VENUES}
    for label in ("ACL Anthology", "SIGIR", "NeurIPS"):
        assert by_label[label]["trusted"] is False


def test_venue_specs_are_well_formed():
    for v in VENUES:
        assert v["params"]
        assert v["tags"]
        assert isinstance(v["trusted"], bool)


def _work():
    return {
        "DOI": "10.18653/v1/2024.acl-long.1",
        "title": ["Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"],
        "author": [{"given": "Patrick", "family": "Lewis"}],
        "issued": {"date-parts": [[2024, 8]]},
        "abstract": "<jats:p>We study <jats:italic>retrieval augmented generation</jats:italic>.</jats:p>",
        "link": [
            {"URL": "https://example.org/x.html", "content-type": "text/html"},
            {"URL": "https://aclanthology.org/paper.pdf", "content-type": "application/pdf"},
        ],
    }


def test_field_parsers():
    w = _work()
    assert _year(w) == 2024
    assert _authors(w) == ["Patrick Lewis"]
    assert _pdf_link(w) == "https://aclanthology.org/paper.pdf"


def test_work_to_spec_strips_jats_abstract():
    spec = _work_to_spec(_work(), tags=["acl", "nlp"])
    assert spec["doi"] == "10.18653/v1/2024.acl-long.1"
    assert spec["abstract"] == "We study retrieval augmented generation."
    assert spec["pdf_link"] == "https://aclanthology.org/paper.pdf"
    assert spec["tags"] == ["acl", "nlp"]


def test_work_to_spec_requires_title():
    assert _work_to_spec({"DOI": "10.1/x"}, tags=[]) is None


def test_search_crossref_paginates_with_cursor():
    page1 = {"message": {"items": [{"DOI": "10.1/a"}], "next-cursor": "c2"}}
    page2 = {"message": {"items": [{"DOI": "10.1/b"}], "next-cursor": "c3"}}
    page3 = {"message": {"items": [], "next-cursor": "c4"}}

    with patch("rag_literature_rag.harvest.crossref.httpx.Client") as client_cls:
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
