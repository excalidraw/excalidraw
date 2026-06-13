from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from graph_layout_rag.eval.gold_cases import EvalCase
from graph_layout_rag.query.retrieve import RetrieveFilters
from graph_layout_rag.query.search import search_multi_raw, search_raw


@dataclass(frozen=True)
class StrategySpec:
    name: str
    requires_llm: bool = False


class RetrievalStrategy(Protocol):
    name: str
    requires_llm: bool
    requires_cloud_cost: bool

    def run(
        self,
        case: EvalCase,
        *,
        embed_profile: str,
        top: int = 20,
    ) -> list[dict[str, Any]]: ...


@dataclass
class DenseStrategy:
    name: str = "dense"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=False,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
        )


@dataclass
class HybridStrategy:
    name: str = "hybrid"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
        )


@dataclass
class BM25Strategy:
    name: str = "bm25"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            sparse_only=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
        )


@dataclass
class HybridTunedStrategy:
    name: str
    pool: int
    rrf_k: int = 60
    dense_weight: float = 1.0
    sparse_weight: float = 1.0
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            pool=self.pool,
            rrf_k=self.rrf_k,
            dense_weight=self.dense_weight,
            sparse_weight=self.sparse_weight,
        )


@dataclass
class HybridMiniLMRerankStrategy:
    name: str = "hybrid_minilm_rerank"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=True,
            rerank_model="cross-encoder/ms-marco-MiniLM-L-6-v2",
        )


@dataclass
class HybridRerankStrategy:
    name: str = "hybrid_rerank"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=True,
        )


@dataclass
class HybridCategoryStrategy:
    name: str = "hybrid_category"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=True, use_pdf_only=False),
            rerank=False,
        )


@dataclass
class HybridPdfOnlyStrategy:
    name: str = "hybrid_pdf_only"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=True),
            rerank=False,
        )


@dataclass
class HybridCategoryRerankStrategy:
    name: str = "hybrid_category_rerank"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=True, use_pdf_only=case.pdf_only),
            rerank=True,
        )


@dataclass
class MultiQueryStrategy:
    name: str = "multi_query"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from graph_layout_rag.query.transforms import multi_query_rewrites

        rewrites = multi_query_rewrites(case.query)
        queries = [case.query, *rewrites]
        return search_multi_raw(
            queries,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            rerank_query=case.query,
        )


@dataclass
class HyDEStrategy:
    name: str = "hyde"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from graph_layout_rag.query.retrieve import resolve_retrieve_context, retrieve_candidates
        from graph_layout_rag.query.transforms import hyde_passage

        passage = hyde_passage(case.query)
        ctx = resolve_retrieve_context(embed_profile=embed_profile)
        from graph_layout_rag.ingest.embed import embed_query
        from graph_layout_rag.ingest.embed import ENV_PREFIX

        vector = embed_query(passage, config=ctx.config, prefix=ENV_PREFIX, allow_fallback=False)
        candidates = retrieve_candidates(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            context=ctx,
            vector=vector,
            bm25_query=case.query,
        )
        from graph_layout_rag.query.search import format_results
        from graph_layout_rag.query.retrieve import diversify_candidates
        from rag_common.rerank import rerank as rerank_candidates

        diverse = diversify_candidates(candidates, max_per_doc=5, limit=max(top * 2, 50))
        reranked = rerank_candidates(case.query, diverse, top=max(top * 2, top), enabled=False)
        return format_results(reranked, top=top, max_per_doc=2)


@dataclass
class StepBackStrategy:
    name: str = "step_back"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from graph_layout_rag.query.transforms import step_back_query

        abstract = step_back_query(case.query)
        return search_multi_raw(
            [case.query, abstract],
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            rerank_query=case.query,
        )


@dataclass
class MultiQueryRerankStrategy:
    name: str = "multi_query_rerank"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from graph_layout_rag.query.transforms import multi_query_rewrites

        rewrites = multi_query_rewrites(case.query)
        queries = [case.query, *rewrites]
        return search_multi_raw(
            queries,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=True, use_pdf_only=case.pdf_only),
            rerank=True,
            rerank_query=case.query,
        )


@dataclass
class GoogleRerankStrategy:
    model: str
    name: str
    requires_llm: bool = False
    requires_cloud_cost: bool = True

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from graph_layout_rag.eval.google_rerank import rerank_google
        from graph_layout_rag.query.retrieve import diversify_candidates, retrieve_candidates
        from graph_layout_rag.query.search import format_results

        candidates = retrieve_candidates(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            pool=100,
        )
        diverse = diversify_candidates(candidates, max_per_doc=5, limit=100)
        reranked = rerank_google(case.query, diverse, top=max(top * 2, top), model=self.model)
        return format_results(reranked, top=top, max_per_doc=2)


@dataclass
class ExperimentalIndexStrategy:
    kind: str
    name: str
    fuse_dense: bool = False
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from graph_layout_rag.eval.experimental_index import search_experimental
        from graph_layout_rag.query.hybrid import reciprocal_rank_fusion
        from graph_layout_rag.query.retrieve import _apply_filters, retrieve_candidates
        from graph_layout_rag.query.search import format_results

        raw = os.getenv("GRAPH_RAG_EXPERIMENTAL_INDEX", "").strip()
        if not raw:
            raise RuntimeError("experimental retrieval strategy requires --retrieval-index")
        experimental = search_experimental(
            Path(raw),
            case.query,
            limit=max(80, top * 4),
            expected_kind=self.kind,
        )
        experimental = _apply_filters(
            experimental,
            _filters(case, use_category=False, use_pdf_only=case.pdf_only),
        )
        if self.fuse_dense:
            dense = retrieve_candidates(
                case.query,
                top=top,
                embed_profile=embed_profile,
                hybrid=False,
                filters=_filters(case, use_category=False, use_pdf_only=False),
                pool=max(80, top * 4),
            )
            experimental = reciprocal_rank_fusion(dense, experimental, top=max(80, top * 4))
        return format_results(experimental, top=top, max_per_doc=2)


def _filters(case: EvalCase, *, use_category: bool, use_pdf_only: bool) -> RetrieveFilters:
    return RetrieveFilters(
        category=case.category if use_category else None,
        # Track preparation sets this false for catalog and true for deep-read.
        # All strategies must honor the track boundary for fair comparisons.
        pdf_only=case.pdf_only,
    )


OFFLINE_STRATEGIES: tuple[str, ...] = (
    "dense",
    "bm25",
    "hybrid",
    "hybrid_pool80",
    "hybrid_pool160",
    "hybrid_rrf20",
    "hybrid_rrf100",
    "hybrid_dense2",
    "hybrid_sparse2",
    "hybrid_minilm_rerank",
    "hybrid_rerank",
    "hybrid_category",
    "hybrid_pdf_only",
    "hybrid_category_rerank",
)

LLM_STRATEGIES: tuple[str, ...] = (
    "multi_query",
    "hyde",
    "step_back",
    "multi_query_rerank",
)

CLOUD_STRATEGIES: tuple[str, ...] = (
    "hybrid_google_fast",
    "hybrid_google_default",
)

EXPERIMENTAL_STRATEGIES: tuple[str, ...] = (
    "splade",
    "dense_splade",
    "colbert",
)

ALL_STRATEGIES: tuple[str, ...] = (
    OFFLINE_STRATEGIES + LLM_STRATEGIES + CLOUD_STRATEGIES + EXPERIMENTAL_STRATEGIES
)


def strategy_registry() -> dict[str, RetrievalStrategy]:
    strategies: list[RetrievalStrategy] = [
        DenseStrategy(),
        BM25Strategy(),
        HybridStrategy(),
        HybridTunedStrategy("hybrid_pool80", pool=80),
        HybridTunedStrategy("hybrid_pool160", pool=160),
        HybridTunedStrategy("hybrid_rrf20", pool=80, rrf_k=20),
        HybridTunedStrategy("hybrid_rrf100", pool=80, rrf_k=100),
        HybridTunedStrategy("hybrid_dense2", pool=80, dense_weight=2.0),
        HybridTunedStrategy("hybrid_sparse2", pool=80, sparse_weight=2.0),
        HybridMiniLMRerankStrategy(),
        HybridRerankStrategy(),
        HybridCategoryStrategy(),
        HybridPdfOnlyStrategy(),
        HybridCategoryRerankStrategy(),
        MultiQueryStrategy(),
        HyDEStrategy(),
        StepBackStrategy(),
        MultiQueryRerankStrategy(),
        GoogleRerankStrategy("semantic-ranker-fast-004", "hybrid_google_fast"),
        GoogleRerankStrategy("semantic-ranker-default-004", "hybrid_google_default"),
        ExperimentalIndexStrategy("splade", "splade"),
        ExperimentalIndexStrategy("splade", "dense_splade", fuse_dense=True),
        ExperimentalIndexStrategy("colbert", "colbert"),
    ]
    return {strategy.name: strategy for strategy in strategies}


def resolve_strategies(
    names: list[str] | None,
    *,
    llm_transforms: bool,
    cloud_rerank: bool = False,
    experimental_index: bool = False,
) -> list[RetrievalStrategy]:
    registry = strategy_registry()
    if names:
        selected = names
    elif llm_transforms:
        selected = list(OFFLINE_STRATEGIES + LLM_STRATEGIES)
        if cloud_rerank:
            selected.extend(CLOUD_STRATEGIES)
    else:
        selected = list(OFFLINE_STRATEGIES)
        if cloud_rerank:
            selected.extend(CLOUD_STRATEGIES)

    out: list[RetrievalStrategy] = []
    for name in selected:
        strategy = registry.get(name)
        if strategy is None:
            raise ValueError(f"Unknown strategy {name!r}. Choose from: {', '.join(ALL_STRATEGIES)}")
        if strategy.requires_llm and not llm_transforms:
            continue
        if strategy.requires_cloud_cost and not cloud_rerank:
            continue
        if strategy.name in EXPERIMENTAL_STRATEGIES and not experimental_index:
            continue
        out.append(strategy)
    return out
