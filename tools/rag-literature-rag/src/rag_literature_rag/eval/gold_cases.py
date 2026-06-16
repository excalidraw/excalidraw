from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EvalCase:
    id: str
    query: str
    relevant_doc_ids: frozenset[str]
    category: str | None = None
    pdf_only: bool = False
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "query": self.query,
            "relevant_doc_ids": sorted(self.relevant_doc_ids),
            "category": self.category,
            "pdf_only": self.pdf_only,
            "notes": self.notes,
        }


# Agent-realistic queries over core RAG literature. Doc ids match topic-seed slugs where
# possible; discovery items canonicalize at query time.
GOLD_CASES: tuple[EvalCase, ...] = (
    EvalCase(
        id="foundations-lewis-rag",
        query="Retrieval-Augmented Generation Lewis knowledge intensive NLP",
        relevant_doc_ids=frozenset({"arxiv-2005-11401"}),
        category="foundations",
    ),
    EvalCase(
        id="foundations-dpr",
        query="dense passage retrieval open domain question answering bi-encoder",
        relevant_doc_ids=frozenset({"arxiv-2004-04906", "arxiv-2005-11401"}),
        category="dense-retrieval",
    ),
    EvalCase(
        id="foundations-colbert",
        query="ColBERT late interaction contextualized passage retrieval",
        relevant_doc_ids=frozenset({"arxiv-2004-12832"}),
        category="dense-retrieval",
    ),
    EvalCase(
        id="foundations-retro",
        query="RETRO retrieval enhanced transformer trillions tokens",
        relevant_doc_ids=frozenset({"arxiv-2112-04426"}),
        category="foundations",
    ),
    EvalCase(
        id="survey-gao-rag",
        query="retrieval augmented generation survey taxonomy naive advanced modular",
        relevant_doc_ids=frozenset({"arxiv-2312-10997"}),
        category="survey",
    ),
    EvalCase(
        id="self-rag-reflection-tokens",
        query="Self-RAG reflection tokens retrieve critique on demand",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2310-11511"}),
        category="self-correcting",
        pdf_only=True,
    ),
    EvalCase(
        id="crag-evaluator-fallback",
        query="corrective RAG retrieval evaluator web search fallback",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2401-15884"}),
        category="self-correcting",
    ),
    EvalCase(
        id="raptor-hierarchical",
        query="RAPTOR recursive abstractive tree organized retrieval",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2401-18059"}),
        category="chunking",
    ),
    EvalCase(
        id="hyde-query-expansion",
        query="HyDE hypothetical document embeddings query expansion retrieval",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2209-10063"}),
        category="query-expansion",
    ),
    EvalCase(
        id="flare-active-rag",
        query="FLARE forward looking active retrieval augmented generation",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2305-06983"}),
        category="agentic",
    ),
    EvalCase(
        id="rewrite-retrieve-read",
        query="Rewrite-Retrieve-Read query rewriting retrieval augmented",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2305-14283"}),
        category="query-expansion",
    ),
    EvalCase(
        id="rankrag-unified",
        query="RankRAG context ranking retrieval augmented generation",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2407-02485"}),
        category="reranking",
    ),
    EvalCase(
        id="graphrag-microsoft",
        query="GraphRAG community detection hierarchical summary knowledge graph",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2404-16130"}),
        category="graphrag",
    ),
    EvalCase(
        id="hipporag-ppr",
        query="HippoRAG personalized PageRank hippocampal indexing memory",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2405-14831"}),
        category="graphrag",
    ),
    EvalCase(
        id="lightrag-dual-level",
        query="LightRAG dual level retrieval graph enhanced indexing",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2410-05779"}),
        category="graphrag",
    ),
    EvalCase(
        id="agentic-rag-survey",
        query="agentic retrieval augmented generation survey planning tool use",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2501-09136"}),
        category="agentic",
    ),
    EvalCase(
        id="sok-agentic-rag",
        query="SoK agentic RAG POMDP taxonomy evaluation research directions",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2603-07379"}),
        category="survey",
    ),
    EvalCase(
        id="rag-reasoning-survey",
        query="RAG reasoning synergized iterative search reasoning survey",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2507-09477"}),
        category="agentic",
    ),
    EvalCase(
        id="engineering-rag-stack",
        query="engineering RAG stack trust frameworks systematic review",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2601-05264"}),
        category="engineering",
    ),
    EvalCase(
        id="ragas-metrics",
        query="RAGAS automated evaluation faithfulness answer relevance",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2309-15217"}),
        category="evaluation",
    ),
    EvalCase(
        id="rgb-benchmark",
        query="RGB benchmark retrieval augmented generation noise robustness",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2309-01431"}),
        category="evaluation",
    ),
    EvalCase(
        id="crag-benchmark",
        query="comprehensive RAG benchmark CRAG dynamic knowledge",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2406-04744"}),
        category="evaluation",
    ),
    EvalCase(
        id="frames-multi-hop",
        query="FRAMES unified evaluation factuality retrieval reasoning multi-hop",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2409-12941"}),
        category="evaluation",
    ),
    EvalCase(
        id="longrag-chunking",
        query="LongRAG long retriever long reader Wikipedia chunks",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2406-15319"}),
        category="chunking",
    ),
    EvalCase(
        id="memorag-memory",
        query="MemoRAG memory inspired knowledge discovery draft retrieval",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2409-05591"}),
        category="memory",
    ),
    EvalCase(
        id="seakr-adaptive",
        query="SeaKR self-aware knowledge retrieval uncertainty adaptive RAG",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2406-19215"}),
        category="agentic",
    ),
    EvalCase(
        id="chain-of-note-robustness",
        query="Chain-of-Note reading notes noisy retrieval robustness",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2311-09210"}),
        category="self-correcting",
    ),
    EvalCase(
        id="filco-context-filter",
        query="FILCO filter context retrieval augmented generation",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2311-08377"}),
        category="self-correcting",
    ),
    EvalCase(
        id="ra-dit-training",
        query="RA-DIT dual instruction tuning retrieval augmented language model",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2310-01352"}),
        category="training",
    ),
    EvalCase(
        id="dspy-pipelines",
        query="DSPy declarative language model pipelines self-improving RAG",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2310-03714"}),
        category="engineering",
    ),
    EvalCase(
        id="best-practices-ablation",
        query="RAG best practices chunk size query expansion ablation study",
        relevant_doc_ids=frozenset({
            "doi-10-48550-arxiv-2407-01219",
            "doi-10-48550-arxiv-2501-07391",
        }),
        category="engineering",
    ),
    EvalCase(
        id="long-context-vs-rag",
        query="long context versus retrieval augmented generation comparison",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2501-01880"}),
        category="long-context",
    ),
    EvalCase(
        id="hybrid-rrf-fusion",
        query="hybrid dense BM25 reciprocal rank fusion retrieval",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2407-01219"}),
        category="hybrid-retrieval",
        notes="Engineering ablation covers hybrid fusion patterns.",
    ),
    EvalCase(
        id="contextual-chunk-augmentation",
        query="contextual retrieval prepend chunk context embedding BM25",
        relevant_doc_ids=frozenset({"anthropic-contextual-retrieval-cookbook"}),
        category="chunking",
        pdf_only=False,
    ),
    EvalCase(
        id="noderag-heterogeneous",
        query="NodeRAG heterogeneous graph nodes RAG framework",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2504-11544"}),
        category="graphrag",
    ),
    EvalCase(
        id="when-graphs-rag",
        query="when to use graphs in RAG comprehensive analysis benchmark",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2506-05690"}),
        category="graphrag",
    ),
    EvalCase(
        id="doctor-rag-repair",
        query="Doctor-RAG failure aware repair agentic multi-hop",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2604-00865"}),
        category="agentic",
    ),
    EvalCase(
        id="a-rag-hierarchical-api",
        query="A-RAG hierarchical retrieval interfaces keyword semantic chunk read",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2602-03442"}),
        category="agentic",
    ),
    EvalCase(
        id="sage-scientific-retrieval",
        query="SAGE benchmark scientific literature retrieval BM25 sub-queries",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2602-05975"}),
        category="evaluation",
    ),
    EvalCase(
        id="der2-decoupled-eval",
        query="DeR2 decoupled retrieval reasoning evaluation document library",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2601-21937"}),
        category="evaluation",
    ),
    EvalCase(
        id="scincl-citation-embeddings",
        query="SciNCL citation graph contrastive learning document embeddings",
        relevant_doc_ids=frozenset({"doi-10-48550-arxiv-2202-06671"}),
        category="dense-retrieval",
    ),
    EvalCase(
        id="vague-agentic-loop",
        query="why does my RAG pipeline need iterative agentic retrieval loop",
        relevant_doc_ids=frozenset({
            "doi-10-48550-arxiv-2501-09136",
            "doi-10-48550-arxiv-2603-07379",
        }),
        category="agentic",
        notes="Vague agent-style query; multiple survey papers are relevant.",
    ),
)


def gold_cases() -> list[EvalCase]:
  """Return gold cases, optionally unioned with judged qrels from ``RAG_LIT_QRELS_PATH``.

  Synthetic cases (``data/eval/gold_synth/cases.json``) are merged in **only** when
  ``RAG_LIT_SYNTH_GOLD=1`` so the curated-42 set stays the pristine default. Because
  pooling/benchmark/diagnostics all read through this function, the flag alone routes
  the synthetic set through the entire existing eval pipeline.
  """
  import os
  from pathlib import Path

  cases = list(GOLD_CASES)
  if os.getenv("RAG_LIT_SYNTH_GOLD", "").strip().lower() in {"1", "true", "yes"}:
    from rag_literature_rag.eval.gold_synth import load_synth_cases

    cases = cases + load_synth_cases()
  qrels_path = os.getenv("RAG_LIT_QRELS_PATH")
  if qrels_path:
    from rag_literature_rag.eval.qrels import apply_qrels_overlay, load_qrels

    cases = apply_qrels_overlay(cases, load_qrels(Path(qrels_path)))
  return cases
