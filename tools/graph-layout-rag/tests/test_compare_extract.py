import pathlib

from click.testing import CliRunner

from graph_layout_rag.ingest import compare_extract as ce
from graph_layout_rag.manifest import ManifestItem
from graph_layout_rag.pdf_text import PdfExtractResult


def _item() -> ManifestItem:
    return ManifestItem(
        id="d1",
        title="A two-column paper",
        authors=["A"],
        year=2020,
        source="s",
        url="https://example.org/d1",
        status="ok",
        localPath="data/pdfs/d1.pdf",
    )


def _fake_results():
    """Map (clean, backend) -> PdfExtractResult for a deterministic compare run."""
    raw = PdfExtractResult(pages=[(1, "net-\nwork strati-\nfied")])  # 2 hyphen breaks
    pymupdf = PdfExtractResult(pages=[(1, "network stratified text")])
    gemini = PdfExtractResult(
        pages=[(1, "## Title\n\n| a | b |\n| - | - |\nnetwork")], tokens=2_000_000
    )

    def fake(item, *, clean=True, backend="pymupdf"):
        if not clean:
            return raw
        return gemini if backend == "gemini" else pymupdf

    return fake


def test_compare_one_row_per_backend(monkeypatch):
    monkeypatch.setattr(ce, "extract_pdf_result", _fake_results())
    row = ce._compare_one(_item(), backends=["pymupdf", "gemini"])

    assert row["hyphen_breaks_baseline"] == 2
    assert [b["backend"] for b in row["backends"]] == ["pymupdf", "gemini"]

    gem = next(b for b in row["backends"] if b["backend"] == "gemini")
    assert gem["headings"] == 1
    assert gem["table_rows"] == 2
    assert gem["tokens"] == 2_000_000
    assert gem["est_cost"] == round(2.0 * 2.0, 4)  # 2M tokens * $2/Mtok default


def test_compare_cli_renders_multi_backend(monkeypatch, tmp_path):
    import graph_layout_rag.ingest.compare_extract as mod

    monkeypatch.setattr(mod, "extract_pdf_result", _fake_results())
    monkeypatch.setattr(
        mod, "load_manifest", lambda: type("M", (), {"items": [_item()]})()
    )
    monkeypatch.setattr(pathlib.Path, "is_file", lambda self: True)  # PKG_ROOT / localPath

    result = CliRunner().invoke(
        mod.compare_extract_cmd, ["--backend", "pymupdf", "--backend", "gemini"]
    )
    assert result.exit_code == 0, result.output
    assert "aggregate (mean per doc)" in result.output
    assert "pymupdf" in result.output and "gemini" in result.output
