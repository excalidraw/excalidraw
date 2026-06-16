from rag_literature_rag.harvest.ledger import (
    classify_outcome,
    init_db,
    log_attempt,
    query_attempts,
    summary,
)


def test_classify_outcome():
    assert classify_outcome(status=429) == ("rate_limited", True)
    assert classify_outcome(status=403) == ("forbidden", False)
    assert classify_outcome(status=200, ok=True) == ("ok", False)
    assert classify_outcome(status=200, reason="non-PDF") == ("not_pdf", False)


def test_ledger_log_and_query(tmp_path, monkeypatch):
    db_path = tmp_path / "harvest.db"
    monkeypatch.setattr("rag_literature_rag.harvest.ledger.HARVEST_DB_PATH", db_path)
    init_db()
    log_attempt(
        url="https://example.com/paper.pdf",
        outcome="rate_limited",
        transient=True,
        doc_id="test-doc",
        doi="10.1234/test",
        http_status=429,
    )
    rows = query_attempts(transient=True, limit=10)
    assert len(rows) == 1
    assert rows[0]["outcome"] == "rate_limited"
    rep = summary()
    assert rep["total_attempts"] == 1
    assert rep["by_outcome"]["rate_limited"] == 1
