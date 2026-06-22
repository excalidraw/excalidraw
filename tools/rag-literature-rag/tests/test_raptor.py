import numpy as np

from rag_literature_rag.ingest.chunk import TextChunk, chunk_profile_variant, chunking_fingerprint
from rag_literature_rag.ingest.doc_summary import SummaryCacheStats
from rag_literature_rag.ingest.raptor import (
    PROMPT_VERSION,
    build_raptor_tree,
    cluster_nodes,
    is_raptor_profile,
    raptor_cache_key,
)
from rag_literature_rag.manifest import ManifestItem


def _item() -> ManifestItem:
    return ManifestItem(
        id="doc",
        title="RAPTOR Paper",
        source="test",
        url="https://example.test/doc.pdf",
        localPath="data/raw/pdf/doc.pdf",
        status="ok",
        sha256="pdf-sha",
        tags=["rag"],
        authors=["A. Author"],
        year=2024,
    )


def _chunk(idx: int) -> TextChunk:
    return TextChunk(
        doc_id="doc",
        title="RAPTOR Paper",
        text=f"Retrieval augmented generation with recursive tree summaries chunk {idx}",
        page=idx + 1,
        chunk_index=idx,
        source_url="https://example.test/doc.pdf",
        year=2024,
        tags=["rag"],
        authors=["A. Author"],
        pipeline_categories=["chunking"],
        canonical_sha256="pdf-sha",
    )


def test_raptor_profile_chunking():
    assert is_raptor_profile("mlx-qwen4b-raptor-gemma4-v1")
    assert chunk_profile_variant("mlx-qwen4b-raptor-gemma4-v1") == "raptor-v1"
    fingerprint = chunking_fingerprint("mlx-qwen4b-raptor-gemma4-v1")
    assert fingerprint["max_tokens"] == 550


def test_cluster_nodes_splits_six_points():
    vectors = [
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
        [0.8, 0.2, 0.0],
        [0.0, 1.0, 0.0],
        [0.1, 0.9, 0.0],
        [0.2, 0.8, 0.0],
    ]
    labels = cluster_nodes(vectors, min_cluster=2)
    assert len(labels) == 6
    assert len(set(labels)) >= 2


def test_raptor_cache_key_changes_on_child_ids():
    base = {
        "child_ids": ["doc:0", "doc:1"],
        "model": "gemma4:e4b",
        "prompt_version": PROMPT_VERSION,
        "source_hash": "source-a",
    }
    original = raptor_cache_key(**base)
    changed = raptor_cache_key(**{**base, "child_ids": ["doc:0", "doc:2"]})
    assert changed != original


def test_build_raptor_tree_respects_depth_and_cache(tmp_path, monkeypatch):
    monkeypatch.setattr("rag_literature_rag.ingest.raptor.CACHE_DIR", tmp_path / "raptor_cache")
    monkeypatch.setattr("rag_literature_rag.ingest.raptor.MAX_DEPTH", 2)
    monkeypatch.setattr("rag_literature_rag.ingest.raptor.raptor_model", lambda: "gemma4:e4b")
    calls = {"count": 0}

    def fake_generate(prompt: str, *, model: str, host: str | None = None, max_tokens: int = 2048, temperature: float = 0.1, timeout: int = 180) -> str:
        calls["count"] += 1
        return (
            "This grounded cluster summary explains recursive abstractive processing, tree-organized "
            "retrieval, hierarchical clustering, and retrieval-augmented generation methods with enough "
            "detail for search while staying faithful to the supplied cluster passages and terminology. "
            "It preserves method names, datasets, benchmarks, limitations, and aliases without inventing "
            "unsupported claims beyond the supplied source passages and retrieval terminology."
        )

    monkeypatch.setattr("rag_literature_rag.ingest.raptor.generate_ollama", fake_generate)
    monkeypatch.setattr("rag_literature_rag.ingest.raptor.unload_ollama_model_for_raptor", lambda model=None: None)

    chunks = [_chunk(i) for i in range(8)]
    vectors = [[1.0, 0.0, 0.0] if i < 4 else [0.0, 1.0, 0.0] for i in range(8)]

    def embed_texts(texts: list[str]) -> list[list[float]]:
        return [
            [float(index), float(len(text) % 5), 0.25]
            for index, text in enumerate(texts)
        ]

    stats = SummaryCacheStats()
    first = build_raptor_tree(
        _item(),
        chunks,
        vectors,
        embed_texts=embed_texts,
        stats=stats,
    )
    second = build_raptor_tree(
        _item(),
        chunks,
        vectors,
        embed_texts=embed_texts,
        stats=stats,
    )

    assert first
    assert len(first) == len(second)
    assert calls["count"] >= 1
    assert stats.generated >= 1
    assert stats.hits >= 1
    assert max(node.tree_depth for node in first) >= 1
