"""Semantic Scholar incoming-citation parsing and edge writing (no live network)."""

from graph_layout_rag import citation_store as cs
from graph_layout_rag.harvest import cite_enrich


class _FakeResp:
    def __init__(self, status, payload):
        self.status_code = status
        self._payload = payload

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, pages):
        self._pages = list(pages)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get(self, url, params=None):
        return self._pages.pop(0)


def test_fetch_s2_incoming_parses_pages(monkeypatch):
    page = _FakeResp(200, {
        "next": None,
        "data": [
            {"isInfluential": True, "citingPaper": {"paperId": "P1", "externalIds": {"DOI": "10.1/X"}, "year": 2020}},
            {"isInfluential": False, "citingPaper": {"paperId": "P2", "externalIds": {}, "year": 2021}},
        ],
    })
    monkeypatch.setattr(cite_enrich.httpx, "Client", lambda *a, **k: _FakeClient([page]))

    out = cite_enrich._fetch_s2_incoming("10.1/seed", cap=10)
    assert out is not None and len(out) == 2
    assert out[0] == {"doi": "10.1/x", "paper_id": "P1", "year": 2020, "is_influential": True}
    assert out[1]["doi"] is None and out[1]["paper_id"] == "P2"


def test_fetch_s2_incoming_404_returns_none(monkeypatch):
    monkeypatch.setattr(
        cite_enrich.httpx, "Client", lambda *a, **k: _FakeClient([_FakeResp(404, {})])
    )
    assert cite_enrich._fetch_s2_incoming("10.1/missing", cap=10) is None


def _db(tmp_path, monkeypatch):
    path = tmp_path / "citations.sqlite"
    monkeypatch.setattr("graph_layout_rag.citation_store.CITATIONS_DB_PATH", path)
    return cs.connect(path)


def test_incoming_pass_writes_edges_and_node_ids(tmp_path, monkeypatch):
    db = _db(tmp_path, monkeypatch)
    # Two corpus papers: a (W1) and b (W2).
    cs.upsert_paper(db, oa_id="W1", doi="10.1/a", doc_id="doc-a", in_corpus=True, enriched_at="t")
    cs.upsert_paper(db, oa_id="W2", doi="10.1/b", doc_id="doc-b", in_corpus=True, enriched_at="t")
    db.commit()

    # a is cited by: corpus paper b (DOI maps -> W2) and an external paper (DOI 10.3/x).
    def fake_fetch(doi, *, cap):
        if doi == "10.1/a":
            return [
                {"doi": "10.1/b", "paper_id": "Pb", "year": 2019, "is_influential": True},
                {"doi": "10.3/x", "paper_id": "Px", "year": 2020, "is_influential": False},
            ]
        return []

    monkeypatch.setattr(cite_enrich, "_fetch_s2_incoming", fake_fetch)
    specs = [
        {"doi": "10.1/a", "doc_id": "doc-a", "title": "A", "year": 1990},
        {"doi": "10.1/b", "doc_id": "doc-b", "title": "B", "year": 1991},
    ]

    class _Log:
        def info(self, *a, **k): pass
        def warning(self, *a, **k): pass

    stats = cite_enrich._s2_incoming_pass(db, specs, cap=10, checkpoint_every=50, log=_Log())
    assert stats["incoming_edges"] == 2

    # Corpus citer reuses the corpus oa id; external citer gets a synthetic doi: node.
    assert cs.cited_by_of(db, "W1") == {"W2", "doi:10.3/x"}
    # Influence flagged on the corpus->corpus edge.
    infl = db.execute("SELECT is_influential FROM cites WHERE src_oa='W2' AND dst_oa='W1'").fetchone()[0]
    assert infl == 1
    # Resumption marker set so a rerun skips done papers.
    assert "10.1/a" in cs.incoming_done_dois(db)
