from pathlib import Path

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
