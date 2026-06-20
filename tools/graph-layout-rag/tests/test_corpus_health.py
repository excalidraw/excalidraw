from graph_layout_rag.eval import corpus_health


def test_audit_chunk_distribution_reports_expected_counts(monkeypatch):
    rows = [
        {"doc_id": "paper-a", "text": "a", "canonical_sha256": "sha-a"},
        {"doc_id": "paper-a", "text": "b", "canonical_sha256": "sha-a"},
        {"doc_id": "paper-b", "text": "c", "canonical_sha256": "sha-b"},
        {"doc_id": "paper-b", "text": "d", "canonical_sha256": "sha-b"},
        {"doc_id": "paper-b", "text": "e", "canonical_sha256": "sha-b"},
        {"doc_id": "paper-b", "text": "f", "canonical_sha256": "sha-b"},
        {"doc_id": "paper-b", "text": "g", "canonical_sha256": "sha-b"},
    ]
    monkeypatch.setattr(corpus_health, "_load_chunks", lambda profile: rows)
    monkeypatch.setattr(corpus_health, "_pdfs_on_disk", lambda: {"paper-a", "paper-b"})

    findings = corpus_health.audit_chunk_distribution("test-profile", min_mean=2.0)

    summary = next(f for f in findings if f.code == "chunk_summary")
    assert summary.detail["chunks"] == 7
    assert summary.detail["docs"] == 2
    assert summary.detail["pdfs_on_disk"] == 2
    assert any(f.code == "chunk_density_ok" for f in findings)


def test_run_audit_sorts_critical_first(monkeypatch):
    monkeypatch.setattr(
        corpus_health,
        "audit_chunk_distribution",
        lambda profile: [corpus_health.Finding("critical", "no_index", "missing")],
    )
    monkeypatch.setattr(corpus_health, "audit_extraction_fallback", lambda: [])
    monkeypatch.setattr(corpus_health, "audit_credentials", lambda: [])
    monkeypatch.setattr(corpus_health, "audit_pool_holes", lambda track: [])

    report = corpus_health.run_audit("missing-profile")

    assert report["worst_severity"] == "critical"
    assert report["n_critical"] == 1
    assert report["findings"][0]["code"] == "no_index"
