from rag_literature_rag.ingest.chunk import (
    MAX_TOKENS,
    chunk_pages,
    estimate_tokens,
    parse_markdown_blocks,
)
from rag_literature_rag.ingest.extract import PageText
from rag_literature_rag.manifest import ManifestItem


def _item() -> ManifestItem:
    return ManifestItem(
        id="paper",
        title="Paper",
        source="curated",
        url="https://example.test/paper",
        status="ok",
        tags=["crossing"],
    )


def test_heading_breadcrumb_and_page_span():
    pages = [
        PageText(2, "# Crossing Minimization\n\nIntro paragraph."),
        PageText(3, "## Sifting\n\nSifting paragraph."),
    ]
    blocks = parse_markdown_blocks(pages)
    assert blocks[-1].section_path == "Crossing Minimization > Sifting"
    chunks = chunk_pages(_item(), pages)
    assert chunks[-1].section_path == "Crossing Minimization > Sifting"
    assert chunks[0].page == 2 and chunks[-1].page_end == 3


def test_complete_paragraph_overlap():
    paragraph = "Overlap paragraph remains complete."
    pages = [
        PageText(
            1,
            "# Section\n\n" + ("First sentence. " * 180) + f"\n\n{paragraph}\n\n" + ("Tail sentence. " * 180),
        )
    ]
    chunks = chunk_pages(_item(), pages)
    assert len(chunks) >= 2
    assert any(chunk.text.startswith(paragraph) for chunk in chunks[1:])


def test_oversized_table_splits_at_rows_and_repeats_header():
    rows = "\n".join(f"| row {n} | {'value ' * 40} |" for n in range(180))
    pages = [PageText(1, f"| Name | Value |\n| --- | --- |\n{rows}")]
    chunks = chunk_pages(_item(), pages)
    assert len(chunks) > 1
    assert all(chunk.text.startswith("| Name | Value |\n| --- | --- |") for chunk in chunks)
    assert all(estimate_tokens(chunk.text) <= MAX_TOKENS for chunk in chunks)


def test_oversized_paragraph_uses_sentence_boundaries():
    pages = [PageText(1, "Sentence boundary. " * 600)]
    chunks = chunk_pages(_item(), pages)
    assert len(chunks) > 1
    assert all(chunk.text.endswith(".") for chunk in chunks)
    assert all(estimate_tokens(chunk.text) <= MAX_TOKENS for chunk in chunks)
