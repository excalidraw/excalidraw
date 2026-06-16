"""Unit tests for multi-system pooling, LLM judging, and bias diagnostics."""
from __future__ import annotations

from rag_literature_rag.eval.diagnostics import bpref, condensed_ndcg, hole_rate
from rag_literature_rag.eval.gold_cases import EvalCase
from rag_literature_rag.eval.judge import _parse_grade, build_judge_prompt
from rag_literature_rag.eval.pooling import pool_stats
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
