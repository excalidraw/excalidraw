"""CLI: multi-system pooling, LLM judging, and pooling-bias diagnostics.

Workflow::

    eval pool        --track catalog --embed-profile P [--splade-index D] [--colbert-index D]
    eval judge       --track catalog
    eval diagnostics --track catalog --embed-profile P --qrels data/eval/qrels/catalog/qrels.json
    eval benchmark   --embed-profile P --qrels data/eval/qrels/catalog/qrels.json --report
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import click

from graph_layout_rag.eval.gold_validation import EVAL_TRACKS


def _experimental_indexes(splade_index: Path | None, colbert_index: Path | None) -> dict[str, str]:
    out: dict[str, str] = {}
    if splade_index:
        out["splade"] = str(splade_index)
    if colbert_index:
        out["colbert"] = str(colbert_index)
    return out


@click.command("pool")
@click.option("--track", type=click.Choice(EVAL_TRACKS), required=True)
@click.option("--embed-profile", required=True)
@click.option("--system", "systems", multiple=True, help="Pool system (repeatable); default diverse set.")
@click.option("--depth", default=50, show_default=True, type=click.IntRange(min=1))
@click.option("--splade-index", type=click.Path(path_type=Path, exists=True, file_okay=False), default=None)
@click.option("--colbert-index", type=click.Path(path_type=Path, exists=True, file_okay=False), default=None)
@click.option("-o", "--output", "output", type=click.Path(path_type=Path), default=None)
@click.option("-v", "--verbose", is_flag=True)
def pool_cmd(
    track: str,
    embed_profile: str,
    systems: tuple[str, ...],
    depth: int,
    splade_index: Path | None,
    colbert_index: Path | None,
    output: Path | None,
    verbose: bool,
) -> None:
    """Build a diverse multi-system candidate pool per gold case (de-biases the judge)."""
    if verbose:
        logging.basicConfig(level=logging.INFO)
    from graph_layout_rag.eval.pooling import build_pool, pool_path, pool_stats, write_pool

    payload = build_pool(
        track,  # type: ignore[arg-type]
        systems=list(systems) or None,
        depth=depth,
        embed_profile=embed_profile,
        experimental_indexes=_experimental_indexes(splade_index, colbert_index),
    )
    out_path = output or pool_path(track)  # type: ignore[arg-type]
    write_pool(payload, out_path)
    stats = pool_stats(payload)
    click.echo(f"Wrote {out_path}")
    click.echo(json.dumps({"systems": payload["systems"], **stats}, indent=2))


@click.command("judge")
@click.option("--track", type=click.Choice(EVAL_TRACKS), default=None, help="Locate the default pool for this track.")
@click.option("--pool", "pool_file", type=click.Path(path_type=Path, exists=True), default=None)
@click.option("--model", default=None, help="Judge LLM model (default GRAPH_RAG_JUDGE_LLM_MODEL).")
@click.option("-o", "--output", "output", type=click.Path(path_type=Path), default=None)
@click.option("-v", "--verbose", is_flag=True)
def judge_cmd(
    track: str | None,
    pool_file: Path | None,
    model: str | None,
    output: Path | None,
    verbose: bool,
) -> None:
    """LLM-judge a pool (UMBRELA 0-3, source-blind) into a graded qrels file."""
    if verbose:
        logging.basicConfig(level=logging.INFO)
    from graph_layout_rag.eval.judge import judge_agreement, judge_model, judge_pool
    from graph_layout_rag.eval.pooling import pool_path
    from graph_layout_rag.eval.qrels import DEFAULT_RELEVANCE_THRESHOLD, write_qrels

    if pool_file is None:
        if track is None:
            raise click.ClickException("Pass --pool or --track to locate the pool.")
        pool_file = pool_path(track)  # type: ignore[arg-type]
        if not pool_file.is_file():
            raise click.ClickException(f"No pool at {pool_file}; run `eval pool --track {track}` first.")
    pool = json.loads(Path(pool_file).read_text(encoding="utf-8"))
    resolved_model = model or judge_model()
    cases_out = judge_pool(pool, model=resolved_model)

    track_name = pool.get("track", track or "catalog")
    from graph_layout_rag.paths import DATA_DIR

    out_path = output or (DATA_DIR / "eval" / "qrels" / track_name / "qrels.json")
    agreement = judge_agreement(cases_out)
    write_qrels(
        out_path,
        cases_out,
        judge_model=resolved_model,
        relevance_threshold=DEFAULT_RELEVANCE_THRESHOLD,
        extra={"track": track_name, "pool": str(pool_file), "judge_agreement": agreement},
    )
    click.echo(f"Wrote {out_path}")
    click.echo(json.dumps(agreement, indent=2))


@click.command("diagnostics")
@click.option("--track", type=click.Choice(EVAL_TRACKS), required=True)
@click.option("--embed-profile", required=True)
@click.option("--qrels", "qrels_path", type=click.Path(path_type=Path, exists=True), required=True)
@click.option("--strategy", "strategies", multiple=True, help="Strategy (repeatable); default bm25,dense,hybrid.")
@click.option("--depth", default=20, show_default=True, type=click.IntRange(min=1))
@click.option("--splade-index", type=click.Path(path_type=Path, exists=True, file_okay=False), default=None)
@click.option("--colbert-index", type=click.Path(path_type=Path, exists=True, file_okay=False), default=None)
@click.option("-o", "--output", "output", type=click.Path(path_type=Path), default=None)
def diagnostics_cmd(
    track: str,
    embed_profile: str,
    qrels_path: Path,
    strategies: tuple[str, ...],
    depth: int,
    splade_index: Path | None,
    colbert_index: Path | None,
    output: Path | None,
) -> None:
    """Hole rate / judged@k / condensed nDCG / bpref on old vs new qrels."""
    from graph_layout_rag.eval.diagnostics import format_diagnostics_table, run_diagnostics
    from graph_layout_rag.eval.qrels import load_qrels

    selected = list(strategies) or ["bm25", "dense", "hybrid"]
    payload = run_diagnostics(
        track=track,  # type: ignore[arg-type]
        embed_profile=embed_profile,
        qrels_payload=load_qrels(qrels_path),
        strategies=selected,
        depth=depth,
        experimental_indexes=_experimental_indexes(splade_index, colbert_index),
    )
    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        Path(output).with_suffix(".md").write_text(format_diagnostics_table(payload), encoding="utf-8")
    click.echo(format_diagnostics_table(payload))


@click.command("corpus-health")
@click.option("--embed-profile", required=True)
@click.option("--track", type=click.Choice(EVAL_TRACKS), default="catalog", show_default=True)
@click.option("--json", "as_json", is_flag=True, help="Emit the raw audit JSON.")
def corpus_health_cmd(embed_profile: str, track: str, as_json: bool) -> None:
    """Audit corpus/infra health (chunk density, extraction fallback, creds, pool holes)."""
    from graph_layout_rag.eval.corpus_health import run_audit

    report = run_audit(embed_profile, track=track)
    if as_json:
        click.echo(json.dumps(report, indent=2))
        return
    icon = {"critical": "x", "warning": "!", "info": ".", "ok": "ok"}
    click.echo(
        f"Corpus health - profile={report['profile']} track={report['track']} "
        f"worst={report['worst_severity']} "
        f"(critical={report['n_critical']} warning={report['n_warning']})\n"
    )
    for f in report["findings"]:
        click.echo(f"  {icon.get(f['severity'], '?')} [{f['severity']}] {f['code']}: {f['message']}")
        if f["remedy"]:
            click.echo(f"      -> {f['remedy']}")
    raise SystemExit(1 if report["n_critical"] else 0)
