from graph_layout_rag import citation_store as cs


def test_normalize_doi():
    assert cs.normalize_doi("https://doi.org/10.1109/TSE.1979.234212") == "10.1109/tse.1979.234212"
    assert cs.normalize_doi("doi:10.1007/BF02122694") == "10.1007/bf02122694"
    assert cs.normalize_doi("10.1145/321850.321852).") == "10.1145/321850.321852"
    assert cs.normalize_doi("not-a-doi") is None
    assert cs.normalize_doi(None) is None


def test_normalize_oa_id():
    assert cs.normalize_oa_id("https://openalex.org/W2034567") == "W2034567"
    assert cs.normalize_oa_id("W123") == "W123"
    assert cs.normalize_oa_id(None) is None
    assert cs.normalize_oa_id("https://openalex.org/A555") is None  # author id, not a work


def _db(tmp_path, monkeypatch):
    path = tmp_path / "citations.sqlite"
    monkeypatch.setattr("graph_layout_rag.citation_store.CITATIONS_DB_PATH", path)
    return cs.connect(path)


def test_upsert_paper_idempotent_and_preserves(tmp_path, monkeypatch):
    db = _db(tmp_path, monkeypatch)
    cs.upsert_paper(db, oa_id="W1", doi="10.1/a", doc_id="doc-a", title="A", year=1990,
                    cited_by_count=100, in_corpus=True, enriched_at="t0")
    # A cheap external-neighbor re-upsert (nulls) must not clobber the full row.
    cs.upsert_paper(db, oa_id="W1")
    row = cs.paper_row(db, "W1")
    assert row["doi"] == "10.1/a" and row["doc_id"] == "doc-a"
    assert row["cited_by_count"] == 100 and row["in_corpus"] == 1
    # cited_by_count only grows.
    cs.upsert_paper(db, oa_id="W1", cited_by_count=50)
    assert cs.paper_row(db, "W1")["cited_by_count"] == 100


def test_cites_and_influential_merge(tmp_path, monkeypatch):
    db = _db(tmp_path, monkeypatch)
    cs.upsert_paper(db, oa_id="W1", doi="10.1/a", doc_id="doc-a", in_corpus=True, enriched_at="t")
    cs.upsert_paper(db, oa_id="W2", doi="10.1/b", doc_id="doc-b", in_corpus=True, enriched_at="t")
    cs.add_cites(db, [("W1", "W2", 0), ("W1", "W1", 0)])  # self-loop dropped
    assert cs.references_of(db, "W1") == {"W2"}
    assert cs.cited_by_of(db, "W2") == {"W1"}
    # influential flag is OR-ed in and never reset.
    assert cs.set_influential_by_doi(db, "10.1/a", "10.1/b") == 1
    assert db.execute("SELECT is_influential FROM cites WHERE src_oa='W1'").fetchone()[0] == 1
    cs.add_cites(db, [("W1", "W2", 0)])
    assert db.execute("SELECT is_influential FROM cites WHERE src_oa='W1'").fetchone()[0] == 1


def test_authorship_and_counts(tmp_path, monkeypatch):
    db = _db(tmp_path, monkeypatch)
    cs.upsert_paper(db, oa_id="W1", doi="10.1/a", doc_id="doc-a", in_corpus=True, enriched_at="t")
    cs.add_authorships(db, [(cs.author_key("Eades, P."), "doc-a"),
                            (cs.author_key("Peter Eades"), "doc-b")])
    # "Eades, P." and "Peter Eades" don't collapse, but exact repeats are ignored.
    cs.add_authorships(db, [(cs.author_key("Sugiyama"), "doc-a"),
                            (cs.author_key("Sugiyama"), "doc-b")])
    assert cs.coauthored_doc_ids(db, "doc-a") == {"doc-b"}  # shared "sugiyama"
    c = cs.counts(db)
    assert c["corpus_papers"] == 1 and c["cite_edges"] == 0 and c["authorship_edges"] == 4


def test_aliases_and_citation_provenance(tmp_path, monkeypatch):
    db = _db(tmp_path, monkeypatch)
    cs.upsert_paper(db, oa_id="W1", doi="10.1/a")
    cs.upsert_paper(db, oa_id="W2", doi="10.1/b")
    cs.upsert_alias(db, provider="DOI", external_id="10.1/a", oa_id="W1")
    cs.add_cites(db, [("W1", "W2", 0)], provider="openalex")
    cs.add_cites(db, [("W1", "W2", 1)], provider="semantic-scholar")
    db.commit()

    assert cs.oa_id_for_alias(db, provider="doi", external_id="10.1/a") == "W1"
    providers = {
        row[0]
        for row in db.execute(
            "SELECT provider FROM cite_provenance WHERE src_oa='W1' AND dst_oa='W2'"
        )
    }
    assert providers == {"openalex", "semantic-scholar"}
    assert cs.counts(db)["citation_provenance"] == 2
