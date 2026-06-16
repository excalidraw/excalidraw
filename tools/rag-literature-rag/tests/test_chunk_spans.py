from rag_literature_rag.ingest.chunk import (
    CHUNK_CHARS,
    embed_body_text,
    embed_input_text,
    chunk_pages,
)
from rag_literature_rag.ingest.extract import PageText
from rag_literature_rag.manifest import ManifestItem


def _item() -> ManifestItem:
    return ManifestItem(
        id="doc1",
        title="Layered Graph Drawing",
        authors=["Sugiyama"],
        year=1981,
        source="handbook",
        url="https://example.org/doc1",
        status="ok",
        tags=["sugiyama", "layer-assignment"],
    )


def test_chunk_pages_no_runt_tail_chunks():
    # Two short pages that individually would each produce a tiny chunk; concatenation
    # should merge them into a single chunk instead of two runts.
    pages = [PageText(page=1, text="alpha " * 50), PageText(page=2, text="beta " * 50)]
    chunks = chunk_pages(_item(), pages, pipeline_categories=["layer-assignment"])
    assert len(chunks) == 1
    assert "alpha" in chunks[0].text and "beta" in chunks[0].text
    assert chunks[0].page == 1
    assert chunks[0].page_end == 2


def test_chunk_pages_tracks_page_spans_across_split():
    # One large page forces a split; spans should stay on the right page.
    big = "x " * (CHUNK_CHARS)  # > CHUNK_CHARS chars → multiple chunks
    pages = [PageText(page=3, text=big), PageText(page=4, text="tail content here")]
    chunks = chunk_pages(_item(), pages)
    assert len(chunks) >= 2
    assert chunks[0].page == 3
    # Last chunk should reach page 4 content.
    assert chunks[-1].page_end == 4
    # chunk_index is contiguous from 0.
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_chunk_pages_skips_empty_pages():
    pages = [PageText(page=1, text=""), PageText(page=2, text="only real text")]
    chunks = chunk_pages(_item(), pages)
    assert len(chunks) == 1
    assert chunks[0].page == 2


def test_embed_body_omits_title_but_keeps_topics_tags():
    pages = [PageText(page=1, text="body text")]
    chunk = chunk_pages(_item(), pages, pipeline_categories=["layer-assignment"])[0]
    body = embed_body_text(chunk)
    full = embed_input_text(chunk)
    assert "Title:" not in body
    assert "Topics: layer-assignment" in body
    assert "Title: Layered Graph Drawing" in full
