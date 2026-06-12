from unittest.mock import patch

from graph_layout_rag.harvest.bibliography import collect_bibliography_dois, extract_dois_from_text


def test_extract_dois_from_text():
    text = "See 10.1007/3-540-45848-4_3 and 10.1145/123.4567 for details."
    dois = extract_dois_from_text(text)
    assert "10.1007/3-540-45848-4_3" in dois
    assert "10.1145/123.4567" in dois


def test_collect_bibliography_dois_logs_and_filters(tmp_path, monkeypatch):
    from graph_layout_rag.manifest import Manifest, ManifestItem

    item = ManifestItem(
        id="seed-paper",
        title="Seed",
        source="handbook",
        url="https://example.com/a.pdf",
        localPath="data/raw/pdf/seed-paper.pdf",
        status="ok",
        tags=["handbook"],
        doi="10.1000/seed",
    )
    manifest = Manifest(items=[item])

    pdf_path = tmp_path / "data/raw/pdf/seed-paper.pdf"
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_path.write_bytes(b"%PDF-1.4")

    monkeypatch.setattr(
        "graph_layout_rag.harvest.bibliography.load_manifest",
        lambda: manifest,
    )
    monkeypatch.setattr(
        "graph_layout_rag.harvest.bibliography.PKG_ROOT",
        tmp_path,
    )
    monkeypatch.setattr(
        "graph_layout_rag.harvest.bibliography.read_pdf_text",
        lambda _: "Reference 10.1007/3-540-45848-4_3",
    )

    with patch(
        "graph_layout_rag.harvest.bibliography.filter_relevant_dois_resumable",
        return_value={"10.1007/3-540-45848-4_3": True},
    ):
        dois = collect_bibliography_dois(max_dois=10, workers=1)

    assert dois == ["10.1007/3-540-45848-4_3"]
