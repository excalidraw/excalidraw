from __future__ import annotations

import json
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click

from rag_literature_rag.eval.benchmark import run_benchmark
from rag_literature_rag.eval.corpus_health import run_audit
from rag_literature_rag.eval.diagnostics import format_diagnostics_table, run_diagnostics
from rag_literature_rag.eval.fallback_repair import (
    index_doc_stats,
    invalidate_repair_caches,
    run_fallback_audit,
    write_report as write_fallback_report,
)
from rag_literature_rag.eval.qrels import load_qrels
from rag_literature_rag.ingest.chunk import chunking_fingerprint
from rag_literature_rag.ingest.run import _execute_ingest
from rag_literature_rag.paths import DATA_DIR, profile_index_paths

DEFAULT_BASELINE_PROFILE = "cuda-qwen0.6b-1024"
DEFAULT_STRATEGIES = ("dense", "bm25", "hybrid")
TRACKS = ("catalog", "pdf-deep-read")
FULL_CANDIDATE_PROFILES = (
    "cuda-qwen0.6b-longrag-v1",
    "cuda-qwen0.6b-768-v1",
    "cuda-qwen0.6b-512-v1",
)


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def _qrels_path(track: str) -> Path:
    return DATA_DIR / "eval" / "qrels" / track / "qrels.json"


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _mean(values: list[float]) -> float | None:
    return round(statistics.mean(values), 4) if values else None


def _case_matches_repaired(case: dict[str, Any], repaired_doc_ids: set[str]) -> bool:
    return bool(repaired_doc_ids.intersection(case.get("relevant_doc_ids") or []))


def summarize_benchmark(payload: dict[str, Any], *, repaired_doc_ids: set[str]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for result in payload.get("results", []):
        cases = result.get("cases") or []
        repaired_cases = [case for case in cases if _case_matches_repaired(case, repaired_doc_ids)]
        unrelated_cases = [case for case in cases if not _case_matches_repaired(case, repaired_doc_ids)]

        def slice_stats(slice_cases: list[dict[str, Any]]) -> dict[str, Any]:
            return {
                "cases": len(slice_cases),
                "ndcg@10": _mean([float(case.get("ndcg@10", 0.0)) for case in slice_cases]),
                "mrr": _mean([float(case.get("mrr", 0.0)) for case in slice_cases]),
                "recall@10": _mean([float(case.get("recall@10", 0.0)) for case in slice_cases]),
                "hit_rate@10": _mean([float(case.get("hit_rate@10", 0.0)) for case in slice_cases]),
            }

        rows.append(
            {
                "track": result.get("track"),
                "strategy": result.get("strategy"),
                "status": result.get("status", "ok" if "mrr" in result else "failed"),
                "failures": len(result.get("failures") or []),
                "latency_ms_p95": result.get("latency_ms_p95"),
                "peak_process_rss_gb": result.get("peak_process_rss_gb"),
                "overall": {
                    "ndcg@10": result.get("ndcg@10"),
                    "mrr": result.get("mrr"),
                    "recall@10": result.get("recall@10"),
                    "hit_rate@10": result.get("hit_rate@10"),
                },
                "repaired_doc_slice": slice_stats(repaired_cases),
                "excluding_repaired_doc_slice": slice_stats(unrelated_cases),
            }
        )
    return {
        "embed_profile": payload.get("embed_profile"),
        "tracks_tested": payload.get("tracks_tested"),
        "strategies_tested": payload.get("strategies_tested"),
        "rows": rows,
    }


def index_resource_stats(embed_profile: str) -> dict[str, Any]:
    paths = profile_index_paths(embed_profile)
    files = [path for path in paths.root.rglob("*") if path.is_file()] if paths.root.exists() else []
    return {
        "profile": embed_profile,
        "index_root": str(paths.root),
        "exists": paths.root.exists(),
        "file_count": len(files),
        "size_mb": round(sum(path.stat().st_size for path in files) / 1024 / 1024, 2),
    }


def promotion_gate_defaults() -> dict[str, Any]:
    return {
        "hole_at_10_required": 0.0,
        "max_benchmark_failures": 0,
        "max_p95_latency_regression_ratio": 1.25,
        "max_index_size_growth_ratio": 1.35,
        "requires_bpref_ndcg_agreement": True,
        "requires_excluding_repaired_slice_non_regression": True,
        "default_profile_promotion_allowed": False,
    }


def campaign_plan_payload(
    *,
    baseline_profile: str,
    candidate_profiles: tuple[str, ...],
    passes: int,
    strategies: tuple[str, ...],
    stages: tuple[str, ...],
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "baseline_profile": baseline_profile,
        "candidate_profiles": list(candidate_profiles),
        "passes": passes,
        "tracks": list(TRACKS),
        "strategies": list(strategies),
        "stages": list(stages),
        "promotion_gate": promotion_gate_defaults(),
        "matrix": [
            {"stage": "baseline-current", "profile": baseline_profile},
            {"stage": "repair-only", "profile": baseline_profile},
            *[
                {"stage": f"repair+{profile}", "profile": profile}
                for profile in candidate_profiles
            ],
        ],
        "not_in_scope": [
            "default profile promotion",
            "ColBERT/SPLADE/reranker churn",
            "cloud OCR/Gemini extraction without explicit opt-in",
            "RAPTOR/tree summaries before docsummary full-corpus quality is known",
        ],
    }


def write_campaign_report(payload: dict[str, Any], path: Path) -> None:
    lines = [
        "# RAG Performance Campaign",
        "",
        f"- Generated: `{payload['generated_at']}`",
        f"- Baseline profile: `{payload['baseline_profile']}`",
        f"- Passes: `{payload['passes']}`",
        f"- Strategies: `{', '.join(payload['strategies'])}`",
        "",
        "## Matrix",
        "",
        "| Stage | Profile |",
        "| --- | --- |",
    ]
    for row in payload["matrix"]:
        lines.append(f"| `{row['stage']}` | `{row['profile']}` |")
    lines.extend(
        [
            "",
            "## Promotion Gate",
            "",
            f"- `hole@10` must equal `{payload['promotion_gate']['hole_at_10_required']}`.",
            f"- Benchmark failures must be `<= {payload['promotion_gate']['max_benchmark_failures']}`.",
            "- nDCG and bpref must agree; raw nDCG-only wins do not count.",
            "- Excluding-repaired-doc slice must not regress.",
            f"- p95 latency may grow at most `{payload['promotion_gate']['max_p95_latency_regression_ratio']}x`.",
            f"- Index size may grow at most `{payload['promotion_gate']['max_index_size_growth_ratio']}x` unless quality improves materially.",
            "- No default profile promotion from this campaign.",
            "",
            "## NOT In Scope",
            "",
        ]
    )
    lines.extend(f"- {item}" for item in payload["not_in_scope"])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _run_health_stage(run_dir: Path, *, baseline_profile: str) -> dict[str, Any]:
    out = {
        track: run_audit(baseline_profile, track=track)
        for track in TRACKS
    }
    _write_json(run_dir / "corpus-health.json", out)
    return out


def _run_benchmark_passes(
    run_dir: Path,
    *,
    embed_profile: str,
    strategies: tuple[str, ...],
    passes: int,
    repaired_doc_ids: set[str],
    min_available_gb: float,
) -> dict[str, Any]:
    pass_payloads = []
    for idx in range(1, passes + 1):
        pass_dir = run_dir / f"pass-{idx}"
        payload = run_benchmark(
            embed_profile=embed_profile,
            strategies=list(strategies),
            tracks=list(TRACKS),
            run_dir=pass_dir,
            min_available_gb=min_available_gb,
            isolate_strategies=True,
        )
        payload["index_resource_stats"] = index_resource_stats(embed_profile)
        payload["slice_summary"] = summarize_benchmark(payload, repaired_doc_ids=repaired_doc_ids)
        _write_json(pass_dir / "benchmark-with-slices.json", payload)
        pass_payloads.append(payload)
    summary = {
        "embed_profile": embed_profile,
        "passes": passes,
        "pass_dirs": [str(run_dir / f"pass-{idx}") for idx in range(1, passes + 1)],
        "summaries": [payload["slice_summary"] for payload in pass_payloads],
    }
    _write_json(run_dir / "benchmark-summary.json", summary)
    return summary


def _run_diagnostics_stage(
    run_dir: Path,
    *,
    embed_profile: str,
    strategies: tuple[str, ...],
) -> dict[str, Any]:
    out = {}
    for track in TRACKS:
        qrels_path = _qrels_path(track)
        payload = run_diagnostics(
            track=track,  # type: ignore[arg-type]
            embed_profile=embed_profile,
            qrels_payload=load_qrels(qrels_path),
            strategies=list(strategies),
        )
        out[track] = payload
        _write_json(run_dir / f"diagnostics-{track}.json", payload)
        (run_dir / f"diagnostics-{track}.md").write_text(
            format_diagnostics_table(payload),
            encoding="utf-8",
        )
    return out


@click.command("performance-campaign")
@click.option("--baseline-profile", default=DEFAULT_BASELINE_PROFILE, show_default=True)
@click.option("--candidate-profile", "candidate_profiles", multiple=True, help="Candidate profile; repeatable.")
@click.option("--strategy", "strategies", multiple=True, default=DEFAULT_STRATEGIES, show_default=True)
@click.option("--passes", default=3, show_default=True, type=click.IntRange(min=1))
@click.option(
    "--stage",
    "stages",
    multiple=True,
    type=click.Choice(["plan", "health", "repair-audit", "repair", "baseline", "candidates", "diagnostics"]),
    help="Stage to execute; default writes plan only unless --execute is set.",
)
@click.option("--execute", is_flag=True, help="Run selected stages. Without this, only write campaign plan artifacts.")
@click.option("--build-candidates", is_flag=True, help="Build candidate profile indexes before benchmarking them.")
@click.option("--pdf-backend", default="docling", show_default=True, type=click.Choice(["pymupdf", "docling"]))
@click.option("--top-repair", default=0, show_default=True, type=click.IntRange(min=0), help="Repair audit limit; 0 = all.")
@click.option("--min-available-gb", default=8.0, show_default=True, type=click.FloatRange(min=1))
@click.option("--run-dir", type=click.Path(path_type=Path), default=None)
@click.option("--json", "as_json", is_flag=True, help="Print the campaign manifest JSON.")
def performance_campaign_cmd(
    baseline_profile: str,
    candidate_profiles: tuple[str, ...],
    strategies: tuple[str, ...],
    passes: int,
    stages: tuple[str, ...],
    execute: bool,
    build_candidates: bool,
    pdf_backend: str,
    top_repair: int,
    min_available_gb: float,
    run_dir: Path | None,
    as_json: bool,
) -> None:
    """Run or materialize the staged RAG performance campaign."""
    selected_candidates = candidate_profiles or FULL_CANDIDATE_PROFILES
    selected_stages = stages or (("plan",) if not execute else ("health", "repair-audit", "repair", "baseline", "diagnostics"))
    root = run_dir or DATA_DIR / "eval" / "runs" / f"{_timestamp()}-rag-performance-campaign"
    root.mkdir(parents=True, exist_ok=True)

    manifest = campaign_plan_payload(
        baseline_profile=baseline_profile,
        candidate_profiles=tuple(selected_candidates),
        passes=passes,
        strategies=tuple(strategies),
        stages=tuple(selected_stages),
    )
    _write_json(root / "campaign-plan.json", manifest)
    write_campaign_report(manifest, root / "campaign-plan.md")

    outputs: dict[str, Any] = {"run_dir": str(root), "plan": manifest}
    if execute:
        if "health" in selected_stages:
            outputs["health"] = _run_health_stage(root / "health", baseline_profile=baseline_profile)
        if "repair-audit" in selected_stages or "repair" in selected_stages:
            audit = run_fallback_audit(top=top_repair)
            outputs["repair_audit"] = audit
            write_fallback_report(audit, root / "repair-audit")
        repair_ids: set[str] = set()
        if "repair" in selected_stages:
            repair_rows = [
                row for row in outputs["repair_audit"]["rows"]
                if row["classification"] == "repairable_local_extraction"
            ]
            repair_doc_ids = [row["doc_id"] for row in repair_rows]
            repair_ids = set(repair_doc_ids)
            before_index = index_doc_stats(repair_doc_ids, embed_profile=baseline_profile)
            cache_invalidations = invalidate_repair_caches(
                repair_rows,
                pdf_backend=pdf_backend,
                embed_profile=baseline_profile,
            )
            if repair_ids:
                _execute_ingest(
                    force=True,
                    rebuild=False,
                    verbose=True,
                    log_file=str(root / "repair-ingest.log"),
                    embed_profile=baseline_profile,
                    pdf_backend=pdf_backend,
                    doc_ids=tuple(sorted(repair_ids)),
                )
            outputs["repair"] = {
                "doc_ids": repair_doc_ids,
                "embed_profile": baseline_profile,
                "pdf_backend": pdf_backend,
                "chunking_fingerprint": chunking_fingerprint(baseline_profile),
                "before_index": before_index,
                "cache_invalidations": cache_invalidations,
                "after_index": index_doc_stats(repair_doc_ids, embed_profile=baseline_profile),
                "after_audit": run_fallback_audit(
                    log_path=root / "repair-ingest.log",
                    top=0,
                    include_gemini=False,
                    reproduce=False,
                ) if repair_ids else None,
            }
        else:
            audit_rows = outputs.get("repair_audit", {}).get("rows", [])
            repair_ids = {row["doc_id"] for row in audit_rows if row.get("classification") == "repairable_local_extraction"}

        if "baseline" in selected_stages:
            outputs["baseline"] = _run_benchmark_passes(
                root / "baseline-repair-only",
                embed_profile=baseline_profile,
                strategies=tuple(strategies),
                passes=passes,
                repaired_doc_ids=repair_ids,
                min_available_gb=min_available_gb,
            )
        if "diagnostics" in selected_stages:
            outputs["diagnostics"] = _run_diagnostics_stage(
                root / "diagnostics-repair-only",
                embed_profile=baseline_profile,
                strategies=tuple(strategies),
            )
        if "candidates" in selected_stages:
            candidate_outputs = {}
            for profile in selected_candidates:
                candidate_dir = root / f"candidate-{profile}"
                if build_candidates:
                    _execute_ingest(
                        force=True,
                        rebuild=True,
                        verbose=True,
                        log_file=str(candidate_dir / "ingest.log"),
                        embed_profile=profile,
                        pdf_backend=pdf_backend,
                    )
                candidate_outputs[profile] = {
                    "benchmark": _run_benchmark_passes(
                        candidate_dir,
                        embed_profile=profile,
                        strategies=tuple(strategies),
                        passes=passes,
                        repaired_doc_ids=repair_ids,
                        min_available_gb=min_available_gb,
                    ),
                    "diagnostics": _run_diagnostics_stage(
                        candidate_dir / "diagnostics",
                        embed_profile=profile,
                        strategies=tuple(strategies),
                    ),
                }
            outputs["candidates"] = candidate_outputs

    _write_json(root / "campaign-output.json", outputs)
    if as_json:
        click.echo(json.dumps(outputs, indent=2))
    else:
        click.echo(f"Wrote {root / 'campaign-plan.md'}")
        click.echo(f"Manifest: {root / 'campaign-output.json'}")
