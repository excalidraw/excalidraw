"""Thin promotion gate for graph-layout-rag retrieval changes.

Reuses graph's already-calibrated 2026-06-18 thresholds (see
docs/rag/graph-layout-rag-quality-campaign-2026-06-18.md):

* candidate nDCG@10 >= baseline + 0.01 (catalog) / + 0.015 (pdf-deep-read)
* the *other* track must not regress by more than 0.005
* candidate failure count must not exceed baseline failure count
* bpref (from `eval diagnostics`, joined explicitly on (strategy, track))
  must not regress when nDCG improves -- an nDCG-up/bpref-down split means
  the gain is a labeling artifact, not a real win.

This is deliberately NOT a port of rag-lit's `performance_campaign.py` --
that module is campaign orchestration tied to rag-lit-only fallback_repair,
not a reusable evaluator. bpref lives only in `eval/diagnostics.py` (which
reruns strategies separately and can swallow exceptions per-case), so the
gate must do its own explicit join and treat a missing/failed diagnostics
row as a gate error, never a silent pass.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from graph_layout_rag.eval.gold_validation import EvalTrack

# Calibrated 2026-06-18 thresholds.
NDCG_GAIN_THRESHOLD: dict[EvalTrack, float] = {
    "catalog": 0.01,
    "pdf-deep-read": 0.015,
}
OPPOSITE_TRACK_MAX_REGRESSION = 0.005


@dataclass
class GateFinding:
    track: str
    rule: str
    passed: bool
    detail: str


@dataclass
class GateResult:
    passed: bool
    findings: list[GateFinding] = field(default_factory=list)

    def errors(self) -> list[GateFinding]:
        return [f for f in self.findings if not f.passed]


def _benchmark_row(payload: dict[str, Any], *, strategy: str, track: str) -> dict[str, Any] | None:
    for row in payload.get("results", []):
        if row.get("strategy") == strategy and row.get("track") == track:
            return row
    return None


def _diagnostics_row(payload: dict[str, Any] | None, *, strategy: str) -> dict[str, Any] | None:
    if payload is None:
        return None
    for row in payload.get("strategies", []):
        if row.get("strategy") == strategy:
            return row
    return None


def evaluate_gate(
    *,
    baseline_benchmark: dict[str, Any],
    candidate_benchmark: dict[str, Any],
    baseline_strategy: str,
    candidate_strategy: str,
    tracks: list[EvalTrack],
    baseline_diagnostics: dict[EvalTrack, dict[str, Any]] | None = None,
    candidate_diagnostics: dict[EvalTrack, dict[str, Any]] | None = None,
) -> GateResult:
    """Apply the calibrated promotion gate across the given tracks.

    `baseline_diagnostics`/`candidate_diagnostics` are optional per-track
    `eval diagnostics` payloads (output of `run_diagnostics`). When supplied
    for a track, bpref is joined explicitly on (strategy, track) and any
    missing/failed strategy row is a gate error -- not a silent pass.
    """
    findings: list[GateFinding] = []
    deltas: dict[EvalTrack, float] = {}

    for track in tracks:
        base_row = _benchmark_row(baseline_benchmark, strategy=baseline_strategy, track=track)
        cand_row = _benchmark_row(candidate_benchmark, strategy=candidate_strategy, track=track)

        if base_row is None or "ndcg@10" not in base_row:
            findings.append(
                GateFinding(track, "baseline_present", False, f"no baseline benchmark row for {baseline_strategy}/{track}")
            )
            continue
        if cand_row is None or "ndcg@10" not in cand_row:
            findings.append(
                GateFinding(track, "candidate_present", False, f"no candidate benchmark row for {candidate_strategy}/{track}")
            )
            continue

        base_ndcg = base_row["ndcg@10"]
        cand_ndcg = cand_row["ndcg@10"]
        delta = round(cand_ndcg - base_ndcg, 4)
        deltas[track] = delta

        threshold = NDCG_GAIN_THRESHOLD[track]
        passed = delta >= threshold
        findings.append(
            GateFinding(
                track,
                "ndcg_gain",
                passed,
                f"delta={delta:+.4f} threshold>={threshold:+.4f} "
                f"(baseline={base_ndcg:.4f} candidate={cand_ndcg:.4f})",
            )
        )

        base_failures = len(base_row.get("failures", []))
        cand_failures = len(cand_row.get("failures", []))
        failures_ok = cand_failures <= base_failures
        findings.append(
            GateFinding(
                track,
                "no_failure_increase",
                failures_ok,
                f"baseline_failures={base_failures} candidate_failures={cand_failures}",
            )
        )

        # bpref join: only applies if diagnostics supplied for this track.
        base_diag = (baseline_diagnostics or {}).get(track)
        cand_diag = (candidate_diagnostics or {}).get(track)
        if base_diag is not None or cand_diag is not None:
            base_diag_row = _diagnostics_row(base_diag, strategy=baseline_strategy)
            cand_diag_row = _diagnostics_row(cand_diag, strategy=candidate_strategy)
            if base_diag_row is None:
                findings.append(
                    GateFinding(
                        track,
                        "bpref_join",
                        False,
                        f"diagnostics missing/failed for baseline strategy {baseline_strategy!r} on {track}",
                    )
                )
            elif cand_diag_row is None:
                findings.append(
                    GateFinding(
                        track,
                        "bpref_join",
                        False,
                        f"diagnostics missing/failed for candidate strategy {candidate_strategy!r} on {track}",
                    )
                )
            else:
                base_bpref = base_diag_row["bpref_new"]
                cand_bpref = cand_diag_row["bpref_new"]
                # Only enforced when nDCG improved -- an nDCG gain that came with a
                # bpref regression is the "labeling artifact" failure mode.
                if delta > 0:
                    bpref_ok = cand_bpref >= base_bpref
                    findings.append(
                        GateFinding(
                            track,
                            "bpref_not_regressed",
                            bpref_ok,
                            f"baseline_bpref={base_bpref:.4f} candidate_bpref={cand_bpref:.4f}",
                        )
                    )

    # Opposite-track regression check: every track not gaining must not regress
    # past the shared cap, regardless of whether it cleared its own gain bar.
    for track, delta in deltas.items():
        if delta < 0:
            regression_ok = abs(delta) <= OPPOSITE_TRACK_MAX_REGRESSION
            findings.append(
                GateFinding(
                    track,
                    "opposite_track_regression",
                    regression_ok,
                    f"delta={delta:+.4f} max_allowed_regression=-{OPPOSITE_TRACK_MAX_REGRESSION:.4f}",
                )
            )

    passed = all(f.passed for f in findings) and bool(findings)
    return GateResult(passed=passed, findings=findings)


def format_gate_report(result: GateResult) -> str:
    lines = ["## Promotion gate", ""]
    for f in result.findings:
        mark = "PASS" if f.passed else "FAIL"
        lines.append(f"[{mark}] {f.track}/{f.rule}: {f.detail}")
    lines.append("")
    lines.append("VERDICT: " + ("PROMOTE" if result.passed else "BLOCK"))
    return "\n".join(lines) + "\n"


def load_json(path: Path) -> dict[str, Any]:
    import json

    return json.loads(Path(path).read_text(encoding="utf-8"))
