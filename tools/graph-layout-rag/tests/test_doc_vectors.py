"""Doc-vector relatedness math (cosine kNN + normalized fusion scores), no model load."""

from graph_layout_rag import doc_vectors


_VECS = {
    "a": [1.0, 0.0],
    "b": [0.9, 0.1],   # close to a
    "c": [0.0, 1.0],   # far from a
}


def test_related_by_embedding_orders_by_cosine(monkeypatch):
    monkeypatch.setattr(doc_vectors, "load_all_vectors", lambda model: _VECS)
    out = doc_vectors.related_by_embedding("scincl", "a", top=5)
    ids = [r["doc_id"] for r in out]
    assert ids == ["b", "c"]  # self excluded, b before c
    assert out[0]["score"] > out[1]["score"]


def test_related_by_embedding_unknown_doc(monkeypatch):
    monkeypatch.setattr(doc_vectors, "load_all_vectors", lambda model: _VECS)
    assert doc_vectors.related_by_embedding("scincl", "zzz") == []


def test_embedding_scores_minmax_normalized(monkeypatch):
    monkeypatch.setattr(doc_vectors, "load_all_vectors", lambda model: _VECS)
    scores = doc_vectors.embedding_scores("scincl", ["a"])
    assert set(scores) == {"b", "c"}  # seed excluded
    assert scores["b"] == 1.0 and scores["c"] == 0.0  # min-max to [0, 1]
    assert scores["b"] > scores["c"]


def test_embedding_scores_no_seed_vector(monkeypatch):
    monkeypatch.setattr(doc_vectors, "load_all_vectors", lambda model: _VECS)
    assert doc_vectors.embedding_scores("scincl", ["missing"]) == {}
