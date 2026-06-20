from rag_literature_rag.ingest.chunk import (
    chunk_pages_with_parents,
    chunk_pages,
    chunk_profile_variant,
    chunking_fingerprint,
    embed_input_text,
    enrich_texts_for_section,
    estimate_tokens,
    is_section_enriched_profile,
)
from rag_literature_rag.ingest import embed_cache
from rag_literature_rag.ingest.extract import PageText
from rag_literature_rag.ingest.extract_cache import _cache_key, _page_cache_key
from rag_literature_rag.manifest import ManifestItem
from rag_common.config import EmbedConfig


def _item() -> ManifestItem:
    return ManifestItem(
        id="doc1",
        title="Retrieval-Augmented Generation",
        authors=["Lewis", "Perez"],
        year=2020,
        source="curated",
        url="https://example.org/doc1",
        status="ok",
        tags=["rag"],
        doi="10.1000/example",
    )


def test_small2big_profile_uses_smaller_chunks():
    pages = [PageText(1, "# Retrieval\n\n" + "Sentence boundary. " * 500)]
    default_chunks = chunk_pages(_item(), pages)
    small_chunks = chunk_pages(_item(), pages, chunk_profile="cuda-qwen0.6b-small2big-v1")

    assert chunk_profile_variant("cuda-qwen0.6b-small2big-v1") == "small2big-v1"
    assert len(small_chunks) > len(default_chunks)
    assert all(estimate_tokens(chunk.text) <= 550 for chunk in small_chunks)
    assert "variant" not in chunking_fingerprint()
    assert chunking_fingerprint("cuda-qwen0.6b-small2big-v1")["max_tokens"] == 550
    dual_fingerprint = chunking_fingerprint("cuda-qwen0.6b-small2big-dual-v1")
    assert dual_fingerprint["max_tokens"] == 550
    assert dual_fingerprint["parent_max_tokens"] == 1200


def test_longrag_profile_uses_larger_chunks():
    pages = [PageText(1, "# Retrieval\n\n" + "Sentence boundary. " * 900)]
    default_chunks = chunk_pages(_item(), pages)
    longrag_chunks = chunk_pages(_item(), pages, chunk_profile="cuda-qwen0.6b-longrag-v1")

    assert chunk_profile_variant("cuda-qwen0.6b-longrag-v1") == "longrag-v1"
    assert len(longrag_chunks) < len(default_chunks)
    assert all(estimate_tokens(chunk.text) <= 2400 for chunk in longrag_chunks)
    fingerprint = chunking_fingerprint("cuda-qwen0.6b-longrag-v1")
    assert fingerprint["variant"] == "longrag-v1"
    assert fingerprint["target_tokens"] == 1800
    assert fingerprint["max_tokens"] == 2400


def test_section_profile_enriches_index_text_only():
    chunk = chunk_pages(
        _item(),
        [PageText(4, "# Retrieval\n\n## Fusion\n\nbody text")],
        pipeline_categories=["hybrid-retrieval"],
        alias_doc_ids=["alias-a"],
        alias_dois=["10.1000/alias"],
    )[0]
    base = embed_input_text(chunk)
    enriched = enrich_texts_for_section([chunk], [base])[0]

    assert is_section_enriched_profile("cuda-qwen0.6b-section-v1")
    assert enriched.startswith("Document: Retrieval-Augmented Generation")
    assert "Section path: Retrieval > Fusion" in enriched
    assert "Categories: hybrid-retrieval" in enriched
    assert "Alias DOIs: 10.1000/alias" in enriched
    assert chunk.text == "# Retrieval\n\n## Fusion\n\nbody text"


def test_extract_cache_key_includes_chunk_variant():
    default_key = _cache_key("abc", "pymupdf")
    small_key = _cache_key("abc", "pymupdf", "cuda-qwen0.6b-small2big-v1")

    assert default_key != small_key


def test_page_cache_key_is_chunk_profile_independent_but_option_aware():
    default_key = _page_cache_key("abc", "docling", options={"tables": "true"})
    same_key_for_new_chunking = _page_cache_key(
        "abc",
        "docling",
        options={"tables": "true"},
    )
    no_tables_key = _page_cache_key("abc", "docling", options={"tables": "false"})

    assert default_key == same_key_for_new_chunking
    assert default_key != no_tables_key


def test_small2big_dual_builds_parents_and_maps_every_child():
    pages = [
        PageText(
            1,
            "# Retrieval\n\n## Dense\n\n" + "Dense retrieval sentence. " * 220,
        ),
        PageText(
            2,
            "## Hybrid\n\n" + "Hybrid fusion sentence. " * 220,
        ),
    ]
    bundle = chunk_pages_with_parents(_item(), pages)

    assert bundle.parents
    assert bundle.children
    assert len(bundle.children) >= len(bundle.parents)
    parent_ids = {f"{parent.doc_id}:{parent.chunk_index}" for parent in bundle.parents}
    assert all(child.parent_id in parent_ids for child in bundle.children)
    assert all(child.parent_page is not None for child in bundle.children)
    assert all(child.page_end is None or child.page <= child.page_end for child in bundle.children)


def test_embed_cache_key_changes_on_text_title_and_config(tmp_path, monkeypatch):
    monkeypatch.setattr(embed_cache, "_CACHE_DIR", tmp_path / "embed_cache")
    cfg = EmbedConfig("local", "model-a", 3, quant="bnb-4bit")

    assert embed_cache.get(cfg, title="Title", text="body") is None
    embed_cache.put(cfg, title="Title", text="body", vector=[0.1, 0.2, 0.3])
    assert embed_cache.get(cfg, title="Title", text="body") == [0.1, 0.2, 0.3]
    assert embed_cache.get(cfg, title="Other", text="body") is None
    assert embed_cache.get(cfg, title="Title", text="other") is None
    assert embed_cache.get(EmbedConfig("local", "model-a", 2, quant="bnb-4bit"), title="Title", text="body") is None
    assert embed_cache.get(EmbedConfig("local", "model-b", 3, quant="bnb-4bit"), title="Title", text="body") is None
    assert embed_cache.get(EmbedConfig("local", "model-a", 3, quant="none"), title="Title", text="body") is None
