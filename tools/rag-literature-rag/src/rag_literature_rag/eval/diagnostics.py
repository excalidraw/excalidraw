"""Pooling-bias diagnostics: hole rate, judged@k, condensed nDCG, bpref.

Quantifies *how much* the original lexical-pooled judge distorted the bake-off.
For each retriever we compute, against both the old (curated, BM25-pooled) and
new (diverse-pool + LLM-judged) qrels:

* **judged@k / hole rate@k** — fraction of the top-k that the judge actually
  saw. A lexical-only pool leaves dense/ColBERT rankings full of *holes*
  (unjudged docs, counted as non-relevant), so their hole rate is high and their
  nDCG is understated. The diverse pool should collapse those holes.
* **nDCG@10 (binary)** on each qrels — the headline before/after number.
* **condensed nDCG@10** (Sakai) — unjudged docs removed before scoring; robust
  to incompleteness.
* **bpref** (Buckley & Voorhees) — ignores the rate of unjudged docs entirely;
  the standard "is this collection still usable" metric.

If the BM25→dense gap narrows on the new qrels and dense's hole rate falls, the
original verdict was partly a labeling artifact. If hybrid still wins on the
neutral, low-hole judge, the verdict is robust.
"""
from __future__ import annotations

import math
from typing import Any

from rag_literature_rag.eval.gold_validation import EvalTrack, cases_for_track
from rag_literature_rag.eval.metrics import case_metrics
from rag_literature_rag.eval.qrels import DEFAULT_RELEVANCE_THRESHOLD, graded_labels
from rag_literature_rag.query.identity import canonical_identity_map


def _ndcg_from_ranking(ranking: list[str], relevant: set[str]) -> float:
    rows = [{"doc_id": doc_id} for doc_id in ranking]
    return case_metrics(rows, relevant)["ndcg@10"]


def hole_rate(ranking: list[str], judged: set[str], k: int) -> float:
    """Fraction of the top-k that is *unjudged* (a 'hole')."""
    top = ranking[:k]
    if not top:
        return 0.0
    return sum(1 for doc_id in top if doc_id not in judged) / len(top)


def condensed_ndcg(ranking: list[str], judged: set[str], relevant: set[str]) -> float:
    condensed = [doc_id for doc_id in ranking if doc_id in judged]
    return _ndcg_from_ranking(condensed, relevant)


def bpref(ranking: list[str], relevant: set[str], nonrelevant: set[str]) -> float:
    """Buckley & Voorhees bpref over the judged docs in the ranking.

    bpref = (1/R) Σ_r (1 − |non-rel judged ranked above r| / min(R, N)).
    Returns 1.0 when there are no judged non-relevant docs (N=0): with only
    positive labels (the old curated set) bpref is degenerate — flagged in the
    report rather than trusted.
    """
    R = len(relevant)
    N = len(nonrelevant)
    if R == 0:
        return 0.0
    if N == 0:
        return 1.0
    denom = min(R, N)
    nonrel_seen = 0
    total = 0.0
    found = 0
    for doc_id in ranking:
        if doc_id in relevant:
            total += 1.0 - min(nonrel_seen, denom) / denom
            found += 1
        elif doc_id in nonrelevant:
            nonrel_seen += 1
    return total / R


def run_diagnostics(
    *,
    track: EvalTrack,
    embed_profile: str,
    qrels_payload: dict[str, Any],
    strategies: list[str],
    depth: int = 20,
    threshold: int = DEFAULT_RELEVANCE_THRESHOLD,
    experimental_indexes: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Re-run each strategy and compute bias diagnostics on old vs new qrels."""
    import os

    from rag_literature_rag.eval.pooling import _EXPERIMENTAL_KIND
    from rag_literature_rag.eval.strategies import strategy_registry

    experimental_indexes = experimental_indexes or {}
    registry = strategy_registry()
    identities = canonical_identity_map()

    def canon(doc_id: str) -> str:
        return identities.canonicalize_doc_id(doc_id)

    judged = graded_labels(qrels_payload)  # case_id -> {doc_id: grade}
    cases = cases_for_track(track)

    results: list[dict[str, Any]] = []
    for name in strategies:
        if name not in registry:
            raise ValueError(f"Unknown strategy {name!r}")
        kind = _EXPERIMENTAL_KIND.get(name)
        if kind:
            if kind not in experimental_indexes:
                continue
            os.environ["RAG_LIT_EXPERIMENTAL_INDEX"] = experimental_indexes[kind]
        strategy = registry[name]

        rows: list[dict[str, float]] = []
        for case in cases:
            judged_grades = {canon(d): g for d, g in judged.get(case.id, {}).items()}
            judged_set = set(judged_grades)
            relevant_new = {d for d, g in judged_grades.items() if g >= threshold}
            nonrelevant_new = {d for d, g in judged_grades.items() if g < threshold}
            relevant_old = {canon(d) for d in case.relevant_doc_ids}

            try:
                ranked_rows = strategy.run(case, embed_profile=embed_profile, top=depth)
            except Exception:  # noqa: BLE001
                continue
            ranking = [canon(r.get("canonical_doc_id") or r.get("doc_id") or "") for r in ranked_rows]
            ranking = [d for d in ranking if d]

            rows.append(
                {
                    "ndcg@10_old": _ndcg_from_ranking(ranking, relevant_old),
                    "ndcg@10_new": _ndcg_from_ranking(ranking, relevant_new),
                    "judged@10": 1.0 - hole_rate(ranking, judged_set, 10),
                    "hole_rate@10": hole_rate(ranking, judged_set, 10),
                    "hole_rate@20": hole_rate(ranking, judged_set, 20),
                    "condensed_ndcg@10_new": condensed_ndcg(ranking, judged_set, relevant_new),
                    "bpref_new": bpref(ranking, relevant_new, nonrelevant_new),
                }
            )

        if not rows:
            continue
        agg = {key: round(sum(r[key] for r in rows) / len(rows), 4) for key in rows[0]}
        agg["strategy"] = name
        agg["ndcg_delta"] = round(agg["ndcg@10_new"] - agg["ndcg@10_old"], 4)
        results.append(agg)

    # Sort by new nDCG so the corrected ranking is obvious.
    results.sort(key=lambda r: r["ndcg@10_new"], reverse=True)
    return {
        "track": track,
        "embed_profile": embed_profile,
        "depth": depth,
        "relevance_threshold": threshold,
        "judge_model": qrels_payload.get("judge_model"),
        "strategies": results,
    }


def format_diagnostics_table(payload: dict[str, Any]) -> str:
    """Human-readable before/after table."""
    lines = [
        f"## Pooling-bias diagnostics — {payload['track']}",
        "",
        f"Judge: {payload.get('judge_model')} · depth {payload['depth']} · "
        f"grade>={payload['relevance_threshold']} relevant",
        "",
        "| strategy | nDCG@10 old | nDCG@10 new | Δ | hole@10 | judged@10 | condensed nDCG | bpref |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in payload["strategies"]:
        lines.append(
            f"| {r['strategy']} | {r['ndcg@10_old']:.3f} | {r['ndcg@10_new']:.3f} | "
            f"{r['ndcg_delta']:+.3f} | {r['hole_rate@10']:.2f} | {r['judged@10']:.2f} | "
            f"{r['condensed_ndcg@10_new']:.3f} | {r['bpref_new']:.3f} |"
        )
    return "\n".join(lines) + "\n"
