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

from rag_literature_rag.eval.gold_validation import EVAL_TRACKS


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
    from rag_literature_rag.eval.pooling import build_pool, pool_path, pool_stats, write_pool

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
@click.option("--model", default=None, help="Judge LLM model (default RAG_LIT_JUDGE_LLM_MODEL).")
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
    from rag_literature_rag.eval.judge import judge_agreement, judge_model, judge_pool
    from rag_literature_rag.eval.pooling import pool_path
    from rag_literature_rag.eval.qrels import DEFAULT_RELEVANCE_THRESHOLD, write_qrels

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
    from rag_literature_rag.paths import DATA_DIR

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
    from rag_literature_rag.eval.diagnostics import format_diagnostics_table, run_diagnostics
    from rag_literature_rag.eval.qrels import load_qrels

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


# Rough Gemini-Flash judge cost: ~500 input + ~30 output tokens per (query,doc)
# pair. gemini-2.5-flash ≈ $0.30/1M in, $2.50/1M out → ~$0.00023/judgment. Used
# only for the pre-spend budget gate; actual spend is dominated by cache reuse.
_JUDGE_USD_PER_PAIR = 0.00023


def _count_judge_misses(pool: dict, model: str) -> int:
    """How many (query,doc) pairs in this pool are NOT already in the judge cache."""
    from rag_literature_rag.eval.judge import _RUBRIC_VERSION, _load_cache

    cache = _load_cache()
    misses = 0
    for case_id, case in pool["cases"].items():
        for doc_id in case["pooled"]:
            if f"{model}:{_RUBRIC_VERSION}:{case_id}:{doc_id}" not in cache:
                misses += 1
    return misses


@click.command("gen-gold")
@click.option("--embed-profile", required=True)
@click.option("--n-catalog", default=300, show_default=True, type=click.IntRange(min=0))
@click.option("--n-pdf", default=200, show_default=True, type=click.IntRange(min=0))
@click.option("--hard-frac", default=0.2, show_default=True, type=click.FloatRange(0.0, 1.0))
@click.option("--seed", default=1234, show_default=True, type=int)
@click.option("--budget-usd", default=10.0, show_default=True, type=float,
              help="Refuse to judge if the estimated cache-miss spend exceeds this.")
@click.option("--depth", default=20, show_default=True, type=click.IntRange(min=1))
@click.option("--gen-only", is_flag=True, help="Generate + write cases.json; skip pool/judge.")
@click.option("-v", "--verbose", is_flag=True)
def gen_gold_cmd(
    embed_profile: str,
    n_catalog: int,
    n_pdf: int,
    hard_frac: float,
    seed: int,
    budget_usd: float,
    depth: int,
    gen_only: bool,
    verbose: bool,
) -> None:
    """Generate a stratified synthetic gold set (DataMorgana/ARES style) and judge it.

    System-blind Flash query generation grounded in sampled corpus docs, anti-leakage
    + de-dup filters, then the existing multi-system pool → UMBRELA judge pipeline. The
    curated-42 set is untouched; synthetic cases live in data/eval/gold_synth/cases.json
    and only enter the eval when RAG_LIT_SYNTH_GOLD=1.
    """
    import os

    if verbose:
        logging.basicConfig(level=logging.INFO)
    from rag_literature_rag.env import load_env_file
    from rag_literature_rag.eval.gold_synth import (
        CASES_PATH,
        build_synth_cases,
        write_cases,
    )

    load_env_file()  # Vertex creds + LLM location for Flash generation/judging

    cases, manifest = build_synth_cases(
        embed_profile,
        n_catalog=n_catalog,
        n_pdf=n_pdf,
        hard_frac=hard_frac,
        seed=seed,
    )
    write_cases(cases, manifest)
    click.echo(f"Wrote {CASES_PATH} — {manifest['total_cases']} synthetic cases")
    click.echo(json.dumps(manifest, indent=2))
    if gen_only:
        return

    # Route the synthetic set through the existing pool→judge pipeline.
    os.environ["RAG_LIT_SYNTH_GOLD"] = "1"
    from rag_literature_rag.eval.judge import judge_agreement, judge_model, judge_pool
    from rag_literature_rag.eval.pooling import build_pool, pool_path, write_pool
    from rag_literature_rag.eval.qrels import DEFAULT_RELEVANCE_THRESHOLD, write_qrels
    from rag_literature_rag.paths import DATA_DIR

    model = judge_model()
    pools: dict[str, dict] = {}
    total_misses = 0
    for track in ("catalog", "pdf-deep-read"):
        payload = build_pool(track, depth=depth, embed_profile=embed_profile)  # type: ignore[arg-type]
        write_pool(payload, pool_path(track))  # type: ignore[arg-type]
        pools[track] = payload
        misses = _count_judge_misses(payload, model)
        total_misses += misses
        click.echo(f"pooled {track}: {payload['case_count']} cases, {misses} judge cache-misses")

    est = total_misses * _JUDGE_USD_PER_PAIR
    click.echo(f"\nEstimated judge spend: ${est:.2f} ({total_misses} new pairs, model={model})")
    if est > budget_usd:
        raise click.ClickException(
            f"Estimated ${est:.2f} exceeds --budget-usd {budget_usd:.2f}; "
            "raise the budget or lower --n-catalog/--n-pdf. Pools written, nothing judged."
        )

    for track, payload in pools.items():
        cases_out = judge_pool(payload, model=model)
        out_path = DATA_DIR / "eval" / "qrels" / track / "qrels.json"
        agreement = judge_agreement(cases_out)
        write_qrels(
            out_path,
            cases_out,
            judge_model=model,
            relevance_threshold=DEFAULT_RELEVANCE_THRESHOLD,
            extra={"track": track, "synthetic": True, "judge_agreement": agreement},
        )
        click.echo(f"judged {track} → {out_path}  agreement={json.dumps(agreement)}")


@click.command("corpus-health")
@click.option("--embed-profile", required=True)
@click.option("--track", type=click.Choice(EVAL_TRACKS), default="catalog", show_default=True)
@click.option("--json", "as_json", is_flag=True, help="Emit the raw audit JSON.")
def corpus_health_cmd(embed_profile: str, track: str, as_json: bool) -> None:
    """Audit corpus/infra health (chunk density, extraction fallback, creds, pool holes).

    The highest-leverage self-improvement signal here: the biggest wins came from data
    and infrastructure defects, not retrieval-strategy tuning. Read-only, no LLM.
    """
    from rag_literature_rag.eval.corpus_health import SEVERITY, run_audit

    report = run_audit(embed_profile, track=track)
    if as_json:
        click.echo(json.dumps(report, indent=2))
        return
    icon = {"critical": "✗", "warning": "!", "info": "·", "ok": "✓"}
    click.echo(
        f"Corpus health — profile={report['profile']} track={report['track']} "
        f"worst={report['worst_severity']} "
        f"(critical={report['n_critical']} warning={report['n_warning']})\n"
    )
    for f in report["findings"]:
        click.echo(f"  {icon.get(f['severity'], '?')} [{f['severity']}] {f['code']}: {f['message']}")
        if f["remedy"]:
            click.echo(f"      → {f['remedy']}")
    raise SystemExit(1 if report["n_critical"] else 0)
