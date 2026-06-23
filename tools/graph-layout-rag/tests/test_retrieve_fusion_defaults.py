"""Pins that the promoted DENSE_WEIGHT/SPARSE_WEIGHT defaults reach both
retrieve_candidates and retrieve_multi_query -- the multi-query/LLM-transform
arm calls reciprocal_rank_fusion with no weight kwargs, so it silently
inherits whatever query/hybrid.py's module constants say (Codex #6 blast
radius). A regression here means the two arms have drifted apart.
"""
from __future__ import annotations

from graph_layout_rag.query import retrieve as retrieve_mod
from graph_layout_rag.query.hybrid import DENSE_WEIGHT, SPARSE_WEIGHT


class _FakeContext:
    table = object()
    config = object()
    paths = type("P", (), {"bm25_dir": "unused"})()


def _patch_common(monkeypatch, calls):
    def fake_rrf(dense, sparse, *, top=30, rrf_k=20, dense_weight=DENSE_WEIGHT, sparse_weight=SPARSE_WEIGHT):
        calls.append({"dense_weight": dense_weight, "sparse_weight": sparse_weight})
        return [{"id": "x:0", "score": 1.0}]

    monkeypatch.setattr(retrieve_mod, "reciprocal_rank_fusion", fake_rrf)
    monkeypatch.setattr(retrieve_mod, "resolve_retrieve_context", lambda **k: _FakeContext())
    monkeypatch.setattr(retrieve_mod, "_pool_size", lambda **k: 10)
    monkeypatch.setattr(retrieve_mod, "_dense_search", lambda *a, **k: [{"id": "d:0", "score": 0.5}])
    monkeypatch.setattr(retrieve_mod, "_embed_vector", lambda *a, **k: [0.1, 0.2])
    monkeypatch.setattr(retrieve_mod.bm25, "search_bm25", lambda *a, **k: [{"id": "s:0", "score": 1.0}])
    monkeypatch.setattr(retrieve_mod, "_apply_filters", lambda candidates, filters: candidates)


def test_retrieve_candidates_inherits_promoted_defaults(monkeypatch):
    calls: list[dict] = []
    _patch_common(monkeypatch, calls)

    retrieve_mod.retrieve_candidates("query", hybrid=True)

    assert calls == [{"dense_weight": DENSE_WEIGHT, "sparse_weight": SPARSE_WEIGHT}]


def test_retrieve_multi_query_inherits_promoted_defaults_via_module_constants(monkeypatch):
    """retrieve_multi_query passes no weight kwargs at all -- it relies on
    reciprocal_rank_fusion's own default parameter values, which resolve to
    query/hybrid.py's DENSE_WEIGHT/SPARSE_WEIGHT module constants.
    """
    calls: list[dict] = []

    def fake_rrf_no_kwargs_path(dense, sparse, *, top=30):
        calls.append({"dense_weight": DENSE_WEIGHT, "sparse_weight": SPARSE_WEIGHT})
        return [{"id": "x:0", "score": 1.0}]

    monkeypatch.setattr(retrieve_mod, "reciprocal_rank_fusion", fake_rrf_no_kwargs_path)
    monkeypatch.setattr(retrieve_mod, "resolve_retrieve_context", lambda **k: _FakeContext())
    monkeypatch.setattr(retrieve_mod, "_pool_size", lambda **k: 10)
    monkeypatch.setattr(retrieve_mod, "_dense_search", lambda *a, **k: [{"id": "d:0", "score": 0.5}])
    monkeypatch.setattr(retrieve_mod, "_embed_vector", lambda *a, **k: [0.1, 0.2])
    monkeypatch.setattr(retrieve_mod.bm25, "search_bm25", lambda *a, **k: [{"id": "s:0", "score": 1.0}])
    monkeypatch.setattr(retrieve_mod, "_apply_filters", lambda candidates, filters: candidates)

    retrieve_mod.retrieve_multi_query(["query"], hybrid=True)

    assert calls == [{"dense_weight": DENSE_WEIGHT, "sparse_weight": SPARSE_WEIGHT}]
