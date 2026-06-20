from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from rag_literature_rag.eval.gold_cases import EvalCase
from rag_literature_rag.query.retrieve import RetrieveFilters
from rag_literature_rag.query.search import search_multi_raw, search_raw


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
class SmallToBigDenseStrategy:
    name: str = "small2big_dense"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            small_to_big=True,
            small_to_big_mode="dense",
        )


@dataclass
class SmallToBigParentBM25Strategy:
    name: str = "small2big_parent_bm25"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            small_to_big=True,
            small_to_big_mode="parent_bm25",
        )


@dataclass
class SmallToBigHybridStrategy:
    name: str = "small2big_hybrid"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            small_to_big=True,
            small_to_big_mode="hybrid",
            rrf_k=20,
        )


@dataclass
class DocSummaryStrategy:
    name: str
    mode: str
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            docsummary=True,
            docsummary_mode=self.mode,
            rrf_k=20,
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
class HybridAggregateStrategy:
    """Experimental: re-rank papers by a *corroboration-aware* aggregation of
    their chunk scores instead of the production single-best-chunk (max-pool).

    Tests two suspected biases of the default grouping:
      * #2 deeper fusion pool (``pool`` >> default 80) so long documents do not
        crowd shorter relevant papers out of the fused candidate set;
      * #5 corroboration — ``sum_topk`` rewards papers with several on-topic
        passages; ``count_boost`` adds a capped log bonus for multiple hits.
    ``max`` reproduces the production aggregation at the deeper pool, isolating
    the pool-depth effect from the aggregation effect.
    """

    name: str
    pool: int = 200
    rrf_k: int = 20
    aggregate: str = "sum_topk"  # "max" | "sum_topk" | "count_boost"
    topk: int = 3
    count_lambda: float = 0.10
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        rows = search_raw(
            case.query,
            top=max(top, 50),
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=False,
            pool=self.pool,
            rrf_k=self.rrf_k,
            max_per_doc=5,
        )
        rescored: list[dict[str, Any]] = []
        for row in rows:
            scores = sorted(
                (float(e.get("score") or 0.0) for e in row.get("evidence") or []),
                reverse=True,
            ) or [float(row.get("score") or 0.0)]
            best = scores[0]
            if self.aggregate == "sum_topk":
                agg = sum(scores[: self.topk])
            elif self.aggregate == "count_boost":
                agg = best * (1.0 + self.count_lambda * math.log1p(len(scores) - 1))
            else:
                agg = best
            new_row = dict(row)
            new_row["score"] = agg
            rescored.append(new_row)
        rescored.sort(key=lambda r: r["score"], reverse=True)
        return rescored[: max(top, 50)]


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
class HybridLLMRerankStrategy:
    """Hybrid retrieve + RankGPT-style listwise LLM reranking of the top pool."""

    name: str = "hybrid_llm_rerank"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from rag_literature_rag.query.retrieve import diversify_candidates, retrieve_candidates
        from rag_literature_rag.query.search import format_results
        from rag_common.rerank import rerank_listwise_llm

        candidates = retrieve_candidates(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
        )
        diverse = diversify_candidates(candidates, max_per_doc=5, limit=max(top * 2, 50))
        reranked = rerank_listwise_llm(
            case.query, diverse, top=max(top * 2, top), enabled=True, pool=min(20, len(diverse))
        )
        return format_results(reranked, top=top, max_per_doc=2)


@dataclass
class HybridLocalRerankStrategy:
    """Hybrid + local cross-encoder rerank with the full (uncapped) char budget.

    Tests whether lifting MAX_RERANK_CHARS rescues the local reranker that
    truncation previously handicapped. Model is overridable via RAG_RERANK_MODEL
    (e.g. a Qwen3-Reranker / jina-reranker checkpoint).
    """

    name: str = "hybrid_local_rerank"
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        os.environ.setdefault("RAG_RERANK_MAX_CHARS", "8000")
        return search_raw(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            rerank=True,
            rerank_model=os.getenv("RAG_RERANK_MODEL") or None,
        )


@dataclass
class AgenticStrategy:
    """Iterative deep-research loop (decompose -> gather -> listwise judge -> iterate)."""

    name: str = "agentic"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from rag_literature_rag.query.agent import deep_research

        return deep_research(
            case.query,
            top=top,
            embed_profile=embed_profile,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            max_per_doc=2,
        )


@dataclass
class MultiQueryStrategy:
    name: str = "multi_query"
    requires_llm: bool = True
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from rag_literature_rag.query.transforms import multi_query_rewrites

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
        from rag_literature_rag.query.retrieve import resolve_retrieve_context, retrieve_candidates
        from rag_literature_rag.query.transforms import hyde_passage

        passage = hyde_passage(case.query)
        ctx = resolve_retrieve_context(embed_profile=embed_profile)
        from rag_literature_rag.ingest.embed import embed_query
        from rag_literature_rag.ingest.embed import ENV_PREFIX

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
        from rag_literature_rag.query.search import format_results
        from rag_literature_rag.query.retrieve import diversify_candidates
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
        from rag_literature_rag.query.transforms import step_back_query

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
        from rag_literature_rag.query.transforms import multi_query_rewrites

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
        from rag_literature_rag.eval.google_rerank import rerank_google
        from rag_literature_rag.query.retrieve import diversify_candidates, retrieve_candidates
        from rag_literature_rag.query.search import format_results

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
        from rag_literature_rag.eval.experimental_index import search_experimental
        from rag_literature_rag.query.hybrid import reciprocal_rank_fusion
        from rag_literature_rag.query.retrieve import _apply_filters, retrieve_candidates
        from rag_literature_rag.query.search import format_results

        raw = os.getenv("RAG_LIT_EXPERIMENTAL_INDEX", "").strip()
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


@dataclass
class CitationGraphStrategy:
    """Hybrid text retrieval re-ranked by citation-graph relatedness (RRF-fused).

    Seeds = the top distinct docs from the text ranking; every candidate doc in the wide
    pool is scored for relatedness to those seeds (PPR + bibliographic coupling +
    co-citation + citation prior) and that ranking is RRF-fused back into the text ranking.
    Degrades to plain hybrid when no citation store exists.
    """

    name: str = "hybrid_citation"
    seed_docs: int = 5
    pool: int = 120
    alpha: float = float(os.getenv("RAG_LIT_CITATION_ALPHA", "0.5"))  # max fractional boost
    requires_llm: bool = False
    requires_cloud_cost: bool = False

    def run(self, case: EvalCase, *, embed_profile: str, top: int = 20) -> list[dict[str, Any]]:
        from rag_literature_rag.query.citation_rank import citation_doc_ranking, load_graph_cached
        from rag_literature_rag.query.retrieve import retrieve_candidates
        from rag_literature_rag.query.search import format_results

        candidates = retrieve_candidates(
            case.query,
            top=top,
            embed_profile=embed_profile,
            hybrid=True,
            filters=_filters(case, use_category=False, use_pdf_only=False),
            pool=self.pool,
        )
        graph = load_graph_cached()
        if not candidates or graph is None:
            return format_results(candidates, top=top, max_per_doc=2)

        seen: set[str] = set()
        seeds: list[str] = []
        for row in candidates:
            doc = row.get("doc_id")
            if doc and doc not in seen:
                seen.add(doc)
                seeds.append(doc)
            if len(seeds) >= self.seed_docs:
                break
        cand_docs = [d for d in {row.get("doc_id") for row in candidates} if d]
        scores = citation_doc_ranking(None, seeds, cand_docs, graph=graph)  # type: ignore[arg-type]
        if not scores:
            return format_results(candidates, top=top, max_per_doc=2)

        # Text-primary fusion: multiply each chunk's text score by (1 + alpha*citation_norm).
        # Multiplicative on the (wide-spread) dense/fusion score keeps query relevance the
        # backbone; citation only re-orders among comparably-relevant docs. Equal-weight RRF
        # of the two rankings is catastrophic here because citation optimizes relatedness to
        # the seeds, not relevance to the query.
        cmax = max(scores.values()) or 1.0
        for row in candidates:
            base = row.get("fusion_score") or row.get("score") or 0.0
            cnorm = scores.get(row.get("doc_id"), 0.0) / cmax
            row["citation_norm"] = round(cnorm, 4)
            row["fusion_score"] = round(base * (1.0 + self.alpha * cnorm), 6)
        candidates.sort(key=lambda r: r["fusion_score"], reverse=True)
        return format_results(candidates, top=top, max_per_doc=2)


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
    "hybrid_citation",
    "hybrid_local_rerank",
    "small2big_dense",
    "small2big_parent_bm25",
    "small2big_hybrid",
)

LLM_STRATEGIES: tuple[str, ...] = (
    "multi_query",
    "hyde",
    "step_back",
    "multi_query_rerank",
    "hybrid_llm_rerank",
    "agentic",
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

# Experimental paper-level aggregation arms (A/B only; not in the default run).
AGGREGATION_STRATEGIES: tuple[str, ...] = (
    "hybrid_deep",
    "hybrid_agg_sum3",
    "hybrid_agg_count",
)

DOCSUMMARY_STRATEGIES: tuple[str, ...] = (
    "docsummary_dense",
    "docsummary_bm25",
    "docsummary_hybrid",
    "docsummary_then_chunks",
    "docsummary_fused_hybrid",
)

ALL_STRATEGIES: tuple[str, ...] = (
    OFFLINE_STRATEGIES
    + LLM_STRATEGIES
    + CLOUD_STRATEGIES
    + EXPERIMENTAL_STRATEGIES
    + AGGREGATION_STRATEGIES
    + DOCSUMMARY_STRATEGIES
)


def strategy_registry() -> dict[str, RetrievalStrategy]:
    strategies: list[RetrievalStrategy] = [
        DenseStrategy(),
        BM25Strategy(),
        SmallToBigDenseStrategy(),
        SmallToBigParentBM25Strategy(),
        SmallToBigHybridStrategy(),
        DocSummaryStrategy("docsummary_dense", mode="dense"),
        DocSummaryStrategy("docsummary_bm25", mode="bm25"),
        DocSummaryStrategy("docsummary_hybrid", mode="hybrid"),
        DocSummaryStrategy("docsummary_then_chunks", mode="then_chunks"),
        DocSummaryStrategy("docsummary_fused_hybrid", mode="fused_hybrid"),
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
        CitationGraphStrategy(),
        HybridLocalRerankStrategy(),
        HybridLLMRerankStrategy(),
        AgenticStrategy(),
        MultiQueryStrategy(),
        HyDEStrategy(),
        StepBackStrategy(),
        MultiQueryRerankStrategy(),
        GoogleRerankStrategy("semantic-ranker-fast-004", "hybrid_google_fast"),
        GoogleRerankStrategy("semantic-ranker-default-004", "hybrid_google_default"),
        ExperimentalIndexStrategy("splade", "splade"),
        ExperimentalIndexStrategy("splade", "dense_splade", fuse_dense=True),
        ExperimentalIndexStrategy("colbert", "colbert"),
        HybridAggregateStrategy("hybrid_deep", pool=200, aggregate="max"),
        HybridAggregateStrategy("hybrid_agg_sum3", pool=200, aggregate="sum_topk", topk=3),
        HybridAggregateStrategy("hybrid_agg_count", pool=200, aggregate="count_boost"),
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
