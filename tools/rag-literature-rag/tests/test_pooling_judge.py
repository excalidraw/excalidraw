"""Unit tests for multi-system pooling, LLM judging, and bias diagnostics."""
from __future__ import annotations

from rag_literature_rag.eval.diagnostics import bpref, condensed_ndcg, hole_rate
from rag_literature_rag.eval.gold_cases import EvalCase
from rag_literature_rag.eval.judge import _parse_grade, build_judge_prompt
from rag_literature_rag.eval.pooling import pool_stats
from rag_literature_rag.eval.qrels_backfill import (
    collect_unjudged_pool,
    count_judge_cache_misses,
    format_backfill_report,
    merge_qrels,
    run_qrels_backfill,
)
from rag_literature_rag.eval.qrels import (
    DEFAULT_RELEVANCE_THRESHOLD,
    apply_qrels_overlay,
    graded_labels,
    relevant_from_grades,
)


# ---- qrels overlay ----

def _qrels(cases: dict) -> dict:
    return {"relevance_threshold": DEFAULT_RELEVANCE_THRESHOLD, "cases": cases}


def test_relevant_from_grades_thresholds_at_two():
    grades = {"a": 3, "b": 2, "c": 1, "d": 0}
    assert relevant_from_grades(grades) == {"a", "b"}
    assert relevant_from_grades(grades, threshold=3) == {"a"}


def test_overlay_unions_and_never_drops():
    cases = [
        EvalCase(id="c1", query="q", relevant_doc_ids=frozenset({"orig1", "orig2"})),
    ]
    qrels = _qrels({"c1": {"new1": {"grade": 3}, "low": {"grade": 1}, "orig1": {"grade": 2}}})
    out = apply_qrels_overlay(cases, qrels)
    # orig labels preserved; grade>=2 added; grade<2 ignored.
    assert out[0].relevant_doc_ids == frozenset({"orig1", "orig2", "new1"})


def test_overlay_leaves_unjudged_case_untouched():
    cases = [EvalCase(id="c1", query="q", relevant_doc_ids=frozenset({"a"}))]
    out = apply_qrels_overlay(cases, _qrels({"other": {"x": {"grade": 3}}}))
    assert out[0].relevant_doc_ids == frozenset({"a"})


def test_graded_labels_extracts_grades():
    qrels = _qrels({"c1": {"a": {"grade": 3, "reason": "x"}, "b": {"grade": 0}}})
    assert graded_labels(qrels) == {"c1": {"a": 3, "b": 0}}


# ---- judge prompt + parsing ----

def test_judge_prompt_is_source_blind():
    # Sentinel system names that cannot appear in the rubric vocabulary (the rubric
    # legitimately mentions "dense", "colbert", etc. as retrieval methods), so the
    # test isolates real leakage of the per-doc systems/score rather than colliding.
    doc = {
        "title": "Network Simplex for Layer Assignment",
        "abstract": "We assign layers via network simplex.",
        "excerpt": "ranking via simplex...",
        "systems": {"ZZSYSALPHA": 1, "ZZSYSBETA": 3},  # must NOT leak into the prompt
        "score": 0.99,
    }
    prompt = build_judge_prompt("layer assignment", doc)
    assert "ZZSYSALPHA" not in prompt
    assert "ZZSYSBETA" not in prompt
    assert "systems" not in prompt
    assert "0.99" not in prompt
    # but the substance is present
    assert "Network Simplex" in prompt
    assert "layer assignment" in prompt


def test_parse_grade_json():
    assert _parse_grade('{"grade": 3, "reason": "on topic"}') == (3, "on topic")


def test_parse_grade_clamps_and_falls_back():
    assert _parse_grade('{"grade": 9}')[0] == 3
    assert _parse_grade("I would say 2 out of 3")[0] == 2
    assert _parse_grade("no number here")[0] == 0


# ---- diagnostics ----

def test_hole_rate_counts_unjudged():
    ranking = ["a", "b", "c", "d"]
    judged = {"a", "c"}
    # 2 of top-4 unjudged
    assert hole_rate(ranking, judged, 4) == 0.5
    assert hole_rate(ranking, judged, 2) == 0.5


def test_condensed_ndcg_drops_unjudged_before_scoring():
    # 'x' is unjudged and sits at rank 1; condensing should promote the relevant doc.
    ranking = ["x", "rel"]
    judged = {"rel", "nonrel"}
    relevant = {"rel"}
    full = condensed_ndcg(["rel"], judged, relevant)
    condensed = condensed_ndcg(ranking, judged, relevant)
    # After dropping the unjudged hole, 'rel' is effectively rank 1 → perfect.
    assert condensed == full == 1.0


def test_bpref_degenerate_without_negatives():
    # Old curated qrels have only positives → bpref is 1.0 (flagged as degenerate).
    assert bpref(["rel"], {"rel"}, set()) == 1.0


def test_bpref_penalizes_nonrelevant_above_relevant():
    relevant = {"r1", "r2"}
    nonrelevant = {"n1", "n2"}
    good = bpref(["r1", "r2", "n1", "n2"], relevant, nonrelevant)
    bad = bpref(["n1", "n2", "r1", "r2"], relevant, nonrelevant)
    assert good == 1.0
    assert bad < good


# ---- pool stats ----

def test_pool_stats_flags_neural_only_docs():
    payload = {
        "cases": {
            "c1": {
                "pooled": {
                    "doc_lex": {"systems": {"bm25": 1}, "curated": True},
                    "doc_neural": {"systems": {"dense": 2, "colbert": 1}, "curated": False},
                    "doc_curated_neural": {"systems": {"dense": 5}, "curated": True},
                }
            }
        }
    }
    stats = pool_stats(payload)
    assert stats["total_candidates"] == 3
    # doc_neural + doc_curated_neural were surfaced only by non-lexical systems
    assert stats["neural_only_candidates"] == 2
    assert stats["curated_docs_no_lexical_system"] == 1


# ---- targeted qrels backfill ----

class _FakeStrategy:
    def __init__(self, rows):
        self.rows = rows

    def run(self, case, *, embed_profile, top=20):
        return self.rows[:top]


class _IdentityMap:
    def canonicalize_doc_id(self, doc_id):
        aliases = {"alias-new": "new"}
        return aliases.get(doc_id, doc_id)


def test_backfill_collection_skips_judged_and_dedupes_canonical(monkeypatch):
    case = EvalCase(id="c1", query="q", relevant_doc_ids=frozenset({"old"}))
    rows_a = [
        {"doc_id": "old", "title": "Old"},
        {"doc_id": "alias-new", "title": "New", "excerpt": "hit"},
    ]
    rows_b = [
        {"doc_id": "new", "title": "Newer", "excerpt": "second hit"},
        {"doc_id": "other", "title": "Other"},
    ]
    import rag_literature_rag.eval.qrels_backfill as qb

    monkeypatch.setattr(qb, "cases_for_track", lambda track: [case])
    monkeypatch.setattr(qb, "strategy_registry", lambda: {"dense": _FakeStrategy(rows_a), "bm25": _FakeStrategy(rows_b)})
    monkeypatch.setattr(qb, "canonical_identity_map", lambda: _IdentityMap())
    monkeypatch.setattr(qb, "load_manifest", lambda: type("Manifest", (), {"items": []})())
    monkeypatch.setattr(qb, "manifest_by_id", lambda manifest: {})

    pool, counts = collect_unjudged_pool(
        track="catalog",
        embed_profile="p",
        qrels_payload=_qrels({"c1": {"old": {"grade": 3}}}),
        strategies=["dense", "bm25"],
        depth=10,
    )

    pooled = pool["cases"]["c1"]["pooled"]
    assert set(pooled) == {"new", "other"}
    assert pooled["new"]["systems"] == {"dense": 2, "bm25": 1}
    assert counts["total_holes_found"] == 3
    assert counts["unique_new_pairs"] == 2


def test_backfill_merge_preserves_existing_and_only_adds_uncached_verified(monkeypatch):
    import rag_literature_rag.eval.qrels_backfill as qb

    monkeypatch.setattr(qb, "_cache_has_verdict", lambda model, case_id, doc_id: doc_id != "errored")
    existing = _qrels({"c1": {"old": {"grade": 3, "reason": "keep", "systems": ["curated"]}}})
    judged = {
        "c1": {
            "old": {"grade": 0, "reason": "do not overwrite"},
            "new": {"grade": 2, "reason": "add", "systems": ["dense"], "curated": False},
            "errored": {"grade": 0, "reason": ""},
        }
    }

    merged, counts = merge_qrels(existing, judged, model="m")

    assert merged["cases"]["c1"]["old"] == {"grade": 3, "reason": "keep", "systems": ["curated"]}
    assert merged["cases"]["c1"]["new"]["grade"] == 2
    assert "errored" not in merged["cases"]["c1"]
    assert counts == {"judged_count": 1, "skipped_or_error_count": 2}


def test_backfill_budget_count_uses_judge_cache(monkeypatch):
    import rag_literature_rag.eval.qrels_backfill as qb

    monkeypatch.setattr(
        qb,
        "_load_cache",
        lambda: {"model:rag-v2:c1:cached": {"grade": 2}},
    )
    pool = {"cases": {"c1": {"pooled": {"cached": {}, "miss": {}}}}}

    assert count_judge_cache_misses(pool, "model") == 1


def test_backfill_budget_gate_refuses_before_judging(monkeypatch, tmp_path):
    import rag_literature_rag.eval.qrels_backfill as qb

    qrels_path = tmp_path / "qrels.json"
    qrels_path.write_text('{"cases": {}}\n', encoding="utf-8")
    monkeypatch.setattr(qb, "load_qrels", lambda path: {"cases": {}})
    monkeypatch.setattr(qb, "run_diagnostics", lambda **kwargs: {"strategies": []})
    monkeypatch.setattr(
        qb,
        "collect_unjudged_pool",
        lambda **kwargs: (
            {"cases": {"c1": {"query": "q", "pooled": {"a": {}, "b": {}}}}},
            {"total_holes_found": 2, "unique_new_pairs": 2},
        ),
    )
    monkeypatch.setattr(qb, "count_judge_cache_misses", lambda pool, model: 100_000)

    def fail_judge(*args, **kwargs):
        raise AssertionError("judge_pool should not run when budget is exceeded")

    monkeypatch.setattr(qb, "judge_pool", fail_judge)

    try:
        run_qrels_backfill(
            track="catalog",
            embed_profile="p",
            strategies=["dense"],
            depth=10,
            budget_usd=0.01,
            qrels_file=qrels_path,
            model="m",
        )
    except RuntimeError as exc:
        assert "exceeds --budget-usd" in str(exc)
    else:
        raise AssertionError("expected budget refusal")


def test_backfill_report_includes_diagnostics_and_counts():
    payload = {
        "track": "catalog",
        "embed_profile": "p",
        "strategies": ["dense"],
        "depth": 10,
        "total_holes_found": 2,
        "unique_new_pairs": 1,
        "judge_cache_misses": 1,
        "estimated_cost_usd": 0.00023,
        "judged_count": 1,
        "skipped_or_error_count": 0,
        "before_diagnostics": [{"strategy": "dense", "hole@10": 0.2, "bpref": 0.5, "nDCG@10_new": 0.1}],
        "after_diagnostics": [{"strategy": "dense", "hole@10": 0.0, "bpref": 0.8, "nDCG@10_new": 0.7}],
    }

    report = format_backfill_report(payload)

    assert "holes found: 2" in report
    assert "| dense | 0.20 | 0.500 | 0.100 |" in report
    assert "| dense | 0.00 | 0.800 | 0.700 |" in report
