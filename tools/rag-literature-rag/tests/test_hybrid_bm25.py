from pathlib import Path

import tantivy

from rag_literature_rag.ingest import bm25
from rag_literature_rag.ingest.chunk import TextChunk
from rag_literature_rag.query.hybrid import reciprocal_rank_fusion


def _chunk(doc_id: str, idx: int, text: str, **kw) -> TextChunk:
    return TextChunk(
        doc_id=doc_id,
        title=kw.get("title", f"Paper {doc_id}"),
        text=text,
        page=kw.get("page", 1),
        chunk_index=idx,
        source_url=kw.get("source_url", f"https://example.org/{doc_id}"),
        year=kw.get("year"),
        tags=kw.get("tags", ["sugiyama"]),
        authors=kw.get("authors", ["Gansner"]),
        pipeline_categories=kw.get("pipeline_categories", ["layer-assignment"]),
        page_end=kw.get("page_end", 1),
    )


def test_bm25_roundtrip_and_term_match(tmp_path: Path):
    index_dir = tmp_path / "bm25"
    chunks = [
        _chunk("a", 0, "network simplex rank assignment in layered drawing"),
        _chunk("b", 0, "stress majorization for neato force directed layout"),
        _chunk("c", 0, "orthogonal compaction with separation constraints"),
    ]
    texts = [c.text for c in chunks]

    n = bm25.upsert_chunks(chunks, texts, index_dir=index_dir, rebuild=True)
    assert n == 3
    assert bm25.chunk_count(index_dir) == 3

    hits = bm25.search_bm25("network simplex", index_dir=index_dir, limit=10)
    assert hits
    assert hits[0]["id"] == "a:0"
    # Row shape mirrors the LanceDB row (comma-string tags, int/None year).
    assert hits[0]["doc_id"] == "a"
    assert isinstance(hits[0]["tags"], str)


def test_bm25_missing_index_returns_empty(tmp_path: Path):
    assert bm25.search_bm25("anything", index_dir=tmp_path / "nope", limit=5) == []


def test_bm25_special_chars_query_does_not_raise(tmp_path: Path):
    index_dir = tmp_path / "bm25"
    chunks = [_chunk("a", 0, "VPSC separation constraints overlap removal")]
    bm25.upsert_chunks(chunks, [chunks[0].text], index_dir=index_dir, rebuild=True)
    hits = bm25.search_bm25("VPSC: (separation)!! constraints", index_dir=index_dir, limit=5)
    assert any(h["id"] == "a:0" for h in hits)


def test_bm25_upsert_archives_incompatible_schema(tmp_path: Path):
    index_dir = tmp_path / "bm25"
    index_dir.mkdir()
    sb = tantivy.SchemaBuilder()
    sb.add_text_field("id", stored=True)
    tantivy.Index(sb.build(), path=str(index_dir))

    chunks = [_chunk("a", 0, "fresh lexical row")]
    assert bm25.upsert_chunks(chunks, [chunks[0].text], index_dir=index_dir) == 1

    archives = list(tmp_path.glob("bm25.schema-mismatch-*"))
    assert len(archives) == 1
    assert bm25.chunk_count(index_dir) == 1
    assert bm25.search_bm25("fresh", index_dir=index_dir)[0]["id"] == "a:0"


def test_rrf_merges_and_prefers_overlap():
    dense = [
        {"id": "a:0", "score": 0.9, "title": "A", "text": "ta"},
        {"id": "b:0", "score": 0.8, "title": "B", "text": "tb"},
    ]
    sparse = [
        {"id": "b:0", "score": 5.0, "title": "B", "text": "tb"},
        {"id": "c:0", "score": 4.0, "title": "C", "text": "tc"},
    ]
    fused = reciprocal_rank_fusion(dense, sparse, top=10)
    ids = [r["id"] for r in fused]
    # b:0 appears in both lists → highest fused score.
    assert ids[0] == "b:0"
    assert set(ids) == {"a:0", "b:0", "c:0"}
    b = next(r for r in fused if r["id"] == "b:0")
    assert b["dense_rank"] == 2 and b["sparse_rank"] == 1
    assert "fusion_score" in b


# ---------------------------------------------------------------------------
# Test group 1 — weighted fusion (hybrid.py T2 changes)
# ---------------------------------------------------------------------------

def _r(id_: str, score: float = 1.0) -> dict:
    return {"id": id_, "score": score, "title": id_, "text": "t"}


def test_weighted_rrf_dense_heavy_doc_beats_sparse_heavy():
    """Doc that ranks #1 dense / #10 sparse should beat #10 dense / #1 sparse
    when sparse_weight (0.3) < dense_weight (1.0)."""
    from rag_literature_rag.query.hybrid import DENSE_WEIGHT, SPARSE_WEIGHT

    # Build 10-item lists; position is what matters for RRF.
    dense = [_r("dense_winner")] + [_r(f"filler_{i}") for i in range(8)] + [_r("sparse_winner")]
    sparse = [_r("sparse_winner")] + [_r(f"filler_{i}") for i in range(8)] + [_r("dense_winner")]

    fused = reciprocal_rank_fusion(dense, sparse, dense_weight=DENSE_WEIGHT, sparse_weight=SPARSE_WEIGHT, top=20)
    ids = [r["id"] for r in fused]
    assert ids.index("dense_winner") < ids.index("sparse_winner"), (
        "dense_winner (#1 dense / #10 sparse) should outrank sparse_winner (#10 dense / #1 sparse) "
        "when dense_weight > sparse_weight"
    )


def test_weighted_defaults_differ_from_equal_weight():
    """Default weights (1.0, 0.3) should produce a different top-2 order than equal weights (1.0, 1.0)
    on a result set designed to diverge."""
    # dense_winner: rank 1 dense, rank 5 sparse
    # sparse_winner: rank 5 dense, rank 1 sparse
    # Equal weights → sparse_winner wins (its sparse advantage equals dense_winner's dense advantage).
    # Asymmetric weights → dense_winner wins.
    dense = [_r("dense_winner"), _r("x1"), _r("x2"), _r("x3"), _r("sparse_winner")]
    sparse = [_r("sparse_winner"), _r("x1"), _r("x2"), _r("x3"), _r("dense_winner")]

    fused_equal = reciprocal_rank_fusion(dense, sparse, dense_weight=1.0, sparse_weight=1.0, top=10)
    fused_asym = reciprocal_rank_fusion(dense, sparse, top=10)  # uses DENSE_WEIGHT=1.0, SPARSE_WEIGHT=0.3

    top_equal = fused_equal[0]["id"]
    top_asym = fused_asym[0]["id"]
    # Both lists are symmetric in rank; with equal weights they tie (same score), so just assert
    # the asymmetric call returns dense_winner at top.
    assert top_asym == "dense_winner", f"Expected dense_winner at top with asymmetric weights, got {top_asym}"
    # And confirm equal weights give the opposite or at least a different ordering.
    # (With equal weights x1 wins because it's rank 2 in both — but dense_winner is still rank 1 dense.
    # The important assertion is that asym != equal at top, OR that dense_winner beats sparse_winner in asym.)
    asym_ids = [r["id"] for r in fused_asym]
    equal_ids = [r["id"] for r in fused_equal]
    dw_asym = asym_ids.index("dense_winner")
    sw_asym = asym_ids.index("sparse_winner")
    dw_equal = equal_ids.index("dense_winner")
    sw_equal = equal_ids.index("sparse_winner")
    assert dw_asym < sw_asym, "With asymmetric weights, dense_winner should rank above sparse_winner"
    # With equal weights, dense_winner and sparse_winner have identical RRF scores (symmetric input).
    # Python's sort is stable so sparse_winner (inserted first) ends up ranked higher than dense_winner.
    assert sw_equal < dw_equal, (
        "With equal weights + symmetric input, sparse_winner (processed first) should rank above dense_winner"
    )


def test_rrf_k_shifts_scores_not_relative_order():
    """Changing rrf_k should shift scores but preserve relative order when rankings are identical."""
    dense = [_r("a"), _r("b"), _r("c")]
    sparse = [_r("a"), _r("b"), _r("c")]

    fused_20 = reciprocal_rank_fusion(dense, sparse, rrf_k=20, top=10)
    fused_60 = reciprocal_rank_fusion(dense, sparse, rrf_k=60, top=10)

    ids_20 = [r["id"] for r in fused_20]
    ids_60 = [r["id"] for r in fused_60]
    assert ids_20 == ids_60, "Relative order must be the same when input rankings are identical"

    scores_20 = [r["fusion_score"] for r in fused_20]
    scores_60 = [r["fusion_score"] for r in fused_60]
    assert scores_20 != scores_60, "Scores should differ between rrf_k=20 and rrf_k=60"


# ---------------------------------------------------------------------------
# Test group 2 — contextual hard-failure fallback (contextual.py T4 changes)
# ---------------------------------------------------------------------------

def _make_chunk(doc_id: str = "d1", idx: int = 0, text: str = "raw chunk text") -> "TextChunk":
    from rag_literature_rag.ingest.chunk import TextChunk
    return TextChunk(
        doc_id=doc_id, title="Test Paper", text=text, page=1,
        chunk_index=idx, source_url="https://example.org/d1", year=2024,
        tags=["rag"], authors=["Author"], pipeline_categories=["retrieval"], page_end=1,
    )


def test_contextual_hard_failure_falls_back_to_raw_chunk(tmp_path, monkeypatch):
    """If the LLM raises a non-retryable exception, augment_texts_for_context must
    return the raw chunk text — not empty string, not a propagated exception.

    # TODO(T4): This test exercises the retry/fallback path added in T4.
    # If contextual.py hasn't been updated yet, this test will fail because
    # augment_texts_for_context won't catch exceptions or return raw chunks.
    """
    import rag_literature_rag.ingest.contextual as ctx_mod

    chunk = _make_chunk(text="raw chunk text about retrieval augmentation")
    texts = [chunk.text]

    # Patch cache path to tmp so no real cache is read/written.
    monkeypatch.setattr(ctx_mod, "CACHE_PATH", tmp_path / "ctx_cache.json")
    # Patch _generate_context to raise a non-retryable ValueError.
    monkeypatch.setattr(ctx_mod, "_generate_context", lambda *a, **kw: (_ for _ in ()).throw(
        ValueError("model not found — not retryable")
    ))

    result = ctx_mod.augment_texts_for_context([chunk], texts)

    assert result == [chunk.text], (
        f"Hard failure should fall back to raw chunk. Got: {result!r}"
    )


def test_contextual_transient_failure_retries_and_succeeds(tmp_path, monkeypatch):
    """If the LLM raises a transient (retryable) error on the first N calls but
    succeeds on the final attempt, the chunk should receive the generated context.

    # TODO(T4): This test exercises the retry/backoff added in T4.
    # If contextual.py hasn't been updated yet, this test will fail because
    # augment_texts_for_context won't retry on transient errors.
    """
    import rag_literature_rag.ingest.contextual as ctx_mod

    chunk = _make_chunk(text="chunk about neural retrieval scoring")
    texts = [chunk.text]

    monkeypatch.setattr(ctx_mod, "CACHE_PATH", tmp_path / "ctx_cache.json")
    # Patch time.sleep so tests don't actually wait.
    monkeypatch.setattr(ctx_mod.time, "sleep", lambda _: None)

    call_count = {"n": 0}

    def _flaky_generate(*a, **kw):
        call_count["n"] += 1
        if call_count["n"] < 3:
            raise RuntimeError("429 resource_exhausted — transient")
        return "Generated context sentence."

    monkeypatch.setattr(ctx_mod, "_generate_context", _flaky_generate)

    result = ctx_mod.augment_texts_for_context([chunk], texts)

    assert len(result) == 1
    assert "Generated context sentence." in result[0], (
        f"After retry success, context line should appear in output. Got: {result!r}"
    )
    assert chunk.text in result[0], "Raw chunk text must be retained after context prepend"
    assert call_count["n"] >= 3, "Should have retried at least twice before succeeding"
