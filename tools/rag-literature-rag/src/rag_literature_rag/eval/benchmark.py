from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

import click

from rag_literature_rag.eval.gold_validation import EVAL_TRACKS, EvalTrack, cases_for_track, validate_gold
from rag_literature_rag.eval.hardware import (
    assert_memory_start_safe,
    memory_abort_reason,
    memory_snapshot,
    process_rss_gb,
)
from rag_literature_rag.eval.metrics import (
    aggregate_metrics,
    case_metrics,
    crowding_and_duplicates,
    per_category_metrics,
)
from rag_literature_rag.eval.strategies import ALL_STRATEGIES, resolve_strategies
from rag_literature_rag.paths import DATA_DIR


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def evaluate_strategy(
    strategy,
    *,
    embed_profile: str,
    track: EvalTrack = "catalog",
    top: int = 20,
    verbose: bool = False,
) -> dict[str, Any]:
    cases_out: list[dict[str, Any]] = []
    latencies: list[float] = []
    crowding_values: list[float] = []
    duplicate_total = 0
    cases = cases_for_track(track)

    if verbose:
        click.echo(f"  strategy {strategy.name}: 0/{len(cases)} cases", err=True)

    for idx, case in enumerate(cases, start=1):
        t0 = time.monotonic()
        results = strategy.run(case, embed_profile=embed_profile, top=top)
        latency = time.monotonic() - t0
        latencies.append(latency)

        metrics = case_metrics(results, case.relevant_doc_ids)
        crowding, duplicate_rate = crowding_and_duplicates(results, expected_count=top)
        crowding_values.append(crowding)
        duplicate_total += duplicate_rate

        cases_out.append(
            {
                "id": case.id,
                "track": track,
                "query": case.query,
                "category": case.category,
                "relevant_doc_ids": sorted(case.relevant_doc_ids),
                "top_doc_ids": [
                    row.get("canonical_doc_id") or row["doc_id"]
                    for row in results[:10]
                ],
                "latency_ms": round(latency * 1000, 2),
                **metrics,
            }
        )
        if verbose and (idx == len(cases) or idx % 5 == 0):
            click.echo(
                f"  strategy {strategy.name}: {idx}/{len(cases)} "
                f"(last {round(latency * 1000):.0f}ms)",
                err=True,
            )

    aggregate = aggregate_metrics(cases_out)
    sorted_latencies = sorted(latencies)
    p50_idx = max(0, len(sorted_latencies) // 2 - 1)
    p95_idx = max(0, int(len(sorted_latencies) * 0.95) - 1)

    payload = {
        "strategy": strategy.name,
        "track": track,
        "requires_llm": strategy.requires_llm,
        "requires_cloud_cost": strategy.requires_cloud_cost,
        **aggregate,
        "per_category": per_category_metrics(cases_out),
        "per_document_crowding": round(mean(crowding_values), 3),
        "duplicate_result_rate": round(duplicate_total / max(1, len(cases_out)), 6),
        "latency_ms_mean": round(mean(latencies) * 1000, 2),
        "latency_ms_p50": round(sorted_latencies[p50_idx] * 1000, 2),
        "latency_ms_p95": round(sorted_latencies[p95_idx] * 1000, 2),
        "cases": cases_out,
        "failures": [
            {
                "id": row["id"],
                "query": row["query"],
                "relevant_doc_ids": row["relevant_doc_ids"],
                "top_doc_ids": row["top_doc_ids"],
            }
            for row in cases_out
            if row["hit_rate@10"] < 1.0
        ],
    }
    if strategy.requires_cloud_cost:
        payload["cloud_ranking_units"] = len(cases)
        payload["estimated_cloud_cost_usd"] = round(len(cases) / 1000, 4)
    return payload


def run_benchmark(
    *,
    embed_profile: str,
    strategies: list[str] | None = None,
    llm_transforms: bool = False,
    cloud_rerank: bool = False,
    retrieval_index: Path | None = None,
    tracks: list[EvalTrack] | None = None,
    top: int = 20,
    verbose: bool = False,
    run_dir: Path | None = None,
    resume: bool = False,
    min_available_gb: float = 8.0,
    isolate_strategies: bool = True,
    max_process_rss_gb: float = 10.0,
    abort_available_gb: float = 3.0,
    max_swap_growth_gb: float = 2.0,
) -> dict[str, Any]:
    from rag_literature_rag.query.retrieve import clear_retrieve_caches, resolve_retrieve_context

    selected = resolve_strategies(
        strategies,
        llm_transforms=llm_transforms,
        cloud_rerank=cloud_rerank,
        experimental_index=retrieval_index is not None,
    )
    if not selected:
        raise click.ClickException("No strategies selected. Pass --strategy or enable --llm-transforms.")

    validation = validate_gold()
    if not validation["valid"]:
        raise click.ClickException(
            f"Gold set references missing documents: {validation['missing_doc_ids']}"
        )
    selected_tracks = tracks or ["catalog", "pdf-deep-read"]
    for track in selected_tracks:
        if track not in EVAL_TRACKS:
            raise click.ClickException(f"Unknown eval track {track!r}")

    start_memory = assert_memory_start_safe(min_available_gb)
    if not isolate_strategies:
        clear_retrieve_caches()
        resolve_retrieve_context(embed_profile=embed_profile)

    if run_dir:
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "strategies").mkdir(exist_ok=True)

    results: list[dict[str, Any]] = []
    for track in selected_tracks:
        for strategy in selected:
            result_path = run_dir / "strategies" / f"{track}--{strategy.name}.json" if run_dir else None
            if resume and result_path and result_path.is_file():
                results.append(json.loads(result_path.read_text(encoding="utf-8")))
                if verbose:
                    click.echo(f"Resumed {track}/{strategy.name}", err=True)
                continue
            preflight_error = _wait_for_memory_start(min_available_gb)
            if preflight_error:
                row = {
                    "strategy": strategy.name,
                    "track": track,
                    "status": "memory_aborted",
                    "error": preflight_error,
                    "peak_process_rss_gb": 0.0,
                    "failures": [],
                    "memory_after": memory_snapshot().to_dict(),
                }
                results.append(row)
                if result_path:
                    _atomic_write_json(result_path, row)
                continue
            if verbose:
                click.echo(f"Running {track}/{strategy.name}...", err=True)
            if isolate_strategies and result_path:
                row = _run_isolated_strategy(
                    strategy_name=strategy.name,
                    track=track,
                    embed_profile=embed_profile,
                    top=top,
                    result_path=result_path,
                    max_process_rss_gb=max_process_rss_gb,
                    abort_available_gb=abort_available_gb,
                    max_swap_growth_gb=max_swap_growth_gb,
                )
            else:
                row = evaluate_strategy(
                    strategy,
                    embed_profile=embed_profile,
                    track=track,
                    top=top,
                    verbose=verbose,
                )
            row["memory_after"] = memory_snapshot().to_dict()
            results.append(row)
            if result_path:
                _atomic_write_json(result_path, row)

    return {
        "generated_at": _now_iso(),
        "embed_profile": embed_profile,
        "top": top,
        "llm_transforms": llm_transforms,
        "cloud_rerank": cloud_rerank,
        "retrieval_index": str(retrieval_index) if retrieval_index else None,
        "strategies_tested": [strategy.name for strategy in selected],
        "tracks_tested": selected_tracks,
        "case_count_by_track": {track: len(cases_for_track(track)) for track in selected_tracks},
        "gold_validation": validation,
        "memory_start": start_memory.to_dict(),
        "memory_end": memory_snapshot().to_dict(),
        "hardware_limits": {
            "min_available_gb_to_start": min_available_gb,
            "max_process_rss_gb": max_process_rss_gb,
            "abort_available_gb": abort_available_gb,
            "max_swap_growth_gb": max_swap_growth_gb,
            "isolate_strategies": isolate_strategies,
        },
        "results": results,
    }


def _wait_for_memory_start(min_available_gb: float, *, timeout_s: float = 120) -> str | None:
    deadline = time.monotonic() + timeout_s
    last_error = ""
    while True:
        try:
            assert_memory_start_safe(min_available_gb)
            return None
        except RuntimeError as exc:
            last_error = str(exc)
            if time.monotonic() >= deadline:
                return f"preflight memory did not recover within {timeout_s:.0f}s: {last_error}"
            time.sleep(5)


def _run_isolated_strategy(
    *,
    strategy_name: str,
    track: EvalTrack,
    embed_profile: str,
    top: int,
    result_path: Path,
    max_process_rss_gb: float,
    abort_available_gb: float,
    max_swap_growth_gb: float,
) -> dict[str, Any]:
    before = memory_snapshot()
    command = [
        sys.executable,
        "-m",
        "rag_literature_rag.eval.worker",
        "--strategy",
        strategy_name,
        "--track",
        track,
        "--embed-profile",
        embed_profile,
        "--top",
        str(top),
        "--output",
        str(result_path),
    ]
    process = subprocess.Popen(command)
    peak_rss = 0.0
    abort_reason: str | None = None
    while process.poll() is None:
        peak_rss = max(peak_rss, process_rss_gb(process.pid) or 0.0)
        abort_reason = memory_abort_reason(
            pid=process.pid,
            start_swap_gb=before.swap_used_gb,
            max_process_rss_gb=max_process_rss_gb,
            min_available_gb=abort_available_gb,
            max_swap_growth_gb=max_swap_growth_gb,
        )
        if abort_reason:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
            break
        time.sleep(1)
    peak_rss = max(peak_rss, process_rss_gb(process.pid) or 0.0)
    if abort_reason:
        return {
            "strategy": strategy_name,
            "track": track,
            "status": "memory_aborted",
            "error": abort_reason,
            "peak_process_rss_gb": round(peak_rss, 3),
            "failures": [],
        }
    if process.returncode != 0 or not result_path.is_file():
        return {
            "strategy": strategy_name,
            "track": track,
            "status": "failed",
            "error": f"strategy worker exited with code {process.returncode}",
            "peak_process_rss_gb": round(peak_rss, 3),
            "failures": [],
        }
    row = json.loads(result_path.read_text(encoding="utf-8"))
    row["status"] = "completed"
    row["peak_process_rss_gb"] = round(peak_rss, 3)
    return row


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _default_run_dir(embed_profile: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return DATA_DIR / "eval" / "runs" / f"{timestamp}-{embed_profile}-{uuid.uuid4().hex[:8]}"


@click.command("benchmark")
@click.option("--embed-profile", required=True)
@click.option(
    "--strategy",
    "strategies",
    type=click.Choice(ALL_STRATEGIES),
    multiple=True,
    help="Strategy to run; defaults to all offline strategies.",
)
@click.option(
    "--isolate-strategies/--no-isolate-strategies",
    default=True,
    show_default=True,
    help="Run each strategy in a fresh monitored subprocess.",
)
@click.option("--max-process-rss-gb", default=10.0, show_default=True, type=click.FloatRange(min=1))
@click.option("--abort-available-gb", default=3.0, show_default=True, type=click.FloatRange(min=1))
@click.option("--max-swap-growth-gb", default=2.0, show_default=True, type=click.FloatRange(min=0))
@click.option(
    "--retrieval-index",
    type=click.Path(path_type=Path, exists=True, file_okay=False),
    default=None,
    help="Immutable SPLADE/ColBERT index directory to include.",
)
@click.option(
    "--cloud-rerank/--no-cloud-rerank",
    default=False,
    show_default=True,
    help="Include paid Google Ranking API strategies.",
)
@click.option(
    "--allow-cloud-cost",
    is_flag=True,
    help="Required acknowledgement before paid cloud-ranking requests.",
)
@click.option(
    "--max-cloud-ranking-units",
    default=500,
    show_default=True,
    type=click.IntRange(min=1),
    help="Hard cap for Google Ranking API units in this process.",
)
@click.option(
    "--llm-transforms/--no-llm-transforms",
    default=False,
    show_default=True,
    help="Enable LLM query transform strategies.",
)
@click.option("--top", default=20, show_default=True, type=click.IntRange(min=1))
@click.option(
    "--track",
    "tracks",
    type=click.Choice(EVAL_TRACKS),
    multiple=True,
    help="Evaluation track; defaults to catalog and pdf-deep-read.",
)
@click.option(
    "--run-dir",
    type=click.Path(path_type=Path),
    default=None,
    help="Immutable run directory; defaults to data/eval/runs/{timestamp}-{profile}-{id}.",
)
@click.option("--resume", is_flag=True, help="Reuse completed per-strategy results in --run-dir.")
@click.option(
    "--min-available-gb",
    default=8.0,
    show_default=True,
    type=click.FloatRange(min=1),
    help="Refuse to start a strategy below this available-memory threshold.",
)
@click.option(
    "-o",
    "output_path",
    type=click.Path(path_type=Path),
    default=None,
    help="Write JSON results (default: data/eval/{profile}-benchmark.json).",
)
@click.option(
    "--qrels",
    "qrels_path",
    type=click.Path(path_type=Path, exists=True),
    default=None,
    help="Judged qrels file to overlay onto the gold set (de-biased relevance labels).",
)
@click.option("--report", is_flag=True, help="Also write markdown report next to JSON output.")
@click.option(
    "--split",
    type=click.Choice(["tune", "test"]),
    default=None,
    help="Restrict to the frozen tune/test split (data/eval/tune_test_split.json); "
    "omit for the full gold set. Tuning sweeps use tune; final deltas report test.",
)
@click.option("-v", "--verbose", is_flag=True, help="Log per-strategy progress to stderr.")
@click.option("--json", "as_json", is_flag=True, help="Print JSON to stdout.")
def benchmark_cmd(
    embed_profile: str,
    strategies: tuple[str, ...],
    llm_transforms: bool,
    cloud_rerank: bool,
    allow_cloud_cost: bool,
    max_cloud_ranking_units: int,
    retrieval_index: Path | None,
    top: int,
    tracks: tuple[EvalTrack, ...],
    run_dir: Path | None,
    resume: bool,
    min_available_gb: float,
    isolate_strategies: bool,
    max_process_rss_gb: float,
    abort_available_gb: float,
    max_swap_growth_gb: float,
    qrels_path: Path | None,
    output_path: Path | None,
    report: bool,
    split: str | None,
    verbose: bool,
    as_json: bool,
) -> None:
    """Benchmark retrieval strategies against the gold evaluation set."""
    if cloud_rerank and not allow_cloud_cost:
        raise click.ClickException("--cloud-rerank requires --allow-cloud-cost")
    # Propagates to isolated strategy worker subprocesses via env inheritance,
    # same mechanism as RAG_LIT_QRELS_PATH below.
    if split:
        os.environ["RAG_LIT_GOLD_SPLIT"] = split
    if allow_cloud_cost:
        os.environ["RAG_LIT_ALLOW_CLOUD_COST"] = "true"
        os.environ["RAG_LIT_MAX_CLOUD_RANKING_UNITS"] = str(max_cloud_ranking_units)
    if retrieval_index:
        os.environ["RAG_LIT_EXPERIMENTAL_INDEX"] = str(retrieval_index)
    # Propagates to isolated strategy workers (subprocesses inherit env), so
    # gold_cases() overlays the judged labels there too.
    if qrels_path:
        os.environ["RAG_LIT_QRELS_PATH"] = str(qrels_path)
    run_dir = run_dir or _default_run_dir(embed_profile)
    if run_dir.exists() and any(run_dir.iterdir()) and not resume:
        raise click.ClickException(
            f"Run directory already exists and is not empty: {run_dir}. Pass --resume or choose another."
        )
    payload = run_benchmark(
        embed_profile=embed_profile,
        strategies=list(strategies) if strategies else None,
        llm_transforms=llm_transforms,
        cloud_rerank=cloud_rerank,
        retrieval_index=retrieval_index,
        tracks=list(tracks) if tracks else None,
        top=top,
        verbose=verbose,
        run_dir=run_dir,
        resume=resume,
        min_available_gb=min_available_gb,
        isolate_strategies=isolate_strategies,
        max_process_rss_gb=max_process_rss_gb,
        abort_available_gb=abort_available_gb,
        max_swap_growth_gb=max_swap_growth_gb,
    )
    payload["qrels"] = str(qrels_path) if qrels_path else None
    payload["split"] = split

    if output_path is None:
        output_path = run_dir / "benchmark.json"
    _atomic_write_json(output_path, payload)

    if report:
        from rag_literature_rag.eval.report import write_markdown_report

        report_path = output_path.with_suffix(".md")
        write_markdown_report(payload, report_path)

    if as_json:
        click.echo(json.dumps(payload, indent=2))
    else:
        click.echo(f"Wrote {output_path}")
        for row in payload["results"]:
            if "mrr" not in row:
                click.echo(
                    f"{row['track']}/{row['strategy']}: {row.get('status', 'failed')} "
                    f"{row.get('error', '')}"
                )
                continue
            click.echo(
                f"{row['track']}/{row['strategy']}: HR@5={row['hit_rate@5']:.3f} "
                f"R@5={row['recall@5']:.3f} "
                f"MRR={row['mrr']:.3f} nDCG@10={row['ndcg@10']:.3f} "
                f"latency={row['latency_ms_mean']:.0f}ms "
                f"failures={len(row['failures'])}"
            )
        if report:
            click.echo(f"Report: {output_path.with_suffix('.md')}")
