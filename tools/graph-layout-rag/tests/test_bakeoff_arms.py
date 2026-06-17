"""Smoke tests for bake-off arms that need no network/Vertex.

Covers the pure decision logic added for query expansion (A1) and the listwise
reranker parsing + graceful-degradation paths (A3).
"""
from __future__ import annotations

from graph_layout_rag.eval.strategies import ALL_STRATEGIES, strategy_registry
from graph_layout_rag.query.search import should_use_hyde
from rag_common.rerank import _parse_rank_order, rerank_listwise_llm


def test_should_use_hyde_short_query() -> None:
    assert should_use_hyde("why so tall", []) is True


def test_should_use_hyde_thin_results() -> None:
    assert should_use_hyde("network simplex rank assignment layered digraph", []) is True


def test_should_use_hyde_skips_normal_query() -> None:
    cands = [{"doc_id": f"d{i}"} for i in range(5)]
    assert should_use_hyde("network simplex rank assignment layered digraph", cands) is False


def test_should_use_hyde_pdf_only() -> None:
    cands = [{"doc_id": f"d{i}"} for i in range(5)]
    assert should_use_hyde("network simplex rank assignment layered digraph", cands, pdf_only=True)


def test_parse_rank_order_is_a_permutation() -> None:
    order = _parse_rank_order("[3] > [0] > [1]", 5)
    assert sorted(order) == [0, 1, 2, 3, 4]
    assert order[:3] == [3, 0, 1]


def test_parse_rank_order_ignores_out_of_range() -> None:
    order = _parse_rank_order("99 2 0", 3)
    assert order == [2, 0, 1]


def test_listwise_passthrough_when_disabled() -> None:
    rows = [{"doc_id": "a", "text": "x"}, {"doc_id": "b", "text": "y"}]
    out = rerank_listwise_llm("q", rows, top=2, enabled=False)
    assert [r["doc_id"] for r in out] == ["a", "b"]


def test_new_strategies_registered() -> None:
    reg = strategy_registry()
    for name in ("hybrid_llm_rerank", "hybrid_local_rerank", "hybrid_auto_hyde"):
        assert name in reg
        assert name in ALL_STRATEGIES
    assert reg["hybrid_llm_rerank"].requires_llm is True
    assert reg["hybrid_local_rerank"].requires_llm is False
    assert reg["hybrid_auto_hyde"].requires_llm is True
