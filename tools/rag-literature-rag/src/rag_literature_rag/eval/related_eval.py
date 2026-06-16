"""Leave-one-out citation-prediction eval — the measuring stick for `find related papers`.

The 30-case gold benchmark scores *query relevance*, which is the wrong axis for relatedness
(query text is already near-ceiling there). This harness measures *seed relatedness* with no
hand-labeling: hold out one real corpus citation from a paper, remove that edge from the
graph, and ask each ranker to recover the held-out paper from the remaining structure. The
citation graph is its own ground truth.

Variants compared (each produces a ranked doc_id list, scored with the shared
`eval.metrics.case_metrics`):
  * ``coupling_only`` / ``cocitation_only`` — single 1-hop graph signals
  * ``ppr_undirected`` / ``ppr_directional`` — random-walk-with-restart (node-split)
  * ``scincl`` / ``specter2`` — citation-trained doc-embedding cosine
  * ``related_v2`` — fused graph + embedding (the candidate production ranker)
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rag_literature_rag import citation_store as cs
from rag_literature_rag.doc_vectors import embedding_scores, has_doc_vectors
from rag_literature_rag.eval.metrics import aggregate_metrics, case_metrics
from rag_literature_rag.query.citation_rank import CitationGraph, load_graph, rank_related

# Fused weights, tuned on the leave-one-out eval after the incoming-citation backfill made
# co-citation the dominant signal. Co-citation leads; undirected PPR + coupling break ties
# and cover candidates co-citation can't reach; embedding is a light topical tiebreak.
# (Directional PPR is dropped — it underperformed undirected on this corpus/task.)
_FUSED_WEIGHTS = {
    "w_ppr": 0.6, "w_ppr_fwd": 0.0, "w_ppr_bwd": 0.0,
    "w_coupling": 0.3, "w_cocitation": 1.5, "w_prior": 0.02, "w_embedding": 0.15,
}

GRAPH_VARIANTS: dict[str, dict[str, float]] = {
    "coupling_only": {"w_ppr": 0.0, "w_coupling": 1.0, "w_cocitation": 0.0, "w_prior": 0.0},
    "cocitation_only": {"w_ppr": 0.0, "w_coupling": 0.0, "w_cocitation": 1.0, "w_prior": 0.0},
    "ppr_undirected": {"w_ppr": 1.0, "w_coupling": 0.0, "w_cocitation": 0.0, "w_prior": 0.0},
    "ppr_directional": {
        "w_ppr": 0.0, "w_ppr_fwd": 1.0, "w_ppr_bwd": 1.0,
        "w_coupling": 0.0, "w_cocitation": 0.0, "w_prior": 0.0,
    },
}
EMBED_VARIANTS = {"scincl": "scincl", "specter2": "specter2"}
DEFAULT_VARIANTS = (
    "coupling_only", "cocitation_only", "ppr_undirected", "ppr_directional",
    "scincl", "specter2", "related_v2",
)


@dataclass(frozen=True)
class LooFold:
    seed_doc: str
    seed_oa: str
    held_doc: str
    held_oa: str


def build_loo_cases(g: CitationGraph, *, max_cases: int = 150, min_refs: int = 1) -> list[LooFold]:
    """One fold per eligible corpus paper: hold out its median in-corpus reference.

    Deterministic (sorted seeds, median-index pick) so reruns are comparable.
    """
    folds: list[LooFold] = []
    for seed_doc in sorted(g.doc_to_oa):
        seed_oa = g.doc_to_oa[seed_doc]
        corpus_refs = sorted(
            r for r in g.out_adj.get(seed_oa, ())
            if r in g.oa_to_doc and g.oa_to_doc[r] != seed_doc
        )
        if len(corpus_refs) < min_refs:
            continue
        held_oa = corpus_refs[len(corpus_refs) // 2]
        folds.append(LooFold(seed_doc, seed_oa, g.oa_to_doc[held_oa], held_oa))
        if len(folds) >= max_cases:
            break
    return folds


def _rank_graph(
    g: CitationGraph, fold: LooFold, candidates: set[str], weights: dict[str, float],
    embed_scores: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """Rank with the held-out edge removed, then restored (leave-one-out)."""
    existed = g.remove_edge(fold.seed_oa, fold.held_oa)
    try:
        w = dict(weights)
        w_embed = w.pop("w_embedding", 0.0)
        ranked = rank_related(
            g, {fold.seed_oa}, candidates,
            embed_scores=embed_scores, w_embedding=w_embed, **w,
        )
    finally:
        if existed:
            g.add_edge(fold.seed_oa, fold.held_oa)
    return [{"doc_id": r.doc_id} for r in ranked if r.doc_id]


def _rank_embedding(model: str, fold: LooFold, corpus_docs: list[str]) -> list[dict[str, Any]]:
    scores = embedding_scores(model, [fold.seed_doc], corpus_docs)
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [{"doc_id": d} for d, _ in ranked]


def _oa_embed_scores(g: CitationGraph, model: str, seed_doc: str, corpus_docs: list[str]) -> dict[str, float]:
    by_doc = embedding_scores(model, [seed_doc], corpus_docs)
    return {g.doc_to_oa[d]: s for d, s in by_doc.items() if d in g.doc_to_oa}


def run_variant(
    g: CitationGraph, variant: str, folds: list[LooFold], *, embed_model: str = "scincl"
) -> dict[str, Any]:
    candidates = set(g.oa_to_doc)
    corpus_docs = sorted(g.oa_to_doc.values())
    case_rows: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    latencies: list[float] = []

    for fold in folds:
        t0 = time.monotonic()
        if variant in GRAPH_VARIANTS:
            results = _rank_graph(g, fold, candidates, GRAPH_VARIANTS[variant])
        elif variant in EMBED_VARIANTS:
            results = _rank_embedding(EMBED_VARIANTS[variant], fold, corpus_docs)
        elif variant == "related_v2":
            embed_scores = _oa_embed_scores(g, embed_model, fold.seed_doc, corpus_docs)
            results = _rank_graph(g, fold, candidates, _FUSED_WEIGHTS, embed_scores=embed_scores)
        else:
            raise ValueError(f"Unknown variant: {variant}")
        latencies.append((time.monotonic() - t0) * 1000.0)

        relevant = {fold.held_doc}
        metrics = case_metrics(results, relevant)
        case_rows.append({"id": f"{fold.seed_doc}->{fold.held_doc}", "category": None, **metrics})
        if metrics["hit_rate@10"] < 1.0:
            failures.append({
                "id": f"{fold.seed_doc}->{fold.held_doc}",
                "relevant_doc_ids": [fold.held_doc],
                "top_doc_ids": [r["doc_id"] for r in results[:5]],
            })

    agg = aggregate_metrics(case_rows) if case_rows else {}
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0
    return {
        "variant": variant,
        "cases": len(case_rows),
        **agg,
        "latency_ms_mean": round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
        "latency_ms_p95": round(p95, 1),
        "failures": failures,
    }


def run_related_eval(
    *, variants: list[str] | None = None, max_cases: int = 150, min_refs: int = 1,
    embed_model: str = "scincl",
) -> dict[str, Any]:
    db = cs.connect()
    try:
        g = load_graph(db)
    finally:
        db.close()
    if not g.doc_to_oa:
        raise RuntimeError("Citation graph is empty. Run: rag-literature-rag cite enrich")

    folds = build_loo_cases(g, max_cases=max_cases, min_refs=min_refs)
    if not folds:
        raise RuntimeError(
            "No leave-one-out folds: no corpus paper cites another corpus paper. "
            "Run `cite enrich` (with --incoming) first."
        )

    requested = list(variants or DEFAULT_VARIANTS)
    results: list[dict[str, Any]] = []
    skipped: list[str] = []
    for variant in requested:
        needs_model = EMBED_VARIANTS.get(variant) or (embed_model if variant == "related_v2" else None)
        if needs_model and not has_doc_vectors(needs_model):
            skipped.append(variant)
            continue
        results.append(run_variant(g, variant, folds, embed_model=embed_model))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "eval": "leave_one_out_citation_prediction",
        "fold_count": len(folds),
        "corpus_docs": len(g.oa_to_doc),
        "embed_model": embed_model,
        "variants_requested": requested,
        "variants_skipped": skipped,
        "results": results,
    }


def render_related_report(payload: dict[str, Any]) -> str:
    rows = sorted(payload["results"], key=lambda r: (-r.get("mrr", 0), -r.get("ndcg@10", 0)))
    lines = [
        "# Graph Layout RAG — Relatedness Evaluation (leave-one-out citation prediction)\n\n",
        f"Generated: {payload['generated_at']}\n\n",
        f"- **Folds:** {payload['fold_count']} (one held-out in-corpus citation per seed paper)\n",
        f"- **Candidate pool:** {payload['corpus_docs']} corpus docs\n",
        f"- **Embedding model:** `{payload['embed_model']}`\n",
    ]
    if payload.get("variants_skipped"):
        lines.append(
            f"- **Skipped (no doc vectors):** {', '.join(payload['variants_skipped'])} "
            "— run `cite embed-related`\n"
        )
    lines.append("\n## Results\n\n")
    lines.append("| Variant | MRR | nDCG@10 | R@10 | R@20 | HR@10 | p95 ms |\n")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n")
    for r in rows:
        lines.append(
            f"| `{r['variant']}` | {r.get('mrr', 0):.3f} | {r.get('ndcg@10', 0):.3f} | "
            f"{r.get('recall@10', 0):.3f} | {r.get('recall@20', 0):.3f} | "
            f"{r.get('hit_rate@10', 0):.3f} | {r.get('latency_ms_p95', 0):.0f} |\n"
        )
    best = rows[0]["variant"] if rows else "n/a"
    lines.append(f"\n**Best by MRR:** `{best}`. Use this to set `cite related --signal` defaults.\n")
    return "".join(lines)


def write_related_report(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_related_report(payload) + "\n", encoding="utf-8")
