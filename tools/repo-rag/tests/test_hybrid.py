from repo_rag.query.hybrid import reciprocal_rank_fusion


def test_rrf_merges_dense_and_sparse():
    dense = [
        {"id": "a", "score": 0.9, "file_path": "a.ts"},
        {"id": "b", "score": 0.8, "file_path": "b.ts"},
    ]
    sparse = [
        {"id": "b", "score": 12.0, "file_path": "b.ts"},
        {"id": "c", "score": 10.0, "file_path": "c.ts"},
    ]
    merged = reciprocal_rank_fusion(dense, sparse, top=3)
    ids = [m["id"] for m in merged]
    assert "b" in ids
    assert ids[0] == "b"
