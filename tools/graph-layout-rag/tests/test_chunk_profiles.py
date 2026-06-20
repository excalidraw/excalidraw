from graph_layout_rag.ingest.chunk import (
    chunk_pages,
    chunk_profile_variant,
    chunking_fingerprint,
    embed_input_text,
    enrich_texts_for_section,
    estimate_tokens,
    is_section_enriched_profile,
)
from graph_layout_rag.ingest.extract import PageText
from graph_layout_rag.ingest.extract_cache import _cache_key
from graph_layout_rag.manifest import ManifestItem


def _item() -> ManifestItem:
    return ManifestItem(
        id="doc1",
        title="Layered Graph Drawing",
        authors=["Sugiyama", "Tagawa", "Toda"],
        year=1981,
        source="handbook",
        url="https://example.org/doc1",
        status="ok",
        tags=["sugiyama"],
        doi="10.1000/example",
    )


def test_small2big_profile_uses_smaller_chunks():
    pages = [PageText(1, "# Layout\n\n" + "Sentence boundary. " * 500)]
    default_chunks = chunk_pages(_item(), pages)
    small_chunks = chunk_pages(_item(), pages, chunk_profile="cuda-qwen0.6b-small2big-v1")

    assert chunk_profile_variant("cuda-qwen0.6b-small2big-v1") == "small2big-v1"
    assert len(small_chunks) > len(default_chunks)
    assert all(estimate_tokens(chunk.text) <= 550 for chunk in small_chunks)
    assert "variant" not in chunking_fingerprint()
    assert chunking_fingerprint("cuda-qwen0.6b-small2big-v1")["max_tokens"] == 550


def test_section_profile_enriches_index_text_only():
    chunk = chunk_pages(
        _item(),
        [PageText(4, "# Layout\n\n## Layering\n\nbody text")],
        pipeline_categories=["layer-assignment"],
        alias_doc_ids=["alias-a"],
        alias_dois=["10.1000/alias"],
    )[0]
    base = embed_input_text(chunk)
    enriched = enrich_texts_for_section([chunk], [base])[0]

    assert is_section_enriched_profile("cuda-qwen0.6b-section-v1")
    assert enriched.startswith("Document: Layered Graph Drawing")
    assert "Section path: Layout > Layering" in enriched
    assert "Categories: layer-assignment" in enriched
    assert "Alias DOIs: 10.1000/alias" in enriched
    assert chunk.text == "# Layout\n\n## Layering\n\nbody text"


def test_extract_cache_key_includes_chunk_variant():
    default_key = _cache_key("abc", "pymupdf")
    small_key = _cache_key("abc", "pymupdf", "cuda-qwen0.6b-small2big-v1")

    assert default_key != small_key
