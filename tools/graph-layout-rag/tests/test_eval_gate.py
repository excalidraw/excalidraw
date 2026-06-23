from __future__ import annotations

from graph_layout_rag.eval.gate import evaluate_gate


def _benchmark(strategy: str, track: str, *, ndcg: float, failures: int = 0) -> dict:
    return {
        "results": [
            {
                "strategy": strategy,
                "track": track,
                "ndcg@10": ndcg,
                "failures": [{"id": f"f{i}"} for i in range(failures)],
            }
        ]
    }


def _merge(*payloads: dict) -> dict:
    results = []
    for p in payloads:
        results.extend(p["results"])
    return {"results": results}


def _diagnostics(strategy: str, *, bpref: float) -> dict:
    return {"strategies": [{"strategy": strategy, "bpref_new": bpref}]}


def test_gate_accepts_when_all_thresholds_clear():
    baseline = _merge(
        _benchmark("base", "catalog", ndcg=0.70),
        _benchmark("base", "pdf-deep-read", ndcg=0.60),
    )
    candidate = _merge(
        _benchmark("cand", "catalog", ndcg=0.72),
        _benchmark("cand", "pdf-deep-read", ndcg=0.62),
    )
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog", "pdf-deep-read"],
    )
    assert result.passed, result.findings


def test_gate_rejects_gain_below_threshold():
    baseline = _benchmark("base", "catalog", ndcg=0.70)
    candidate = _benchmark("cand", "catalog", ndcg=0.705)  # +0.005 < 0.01 threshold
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog"],
    )
    assert not result.passed
    assert any(f.rule == "ndcg_gain" and not f.passed for f in result.findings)


def test_gate_rejects_opposite_track_regression_over_cap():
    baseline = _merge(
        _benchmark("base", "catalog", ndcg=0.70),
        _benchmark("base", "pdf-deep-read", ndcg=0.60),
    )
    candidate = _merge(
        _benchmark("cand", "catalog", ndcg=0.72),
        _benchmark("cand", "pdf-deep-read", ndcg=0.585),  # -0.015 regression > 0.005 cap
    )
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog", "pdf-deep-read"],
    )
    assert not result.passed
    assert any(f.rule == "opposite_track_regression" and not f.passed for f in result.findings)


def test_gate_rejects_failure_count_increase():
    baseline = _benchmark("base", "catalog", ndcg=0.70, failures=2)
    candidate = _benchmark("cand", "catalog", ndcg=0.72, failures=3)
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog"],
    )
    assert not result.passed
    assert any(f.rule == "no_failure_increase" and not f.passed for f in result.findings)


def test_gate_rejects_ndcg_up_but_bpref_down():
    baseline = _benchmark("base", "catalog", ndcg=0.70)
    candidate = _benchmark("cand", "catalog", ndcg=0.72)
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog"],
        baseline_diagnostics={"catalog": _diagnostics("base", bpref=0.80)},
        candidate_diagnostics={"catalog": _diagnostics("cand", bpref=0.75)},
    )
    assert not result.passed
    assert any(f.rule == "bpref_not_regressed" and not f.passed for f in result.findings)


def test_gate_accepts_ndcg_up_and_bpref_up():
    baseline = _benchmark("base", "catalog", ndcg=0.70)
    candidate = _benchmark("cand", "catalog", ndcg=0.72)
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog"],
        baseline_diagnostics={"catalog": _diagnostics("base", bpref=0.80)},
        candidate_diagnostics={"catalog": _diagnostics("cand", bpref=0.82)},
    )
    assert result.passed, result.findings


def test_gate_surfaces_missing_diagnostics_strategy_as_error_not_silent_pass():
    baseline = _benchmark("base", "catalog", ndcg=0.70)
    candidate = _benchmark("cand", "catalog", ndcg=0.72)
    # diagnostics payload supplied but the candidate strategy row is absent
    # (e.g. the diagnostics rerun raised and was swallowed for that strategy).
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog"],
        baseline_diagnostics={"catalog": _diagnostics("base", bpref=0.80)},
        candidate_diagnostics={"catalog": {"strategies": []}},
    )
    assert not result.passed
    assert any(
        f.rule == "bpref_join" and not f.passed and "cand" in f.detail for f in result.findings
    )


def test_gate_rejects_missing_baseline_or_candidate_benchmark_row():
    baseline = _benchmark("base", "catalog", ndcg=0.70)
    candidate = {"results": []}
    result = evaluate_gate(
        baseline_benchmark=baseline,
        candidate_benchmark=candidate,
        baseline_strategy="base",
        candidate_strategy="cand",
        tracks=["catalog"],
    )
    assert not result.passed
    assert any(f.rule == "candidate_present" and not f.passed for f in result.findings)
