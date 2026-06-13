from unittest.mock import MagicMock, patch

from graph_layout_rag.harvest.arxiv_bulk import _parse_entries, harvest_arxiv_category

ATOM = "http://www.w3.org/2005/Atom"


def _feed(*entries: str) -> str:
    body = "".join(entries)
    return f'<feed xmlns="{ATOM}">{body}</feed>'


def _entry(arxiv_id: str, title: str, summary: str) -> str:
    return f"""<entry>
      <id>http://arxiv.org/abs/{arxiv_id}</id>
      <title>{title}</title>
      <summary>{summary}</summary>
      <published>2021-05-01T00:00:00Z</published>
      <author><name>A. Author</name></author>
    </entry>"""


def test_parse_entries():
    papers = _parse_entries(_feed(_entry("2105.00001", "Layered graph drawing", "crossing minimization")))
    assert papers[0]["arxiv_id"] == "2105.00001"
    assert papers[0]["doi"] == "10.48550/arXiv.2105.00001"
    assert papers[0]["authors"] == ["A. Author"]


def test_harvest_category_strict_filters_and_stops_on_empty():
    page0 = _feed(
        _entry("2105.1", "Sugiyama layered graph drawing crossing minimization", "layout"),
        _entry("2105.2", "Smoothed analysis of the simplex method for LP", "optimization"),
    )
    empty = _feed()
    with patch("graph_layout_rag.harvest.arxiv_bulk.httpx.Client") as cc, \
         patch("graph_layout_rag.harvest.arxiv_bulk.time.sleep"):
        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        client.get.side_effect = [
            MagicMock(status_code=200, raise_for_status=MagicMock(), text=page0),
            MagicMock(status_code=200, raise_for_status=MagicMock(), text=empty),
        ]
        cc.return_value = client
        items = harvest_arxiv_category(max_works=50, dry_run=True, workers=1)
    titles = [i.title for i in items]
    assert any("Sugiyama" in t for t in titles)
    assert not any("simplex method" in t for t in titles)  # off-topic rejected
