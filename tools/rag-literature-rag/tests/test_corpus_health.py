from pathlib import Path

from rag_literature_rag.eval import corpus_health


def test_scan_extraction_log_counts_fallback_reasons(tmp_path: Path):
    log_path = tmp_path / "ingest.log"
    log_path.write_text(
        "\n".join(
            [
                "DEBUG extracted document=doc-a status=ok chunks=4 reason=ok extraction_s=1.20 batch_documents=1/4",
                "DEBUG extracted document=doc-b status=ok chunks=1 reason=empty_pdf_metadata_fallback extraction_s=0.20 batch_documents=2/4",
                "DEBUG extracted document=doc-c status=ok chunks=1 reason=worker_error_metadata_fallback extraction_s=0.30 batch_documents=3/4",
                "DEBUG extracted document=doc-b status=ok chunks=1 reason=empty_pdf_metadata_fallback extraction_s=0.20 batch_documents=4/4",
            ]
        ),
        encoding="utf-8",
    )

    stats = corpus_health._scan_extraction_log(log_path)

    assert stats["ok"] == 1
    assert stats["fallback"] == 3
    assert stats["by_reason"] == {
        "empty_pdf_metadata_fallback": 2,
        "ok": 1,
        "worker_error_metadata_fallback": 1,
    }
    assert stats["fallback_by_reason"] == {
        "empty_pdf_metadata_fallback": 2,
        "worker_error_metadata_fallback": 1,
    }
    assert stats["fallback_docs"] == {
        "doc-b": "empty_pdf_metadata_fallback",
        "doc-c": "worker_error_metadata_fallback",
    }


def test_audit_extraction_fallback_reports_qrel_overlap(tmp_path: Path, monkeypatch):
    log_path = tmp_path / "ingest.log"
    log_path.write_text(
        "\n".join(
            [
                "DEBUG extracted document=doc-a status=ok chunks=4 reason=ok extraction_s=1.20 batch_documents=1/3",
                "DEBUG extracted document=doc-b status=ok chunks=1 reason=empty_pdf_metadata_fallback extraction_s=0.20 batch_documents=2/3",
                "DEBUG extracted document=doc-c status=ok chunks=1 reason=worker_error_metadata_fallback extraction_s=0.30 batch_documents=3/3",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(corpus_health, "_load_qrel_doc_weights", lambda track: {"doc-c": 3, "doc-b": 1})

    [finding] = corpus_health.audit_extraction_fallback(track="catalog", log_path=log_path)

    assert finding.severity == "critical"
    assert finding.detail["fallback"] == 2
    assert finding.detail["qrel_fallback_docs"] == 2
    assert finding.detail["qrel_fallback_judgments"] == 4
    assert finding.detail["top_qrel_fallback_docs"] == [
        {"doc_id": "doc-c", "judged_cases": 3, "reason": "worker_error_metadata_fallback"},
        {"doc_id": "doc-b", "judged_cases": 1, "reason": "empty_pdf_metadata_fallback"},
    ]


def test_audit_extraction_fallback_ignores_resolved_index_docs(tmp_path: Path, monkeypatch):
    log_path = tmp_path / "ingest.log"
    log_path.write_text(
        "\n".join(
            [
                "DEBUG extracted document=doc-a status=ok chunks=1 reason=empty_pdf_metadata_fallback extraction_s=0.20 batch_documents=1/2",
                "DEBUG extracted document=doc-b status=ok chunks=1 reason=empty_pdf_metadata_fallback extraction_s=0.20 batch_documents=2/2",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(corpus_health, "_load_qrel_doc_weights", lambda track: {"doc-a": 3, "doc-b": 2})
    monkeypatch.setattr(
        corpus_health,
        "_load_chunks",
        lambda profile: [
            {"doc_id": "doc-a", "text": "full text " * 600},
            {"doc_id": "doc-a", "text": "more full text"},
            {"doc_id": "doc-b", "text": "full text " * 600},
        ],
    )

    [finding] = corpus_health.audit_extraction_fallback(
        track="catalog",
        log_path=log_path,
        profile="profile",
    )

    assert finding.severity == "ok"
    assert finding.detail["fallback"] == 0
    assert finding.detail["historical_fallback_docs"] == 2
    assert finding.detail["resolved_fallback_docs"] == 2
    assert finding.detail["qrel_fallback_docs"] == 0
    assert finding.detail["top_qrel_fallback_docs"] == []
