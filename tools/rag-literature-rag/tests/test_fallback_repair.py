from pathlib import Path

from rag_literature_rag.eval import fallback_repair as fr
from rag_literature_rag.ingest import extract_cache
from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.manifest import Manifest, ManifestItem
from rag_literature_rag.pdf_text import PdfExtractResult


def _item(doc_id: str, *, local_path: str | None = "data/raw/pdf/doc.pdf", status: str = "ok") -> ManifestItem:
    return ManifestItem(
        id=doc_id,
        title=f"Title {doc_id}",
        source="test",
        url=f"https://example.org/{doc_id}",
        status=status,
        localPath=local_path,
        doi=f"10.test/{doc_id}",
        sha256="sha",
    )


def test_ranked_fallback_docs_merges_qrel_weights(tmp_path: Path, monkeypatch):
    log_path = tmp_path / "ingest.log"
    log_path.write_text(
        "\n".join(
            [
                "DEBUG extracted document=doc-a status=ok chunks=1 reason=empty_pdf_metadata_fallback extraction_s=0.1",
                "DEBUG extracted document=doc-b status=ok chunks=1 reason=worker_error_metadata_fallback extraction_s=0.1",
                "DEBUG extracted document=doc-c status=ok chunks=4 reason=ok extraction_s=1.0",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        fr,
        "qrel_weights_by_track",
        lambda tracks: {"catalog": {"doc-a": 2, "doc-b": 1}, "pdf-deep-read": {"doc-b": 4}},
    )

    rows = fr.ranked_fallback_docs(log_path=log_path)

    assert [row["doc_id"] for row in rows] == ["doc-b", "doc-a"]
    assert rows[0]["qrels_by_track"] == {"catalog": 1, "pdf-deep-read": 4}
    assert rows[0]["qrel_placements"] == 5


def test_enrich_rows_classifies_existing_missing_and_metadata(tmp_path: Path, monkeypatch):
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF")
    manifest = Manifest(
        items=[
            _item("existing", local_path=str(pdf)),
            _item("missing-path", local_path=None),
            _item("missing-file", local_path=str(tmp_path / "absent.pdf")),
            _item("metadata", local_path=None, status="metadata_only"),
        ]
    )
    monkeypatch.setattr(fr, "load_manifest", lambda: manifest)
    monkeypatch.setattr(
        fr,
        "reproduce_extractors",
        lambda item, include_gemini=False: [
            fr.BackendReproduction(backend="pymupdf", available=True, pages=1, nonempty_pages=1, text_chars=10)
        ],
    )

    rows = fr.enrich_rows(
        [
            {"doc_id": "existing", "fallback_reason": "empty_pdf_metadata_fallback", "qrels_by_track": {}, "qrel_placements": 0},
            {"doc_id": "missing-path", "fallback_reason": "empty_pdf_metadata_fallback", "qrels_by_track": {}, "qrel_placements": 0},
            {"doc_id": "missing-file", "fallback_reason": "empty_pdf_metadata_fallback", "qrels_by_track": {}, "qrel_placements": 0},
            {"doc_id": "metadata", "fallback_reason": "empty_pdf_metadata_fallback", "qrels_by_track": {}, "qrel_placements": 0},
        ]
    )

    assert rows[0]["classification"] == "repairable_local_extraction"
    assert rows[0]["file_exists"] is True
    assert rows[1]["classification"] == "missing_pdf"
    assert rows[2]["classification"] == "missing_pdf"
    assert rows[3]["manifest_status"] == "metadata_only"
    assert rows[3]["classification"] == "missing_pdf"


def test_reproduce_extractors_classifies_success_open_error_and_empty(monkeypatch):
    item = _item("doc")

    def fake_extract(item, clean=True, backend="pymupdf"):
        if backend == "pymupdf":
            return PdfExtractResult(pages=[(1, "body text")])
        if backend == "docling":
            return PdfExtractResult(open_error="bad pdf")
        return PdfExtractResult(pages=[(1, "   ")], failed_pages=[1])

    monkeypatch.setattr(fr, "extract_pdf_result", fake_extract)

    rows = fr.reproduce_extractors(item, backends=("pymupdf", "docling", "gemini"))

    assert rows[0].extracts_text is True
    assert rows[0].text_quality["nonempty"] is True
    assert rows[1].open_error == "bad pdf"
    assert rows[1].extracts_text is False
    assert rows[2].failed_pages == 1
    assert rows[2].extracts_text is False


def test_classify_image_or_corrupt_when_local_backends_empty():
    reps = [
        fr.BackendReproduction(backend="pymupdf", available=True, pages=1, text_chars=0),
        fr.BackendReproduction(backend="docling", available=True, pages=0, text_chars=0),
    ]
    assert fr.classify_fallback(_item("doc"), True, reps) == "image_or_corrupt_pdf"


def test_text_quality_metrics_flags_duplicate_and_reference_heavy_text():
    metrics = fr.text_quality_metrics(
        [
            "Intro line\nIntro line\nBody",
            "References\n[1] A\n[2] B\n[3] C",
        ]
    )

    assert metrics["nonempty"] is True
    assert metrics["duplicate_line_ratio"] > 0
    assert metrics["reference_section_ratio"] > 0


def test_extract_cache_invalidate_removes_page_and_chunk_entries(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(extract_cache, "_CACHE_DIR", tmp_path / "extract_cache")
    monkeypatch.setattr(extract_cache, "_PAGE_CACHE_DIR", tmp_path / "extract_cache" / "pages")
    chunk = TextChunk(
        doc_id="doc",
        title="Title",
        text="body",
        page=1,
        chunk_index=0,
        source_url="https://example.org",
        year=None,
        tags=[],
        authors=[],
        pipeline_categories=[],
    )
    extract_cache.put("sha", "docling", [chunk], "profile")

    from rag_literature_rag.ingest.extract import PageText

    extract_cache.put_pages("sha", "docling", [PageText(page=1, text="body")])
    assert extract_cache.get("sha", "docling", "profile") is not None
    assert extract_cache.get_pages("sha", "docling") is not None

    result = extract_cache.invalidate("sha", "docling", chunk_profiles=("profile",))

    assert result["removed"] == 2
    assert extract_cache.get("sha", "docling", "profile") is None
    assert extract_cache.get_pages("sha", "docling") is None
