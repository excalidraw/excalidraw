from rag_literature_rag.eval.strategies import resolve_strategies
from rag_literature_rag.query.hybrid import merge_rankings, reciprocal_rank_fusion
from rag_literature_rag.query.retrieve import DEFAULT_HYBRID


def test_production_query_default_is_hybrid():
    assert DEFAULT_HYBRID is True


def test_resolve_offline_strategies_default():
    strategies = resolve_strategies(None, llm_transforms=False)
    names = [strategy.name for strategy in strategies]
    assert "hybrid_category_rerank" in names
    assert "multi_query" not in names


def test_resolve_llm_strategies_when_enabled():
    strategies = resolve_strategies(["multi_query", "hyde"], llm_transforms=True)
    names = [strategy.name for strategy in strategies]
    assert names == ["multi_query", "hyde"]


def test_cloud_strategies_require_explicit_opt_in():
    hidden = resolve_strategies(["hybrid_google_fast"], llm_transforms=False)
    shown = resolve_strategies(
        ["hybrid_google_fast"],
        llm_transforms=False,
        cloud_rerank=True,
    )
    assert hidden == []
    assert [strategy.name for strategy in shown] == ["hybrid_google_fast"]


def test_merge_rankings_variadic():
    list_a = [{"id": "a:0", "text": "a"}, {"id": "b:0", "text": "b"}]
    list_b = [{"id": "b:0", "text": "b"}, {"id": "c:0", "text": "c"}]
    merged = merge_rankings(list_a, list_b, top=10)
    assert merged[0]["id"] == "b:0"
    assert {row["id"] for row in merged} == {"a:0", "b:0", "c:0"}


def test_weighted_rrf_can_prefer_dense_or_sparse():
    dense = [{"id": "dense:0", "text": "dense"}, {"id": "sparse:0", "text": "sparse"}]
    sparse = [{"id": "sparse:0", "text": "sparse"}, {"id": "dense:0", "text": "dense"}]
    dense_first = reciprocal_rank_fusion(
        dense,
        sparse,
        dense_weight=2,
        sparse_weight=1,
    )
    sparse_first = reciprocal_rank_fusion(
        dense,
        sparse,
        dense_weight=1,
        sparse_weight=2,
    )
    assert dense_first[0]["id"] == "dense:0"
    assert sparse_first[0]["id"] == "sparse:0"
