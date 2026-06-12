from __future__ import annotations

import json
import signal
import time
from typing import Any

import click

from graph_layout_rag.harvest.arxiv import harvest_arxiv
from graph_layout_rag.harvest.bibliography import (
    download_bibliography_pdfs,
    filter_relevant_dois_resumable,
    pending_bibliography_resolve_dois,
    resolve_bibliography_dois,
    scan_bibliography_candidates,
    select_bibliography_dois,
)
from graph_layout_rag.harvest.books import book_metadata_stubs
from graph_layout_rag.harvest.checkpoint import (
    clear_bib_state,
    clear_checkpoint,
    discovery_complete,
    load_bib_state,
    load_checkpoint,
    save_checkpoint,
)
from graph_layout_rag.harvest.curated import harvest_curated
from graph_layout_rag.harvest.deferred_retry import run_deferred_retries
from graph_layout_rag.harvest.dblp import harvest_dblp
from graph_layout_rag.harvest.elk_references import harvest_elk_references
from graph_layout_rag.harvest.graphviz_theory import harvest_graphviz_theory
from graph_layout_rag.harvest.handbook import harvest_handbook
from graph_layout_rag.harvest.ledger import init_db, query_attempts, set_harvest_run, set_harvest_stage, summary
from graph_layout_rag.harvest.log import setup_harvest_logging
from graph_layout_rag.harvest.openalex import harvest_openalex
from graph_layout_rag.harvest.parallel import DEFAULT_WORKERS, MAX_WORKERS, set_workers
from graph_layout_rag.harvest.retry import retry_unresolved_multi_pass
from graph_layout_rag.harvest.semantic_scholar import harvest_semantic_scholar
from graph_layout_rag.harvest.topic_seeds import harvest_topic_seeds
from graph_layout_rag.harvest.verify import verify_manifest
from graph_layout_rag.manifest import load_manifest, save_manifest, upsert_item


def _merge_items(manifest, items) -> int:
    added = 0
    existing_ids = {i.id for i in manifest.items}
    for item in items:
        if item.id not in existing_ids:
            added += 1
        upsert_item(manifest, item)
    return added


def _counts(manifest) -> tuple[int, int, int, int]:
    ok = sum(1 for i in manifest.items if i.status == "ok")
    meta = sum(1 for i in manifest.items if i.status == "metadata_only")
    failed = sum(1 for i in manifest.items if i.status == "failed")
    return len(manifest.items), ok, meta, failed


def _save_progress(
    manifest,
    label: str,
    log,
    *,
    discovery_pass: int | None = None,
    bib_pass: int | None = None,
    bibliography: dict[str, Any] | None = None,
    preserve_bibliography: bool = True,
) -> None:
    save_manifest(manifest)
    total, ok, meta, failed = _counts(manifest)
    prior = load_checkpoint() or {}
    data: dict[str, Any] = {
        "stage": label,
        "total": total,
        "ok": ok,
        "metadata_only": meta,
        "failed": failed,
        "discovery_pass": discovery_pass if discovery_pass is not None else prior.get("discovery_pass", 1),
        "bib_pass": bib_pass if bib_pass is not None else prior.get("bib_pass", 1),
    }
    if bibliography is not None:
        data["bibliography"] = bibliography
    elif preserve_bibliography and "bibliography" in prior:
        data["bibliography"] = prior["bibliography"]
    save_checkpoint(data)
    msg = f"[{label}] saved — {total} items (ok={ok}, meta={meta}, failed={failed})"
    log.info(msg)
    click.echo(f"  {msg}")


def _run_stage(label: str, log, fn, *, required: bool = True) -> bool:
    log.info("=== stage: %s ===", label)
    click.echo(f"Harvesting {label}...")
    t0 = time.monotonic()
    try:
        fn()
    except Exception as exc:
        log.exception("stage failed: %s — %s", label, exc)
        click.echo(f"  Warning: {label} failed ({exc}) — continuing")
        return False
    elapsed = time.monotonic() - t0
    log.info("=== stage done: %s (%.1fs) ===", label, elapsed)
    return True


def _existing_ids(manifest) -> set[str]:
    return {i.id for i in manifest.items}


def _run_early_stages(manifest, log, *, kw, skip_topic_seeds: bool, skip_elk_bibliography: bool, dry_run: bool) -> None:
    _run_stage("Graphviz theory PDFs", log, lambda: _merge_items(manifest, harvest_graphviz_theory(**kw)))
    if not dry_run:
        _save_progress(manifest, "graphviz", log)

    _run_stage("Handbook chapter PDFs", log, lambda: _merge_items(manifest, harvest_handbook(**kw)))
    if not dry_run:
        _save_progress(manifest, "handbook", log)

    _merge_items(manifest, book_metadata_stubs())

    if not skip_topic_seeds:
        def _harvest_topic_seeds() -> None:
            def _on_doi_batch(items) -> None:
                _merge_items(manifest, items)
                if not dry_run:
                    _save_progress(manifest, "topic-seeds-doi", log)

            pdf_items = harvest_topic_seeds(
                **kw,
                on_doi_batch=_on_doi_batch if not dry_run else None,
            )
            _merge_items(manifest, pdf_items)

        _run_stage(
            "topic seeds (ELK, Sugiyama, compound, constraints)",
            log,
            _harvest_topic_seeds,
        )
        if not dry_run:
            _save_progress(manifest, "topic-seeds", log)

    _run_stage(
        "curated HN / Terrastruct crossing-minimization refs",
        log,
        lambda: _merge_items(manifest, harvest_curated(**kw)),
    )
    if not dry_run:
        _save_progress(manifest, "curated", log)

    if not skip_elk_bibliography:
        _run_stage(
            "ELK paper bibliography (arXiv:2311.00533)",
            log,
            lambda: _merge_items(manifest, harvest_elk_references(**kw)),
        )
        if not dry_run:
            _save_progress(manifest, "elk-bibliography", log)


def _run_discovery_pass(
    manifest,
    log,
    *,
    kw,
    max_openalex: int,
    max_openalex_per_topic: int,
    max_dblp: int,
    max_semantic_scholar: int,
    max_arxiv: int,
    skip_openalex: bool,
    skip_dblp: bool,
    skip_semantic_scholar: bool,
    skip_arxiv: bool,
    target: int | None,
    dry_run: bool,
    pipeline_only: bool = False,
) -> None:
    if not skip_openalex:
        cap = max_openalex
        label = "OpenAlex pipeline topics" if pipeline_only else "OpenAlex"
        _run_stage(
            f"{label} (max {cap}, {max_openalex_per_topic}/topic)",
            log,
            lambda: _merge_items(
                manifest,
                harvest_openalex(
                    max_works=cap,
                    max_per_topic=max_openalex_per_topic,
                    use_topic_queries=True,
                    oa_only=True,
                    existing_ids=_existing_ids(manifest),
                    pipeline_only=pipeline_only,
                    **kw,
                ),
            ),
        )
        if not dry_run:
            _save_progress(manifest, "openalex", log)

    if not skip_arxiv:
        arxiv_cap = max_arxiv
        if target:
            arxiv_cap = min(arxiv_cap, max(50, target - len(manifest.items)))
        _run_stage(
            f"arXiv (max {arxiv_cap})",
            log,
            lambda: _merge_items(
                manifest,
                harvest_arxiv(max_works=arxiv_cap, existing_ids=_existing_ids(manifest), **kw),
            ),
        )
        if not dry_run:
            _save_progress(manifest, "arxiv", log)

    if not skip_dblp and not pipeline_only:
        _run_stage(
            f"DBLP (max {max_dblp})",
            log,
            lambda: _merge_items(
                manifest,
                harvest_dblp(max_works=max_dblp, existing_ids=_existing_ids(manifest), **kw),
            ),
        )
        if not dry_run:
            _save_progress(manifest, "dblp", log)

    if (
        not skip_semantic_scholar
        and not pipeline_only
        and (target is None or len(manifest.items) < target)
    ):
        s2_cap = max_semantic_scholar
        if target:
            s2_cap = min(s2_cap, max(50, target - len(manifest.items)))
        _run_stage(
            f"Semantic Scholar (max {s2_cap})",
            log,
            lambda: _merge_items(
                manifest,
                harvest_semantic_scholar(
                    max_works=s2_cap,
                    existing_ids=_existing_ids(manifest),
                    **kw,
                ),
            ),
        )
        if not dry_run:
            _save_progress(manifest, "semantic-scholar", log)

    if not skip_openalex and target and len(manifest.items) < target and not pipeline_only:
        extra = min(800, target - len(manifest.items) + 100)
        broad_cap = len(manifest.items) + extra
        _run_stage(
            f"OpenAlex broad pass (max {broad_cap}, include paywalled metadata)",
            log,
            lambda: _merge_items(
                manifest,
                harvest_openalex(
                    max_works=broad_cap,
                    max_per_topic=60,
                    use_topic_queries=True,
                    oa_only=False,
                    existing_ids=_existing_ids(manifest),
                    **kw,
                ),
            ),
        )
        if not dry_run:
            _save_progress(manifest, "openalex-broad", log)


def _run_bibliography_pass(
    manifest,
    log,
    *,
    workers: int,
    max_bib_dois: int,
    dry_run: bool,
    resume: bool,
    prior: dict[str, Any] | None,
    discovery_pass: int,
    bib_pass: int,
    bib_state_holder: dict[str, Any],
) -> None:
    def work() -> None:
        bib_state: dict[str, Any] = load_bib_state(prior) if resume else {}
        bib_state_holder["bibliography"] = bib_state
        bib_state_holder["stage"] = "bibliography-scan"

        if bib_state.get("candidates") and bib_state.get("max_dois") == max_bib_dois:
            candidates = list(bib_state["candidates"])
            log.info("bibliography: resume — %d saved candidate DOI(s)", len(candidates))
        else:
            candidates = scan_bibliography_candidates(max_dois=max_bib_dois)
            if not candidates:
                return
            bib_state = {
                "max_dois": max_bib_dois,
                "candidates": candidates,
                "relevance": bib_state.get("relevance") or {},
                "resolved_dois": bib_state.get("resolved_dois") or [],
            }
            bib_state_holder["bibliography"] = bib_state
            bib_state_holder["stage"] = "bibliography-scan"
            _save_progress(
                manifest,
                "bibliography-scan",
                log,
                discovery_pass=discovery_pass,
                bib_pass=bib_pass,
                bibliography=dict(bib_state),
                preserve_bibliography=False,
            )

        relevance_raw = bib_state.get("relevance") or {}
        relevance = {str(k): bool(v) for k, v in relevance_raw.items()}
        bib_state_holder["stage"] = "bibliography-relevance"

        def _on_relevance_batch(decisions: dict[str, bool]) -> None:
            bib_state["relevance"] = {k: v for k, v in decisions.items()}
            bib_state_holder["bibliography"] = bib_state
            _save_progress(
                manifest,
                "bibliography-relevance",
                log,
                discovery_pass=discovery_pass,
                bib_pass=bib_pass,
                bibliography=dict(bib_state),
                preserve_bibliography=False,
            )

        decisions = filter_relevant_dois_resumable(
            candidates,
            workers=workers,
            relevance_decisions=relevance,
            on_decisions_batch=_on_relevance_batch,
        )
        bib_state["relevance"] = {k: v for k, v in decisions.items()}

        if bib_state.get("selected") and bib_state.get("max_dois") == max_bib_dois:
            selected = list(bib_state["selected"])
        else:
            selected = select_bibliography_dois(candidates, decisions, max_dois=max_bib_dois)
            bib_state["selected"] = selected
        bib_state_holder["bibliography"] = bib_state
        _save_progress(
            manifest,
            "bibliography-relevance",
            log,
            discovery_pass=discovery_pass,
            bib_pass=bib_pass,
            bibliography=dict(bib_state),
            preserve_bibliography=False,
        )

        log.info("bibliography: found %d new relevant DOIs from seed PDFs", len(selected))
        click.echo(f"  Found {len(selected)} new relevant DOIs from seed PDFs")
        if not selected:
            clear_bib_state()
            _save_progress(
                manifest,
                "bibliography",
                log,
                discovery_pass=discovery_pass,
                bib_pass=bib_pass,
                preserve_bibliography=False,
            )
            return

        resolved = list(bib_state.get("resolved_dois") or [])
        pending = pending_bibliography_resolve_dois(
            selected,
            resolved_dois=resolved,
            manifest=manifest,
        )
        bib_state_holder["stage"] = "bibliography-resolve"

        def _on_resolve_batch(items) -> None:
            _merge_items(manifest, items)
            for item in items:
                if item.doi and item.doi.lower() not in {d.lower() for d in resolved}:
                    resolved.append(item.doi)
            bib_state["resolved_dois"] = resolved
            bib_state_holder["bibliography"] = bib_state
            _save_progress(
                manifest,
                "bibliography-resolve",
                log,
                discovery_pass=discovery_pass,
                bib_pass=bib_pass,
                bibliography=dict(bib_state),
                preserve_bibliography=False,
            )

        if pending:
            log.info("bibliography: resolving %d pending DOI(s) (%d already done)", len(pending), len(resolved))
            resolve_bibliography_dois(pending, workers=workers, on_batch=_on_resolve_batch)

        download_bibliography_pdfs(manifest, dry_run=dry_run, workers=workers)
        save_manifest(manifest)
        clear_bib_state()
        bib_state_holder.pop("bibliography", None)
        bib_state_holder["stage"] = "bibliography"
        _save_progress(
            manifest,
            "bibliography",
            log,
            discovery_pass=discovery_pass,
            bib_pass=bib_pass,
            preserve_bibliography=False,
        )

    _run_stage("bibliography DOI chain from seed PDFs", log, work)


def _apply_pipeline_harvest_defaults(
    max_openalex: int | None,
    max_openalex_per_topic: int | None,
    max_dblp: int | None,
    max_semantic_scholar: int | None,
    max_arxiv: int | None,
    max_bib_dois: int | None,
    target: int | None,
    target_pdfs: int | None,
    retry_passes: int,
    bib_passes: int,
) -> tuple[int, int, int, int, int, int, int | None, int | None, int, int]:
    return (
        max_openalex or 6000,
        max_openalex_per_topic or 120,
        max_dblp or 0,
        max_semantic_scholar or 0,
        max_arxiv or 200,
        max_bib_dois or 2000,
        target or 4500,
        target_pdfs or 3088,
        retry_passes if retry_passes > 1 else 3,
        bib_passes if bib_passes > 1 else 3,
    )


def _apply_deep_harvest_defaults(
    deep_harvest: bool,
    max_openalex: int | None,
    max_openalex_per_topic: int | None,
    max_dblp: int | None,
    max_semantic_scholar: int | None,
    max_arxiv: int | None,
    max_bib_dois: int | None,
    target: int | None,
    target_pdfs: int | None,
    retry_passes: int,
    bib_passes: int,
) -> tuple[int, int, int, int, int, int, int | None, int | None, int, int]:
    if deep_harvest:
        return (
            max_openalex or 4000,
            max_openalex_per_topic or 80,
            max_dblp or 400,
            max_semantic_scholar or 800,
            max_arxiv or 500,
            max_bib_dois or 1200,
            target or 2800,
            target_pdfs or 2000,
            retry_passes if retry_passes > 1 else 3,
            bib_passes if bib_passes > 1 else 3,
        )
    return (
        max_openalex or 200,
        max_openalex_per_topic or 30,
        max_dblp or 120,
        max_semantic_scholar or 250,
        max_arxiv or 100,
        max_bib_dois or 300,
        target,
        target_pdfs,
        retry_passes,
        bib_passes,
    )


def _execute_harvest(
    *,
    dry_run: bool,
    workers: int,
    target: int | None,
    target_pdfs: int | None,
    max_openalex: int,
    max_openalex_per_topic: int,
    max_dblp: int,
    max_semantic_scholar: int,
    max_arxiv: int,
    max_bib_dois: int,
    bib_passes: int,
    retry_passes: int,
    max_passes: int,
    skip_openalex: bool,
    skip_dblp: bool,
    skip_arxiv: bool,
    skip_bibliography: bool,
    skip_topic_seeds: bool,
    skip_elk_bibliography: bool,
    skip_semantic_scholar: bool,
    skip_retry: bool,
    resume: bool,
    pipeline_harvest: bool,
    verbose: bool,
    log_file: str | None,
) -> None:
    from pathlib import Path

    log = setup_harvest_logging(
        log_file=Path(log_file) if log_file else None,
        verbose=verbose,
    )
    set_workers(workers)
    init_db()
    set_harvest_run(None)
    set_harvest_stage("harvest")

    manifest_holder: dict[str, Any] = {"manifest": None}
    bib_state_holder: dict[str, Any] = {}
    interrupted = {"flag": False}

    def _on_sigint(_signum, _frame) -> None:
        interrupted["flag"] = True
        log.warning("SIGINT received — saving manifest and checkpoint")
        m = manifest_holder.get("manifest")
        if m is not None:
            save_manifest(m)
            total, ok, meta, failed = _counts(m)
            prior_ck = load_checkpoint() or {}
            stage = bib_state_holder.get("stage") or prior_ck.get("stage") or "interrupted"
            data: dict[str, Any] = {
                "stage": stage,
                "total": total,
                "ok": ok,
                "metadata_only": meta,
                "failed": failed,
                "discovery_pass": prior_ck.get("discovery_pass", 1),
                "bib_pass": prior_ck.get("bib_pass", 1),
            }
            if bib_state_holder.get("bibliography"):
                data["bibliography"] = bib_state_holder["bibliography"]
            elif "bibliography" in prior_ck:
                data["bibliography"] = prior_ck["bibliography"]
            save_checkpoint(data)
        click.echo("\nInterrupted — progress saved. Re-run with --resume to continue.")

    signal.signal(signal.SIGINT, _on_sigint)

    manifest = load_manifest()
    manifest_holder["manifest"] = manifest
    prior = load_checkpoint()
    if prior and resume:
        log.info("resume checkpoint: %s", prior)
    total, ok, meta, failed = _counts(manifest)
    log.info(
        "harvest start workers=%d target=%s target_pdfs=%s pipeline=%s dry_run=%s resume=%s manifest=%d (ok=%d meta=%d failed=%d)",
        workers,
        target,
        target_pdfs,
        pipeline_harvest,
        dry_run,
        resume,
        total,
        ok,
        meta,
        failed,
    )
    click.echo(
        f"Harvesting with {workers} workers (target={target or 'none'}, target_pdfs={target_pdfs or 'none'}"
        f"{', pipeline-only' if pipeline_harvest else ''})..."
    )

    kw = {"dry_run": dry_run, "workers": workers}

    has_early_seeds = any(
        i.source in ("graphviz.org", "handbook", "topic-seed", "curated", "elk-bibliography")
        for i in manifest.items
    )
    skip_early = resume and has_early_seeds

    if pipeline_harvest:
        skip_early = True
        skip_topic_seeds = True
        skip_elk_bibliography = True

    if skip_early:
        log.info("resume: skipping early seed stages (already harvested)")
        click.echo("  resume: skipping early seed stages")
    else:
        _run_early_stages(
            manifest,
            log,
            kw=kw,
            skip_topic_seeds=skip_topic_seeds,
            skip_elk_bibliography=skip_elk_bibliography,
            dry_run=dry_run,
        )

    stagnant_passes = 0
    for pass_num in range(1, max_passes + 1):
        if interrupted["flag"]:
            break
        _, ok_before, _, _ = _counts(manifest)
        if target_pdfs and ok_before >= target_pdfs:
            log.info("target_pdfs reached: %d >= %d", ok_before, target_pdfs)
            break

        log.info("=== discovery pass %d/%d (ok=%d) ===", pass_num, max_passes, ok_before)
        click.echo(f"Discovery pass {pass_num}/{max_passes} (ok PDFs={ok_before})...")

        skip_discovery = (
            resume
            and prior
            and pass_num == prior.get("discovery_pass", 1)
            and discovery_complete(prior.get("stage"))
        )
        if skip_discovery:
            log.info("resume: skipping discovery pass %d (already completed)", pass_num)
            click.echo(f"  resume: skipping discovery pass {pass_num}")
        else:
            _run_discovery_pass(
                manifest,
                log,
                kw=kw,
                max_openalex=max_openalex,
                max_openalex_per_topic=max_openalex_per_topic,
                max_dblp=max_dblp,
                max_semantic_scholar=max_semantic_scholar,
                max_arxiv=max_arxiv,
                skip_openalex=skip_openalex,
                skip_dblp=skip_dblp,
                skip_semantic_scholar=skip_semantic_scholar,
                skip_arxiv=skip_arxiv,
                target=target,
                dry_run=dry_run,
                pipeline_only=pipeline_harvest,
            )
            save_manifest(manifest)
            if not dry_run:
                ck = load_checkpoint() or {}
                total, ok, meta, failed = _counts(manifest)
                ck.update(
                    {
                        "discovery_pass": pass_num,
                        "total": total,
                        "ok": ok,
                        "metadata_only": meta,
                        "failed": failed,
                    }
                )
                save_checkpoint(ck)

        if not skip_bibliography and not dry_run:
            for bib_num in range(1, bib_passes + 1):
                log.info("bibliography pass %d/%d", bib_num, bib_passes)
                bib_resume = resume and bib_num == prior.get("bib_pass", 1) if prior else False
                _run_bibliography_pass(
                    manifest,
                    log,
                    workers=workers,
                    max_bib_dois=max_bib_dois,
                    dry_run=dry_run,
                    resume=bib_resume,
                    prior=prior if bib_resume else None,
                    discovery_pass=pass_num,
                    bib_pass=bib_num,
                    bib_state_holder=bib_state_holder,
                )
                prior = load_checkpoint()

        if not skip_retry and not dry_run:
            pending = sum(
                1
                for i in manifest.items
                if i.status in ("failed", "metadata_only")
                and (i.doi or (i.url and ".pdf" in (i.url or "").lower()))
            )
            log.info("retry: %d items eligible", pending)
            click.echo(f"Retrying {pending} failed/metadata items ({retry_passes} passes)...")
            upgraded = retry_unresolved_multi_pass(
                manifest, passes=retry_passes, dry_run=dry_run, workers=workers
            )
            save_manifest(manifest)
            click.echo(f"  Retry upgraded {upgraded} items to ok PDFs")

        _, ok_after, _, _ = _counts(manifest)
        if target_pdfs and ok_after >= target_pdfs:
            log.info("target_pdfs reached after pass %d: %d", pass_num, ok_after)
            break
        if ok_after == ok_before:
            stagnant_passes += 1
            if stagnant_passes >= 2:
                log.info("no PDF progress for 2 passes — stopping")
                click.echo("  No PDF progress for 2 passes — stopping discovery loop")
                break
        else:
            stagnant_passes = 0

    if not dry_run and not interrupted["flag"]:
        deferred = run_deferred_retries(manifest, workers=workers)
        if deferred:
            save_manifest(manifest)
            click.echo(f"  Deferred retry upgraded {deferred} items to ok PDFs")

    if not dry_run:
        stats = verify_manifest(manifest, downgrade=True)
        log.info("verify: %s", stats)
        save_manifest(manifest)
        if not interrupted["flag"]:
            clear_checkpoint()

    total, ok, meta, failed = _counts(manifest)
    summary = f"Done: {total} items (ok={ok}, metadata_only={meta}, failed={failed})"
    log.info(summary)
    click.echo(summary)
    if target_pdfs and ok < target_pdfs:
        log.warning("below target_pdfs: have %d, wanted %d", ok, target_pdfs)
        click.echo(f"  Warning: below target_pdfs ({ok} < {target_pdfs}) — run again or add sources.")
    if target and total < target:
        log.warning("below target: have %d, wanted %d", total, target)
        click.echo(f"  Warning: below target ({total} < {target}) — run again or add sources.")


def harvest_options(f):
    """Shared Click options for harvest commands."""
    f = click.option("--dry-run", is_flag=True, help="Discover URLs only; do not download.")(f)
    f = click.option(
        "--workers",
        default=DEFAULT_WORKERS,
        show_default=True,
        help=f"Parallel download threads (default {DEFAULT_WORKERS}; max {MAX_WORKERS}).",
    )(f)
    f = click.option("--target", default=None, type=int, help="Grow manifest to at least this many items.")(f)
    f = click.option("--target-pdfs", default=None, type=int, help="Stop when this many ok PDFs are downloaded.")(f)
    f = click.option("--max-openalex", default=None, type=int, help="Max OpenAlex works per pass.")(f)
    f = click.option("--max-openalex-per-topic", default=None, type=int)(f)
    f = click.option("--max-dblp", default=None, type=int)(f)
    f = click.option("--max-semantic-scholar", default=None, type=int)(f)
    f = click.option("--max-arxiv", default=None, type=int)(f)
    f = click.option("--max-bib-dois", default=None, type=int, help="Max bibliography DOIs per pass.")(f)
    f = click.option("--bib-passes", default=1, show_default=True)(f)
    f = click.option("--retry-passes", default=1, show_default=True)(f)
    f = click.option("--max-passes", default=5, show_default=True, help="Max discovery loop iterations.")(f)
    f = click.option("--skip-openalex", is_flag=True)(f)
    f = click.option("--skip-dblp", is_flag=True)(f)
    f = click.option("--skip-arxiv", is_flag=True)(f)
    f = click.option("--skip-bibliography", is_flag=True)(f)
    f = click.option("--skip-topic-seeds", is_flag=True)(f)
    f = click.option("--skip-elk-bibliography", is_flag=True)(f)
    f = click.option("--skip-semantic-scholar", is_flag=True)(f)
    f = click.option("--skip-retry", is_flag=True, help="Skip DOI retry pass.")(f)
    f = click.option("--resume", is_flag=True, help="Skip one-time early stages if already harvested.")(f)
    f = click.option("--deep-harvest", is_flag=True, help="Higher caps for 2k PDF harvest.")(f)
    f = click.option(
        "--pipeline-harvest",
        is_flag=True,
        help="Pipeline-layout topics only; target ~3088 ok PDFs (+1000 pipeline PDFs).",
    )(f)
    f = click.option("-v", "--verbose", is_flag=True, help="DEBUG logs on console.")(f)
    f = click.option("--log-file", default=None, type=click.Path(), help="Harvest log path.")(f)
    return f


def _run_harvest_from_kwargs(**kwargs) -> None:
    pipeline_harvest = kwargs.pop("pipeline_harvest", False)
    deep = kwargs.pop("deep_harvest")
    if pipeline_harvest:
        (
            kwargs["max_openalex"],
            kwargs["max_openalex_per_topic"],
            kwargs["max_dblp"],
            kwargs["max_semantic_scholar"],
            kwargs["max_arxiv"],
            kwargs["max_bib_dois"],
            kwargs["target"],
            kwargs["target_pdfs"],
            kwargs["retry_passes"],
            kwargs["bib_passes"],
        ) = _apply_pipeline_harvest_defaults(
            kwargs.get("max_openalex"),
            kwargs.get("max_openalex_per_topic"),
            kwargs.get("max_dblp"),
            kwargs.get("max_semantic_scholar"),
            kwargs.get("max_arxiv"),
            kwargs.get("max_bib_dois"),
            kwargs.get("target"),
            kwargs.get("target_pdfs"),
            kwargs.get("retry_passes", 1),
            kwargs.get("bib_passes", 1),
        )
        kwargs.setdefault("resume", True)
        kwargs["skip_dblp"] = kwargs.get("skip_dblp") or True
        kwargs["skip_semantic_scholar"] = kwargs.get("skip_semantic_scholar") or True
    else:
        (
            kwargs["max_openalex"],
            kwargs["max_openalex_per_topic"],
            kwargs["max_dblp"],
            kwargs["max_semantic_scholar"],
            kwargs["max_arxiv"],
            kwargs["max_bib_dois"],
            kwargs["target"],
            kwargs["target_pdfs"],
            kwargs["retry_passes"],
            kwargs["bib_passes"],
        ) = _apply_deep_harvest_defaults(
            deep,
            kwargs.get("max_openalex"),
            kwargs.get("max_openalex_per_topic"),
            kwargs.get("max_dblp"),
            kwargs.get("max_semantic_scholar"),
            kwargs.get("max_arxiv"),
            kwargs.get("max_bib_dois"),
            kwargs.get("target"),
            kwargs.get("target_pdfs"),
            kwargs.get("retry_passes", 1),
            kwargs.get("bib_passes", 1),
        )
    kwargs["pipeline_harvest"] = pipeline_harvest
    _execute_harvest(**kwargs)


@click.group(invoke_without_command=True)
@harvest_options
@click.pass_context
def harvest_group(
    ctx: click.Context,
    dry_run: bool,
    workers: int,
    target: int | None,
    target_pdfs: int | None,
    max_openalex: int | None,
    max_openalex_per_topic: int | None,
    max_dblp: int | None,
    max_semantic_scholar: int | None,
    max_arxiv: int | None,
    max_bib_dois: int | None,
    bib_passes: int,
    retry_passes: int,
    max_passes: int,
    skip_openalex: bool,
    skip_dblp: bool,
    skip_arxiv: bool,
    skip_bibliography: bool,
    skip_topic_seeds: bool,
    skip_elk_bibliography: bool,
    skip_semantic_scholar: bool,
    skip_retry: bool,
    resume: bool,
    deep_harvest: bool,
    pipeline_harvest: bool,
    verbose: bool,
    log_file: str | None,
) -> None:
    """Download graph drawing research corpus into data/manifest.json."""
    if ctx.invoked_subcommand is None:
        _run_harvest_from_kwargs(
            dry_run=dry_run,
            workers=workers,
            target=target,
            target_pdfs=target_pdfs,
            max_openalex=max_openalex,
            max_openalex_per_topic=max_openalex_per_topic,
            max_dblp=max_dblp,
            max_semantic_scholar=max_semantic_scholar,
            max_arxiv=max_arxiv,
            max_bib_dois=max_bib_dois,
            bib_passes=bib_passes,
            retry_passes=retry_passes,
            max_passes=max_passes,
            skip_openalex=skip_openalex,
            skip_dblp=skip_dblp,
            skip_arxiv=skip_arxiv,
            skip_bibliography=skip_bibliography,
            skip_topic_seeds=skip_topic_seeds,
            skip_elk_bibliography=skip_elk_bibliography,
            skip_semantic_scholar=skip_semantic_scholar,
            skip_retry=skip_retry,
            resume=resume,
            deep_harvest=deep_harvest,
            pipeline_harvest=pipeline_harvest,
            verbose=verbose,
            log_file=log_file,
        )


@harvest_group.command("run")
@harvest_options
def harvest_run_cmd(
    dry_run: bool,
    workers: int,
    target: int | None,
    target_pdfs: int | None,
    max_openalex: int | None,
    max_openalex_per_topic: int | None,
    max_dblp: int | None,
    max_semantic_scholar: int | None,
    max_arxiv: int | None,
    max_bib_dois: int | None,
    bib_passes: int,
    retry_passes: int,
    max_passes: int,
    skip_openalex: bool,
    skip_dblp: bool,
    skip_arxiv: bool,
    skip_bibliography: bool,
    skip_topic_seeds: bool,
    skip_elk_bibliography: bool,
    skip_semantic_scholar: bool,
    skip_retry: bool,
    resume: bool,
    deep_harvest: bool,
    pipeline_harvest: bool,
    verbose: bool,
    log_file: str | None,
) -> None:
    """Run full harvest pipeline."""
    _run_harvest_from_kwargs(
        dry_run=dry_run,
        workers=workers,
        target=target,
        target_pdfs=target_pdfs,
        max_openalex=max_openalex,
        max_openalex_per_topic=max_openalex_per_topic,
        max_dblp=max_dblp,
        max_semantic_scholar=max_semantic_scholar,
        max_arxiv=max_arxiv,
        max_bib_dois=max_bib_dois,
        bib_passes=bib_passes,
        retry_passes=retry_passes,
        max_passes=max_passes,
        skip_openalex=skip_openalex,
        skip_dblp=skip_dblp,
        skip_arxiv=skip_arxiv,
        skip_bibliography=skip_bibliography,
        skip_topic_seeds=skip_topic_seeds,
        skip_elk_bibliography=skip_elk_bibliography,
        skip_semantic_scholar=skip_semantic_scholar,
        skip_retry=skip_retry,
        resume=resume,
        deep_harvest=deep_harvest,
        pipeline_harvest=pipeline_harvest,
        verbose=verbose,
        log_file=log_file,
    )


@harvest_group.command("verify")
@click.option("--no-downgrade", is_flag=True, help="Report only; do not downgrade invalid ok items.")
def harvest_verify_cmd(no_downgrade: bool) -> None:
    """Verify ok manifest items have valid PDFs on disk."""
    manifest = load_manifest()
    stats = verify_manifest(manifest, downgrade=not no_downgrade)
    save_manifest(manifest)
    click.echo(
        f"Verify: checked={stats['checked']} valid={stats['valid']} "
        f"downgraded={stats['downgraded']} off_topic={stats['off_topic']} "
        f"orphan_pdfs={stats.get('orphan_pdfs', 0)}"
    )


@harvest_group.command("status")
def harvest_status_cmd() -> None:
    """Show manifest counts, checkpoint, and ledger summary."""
    manifest = load_manifest()
    total, ok, meta, failed = _counts(manifest)
    click.echo(f"Manifest: {total} items (ok={ok}, metadata_only={meta}, failed={failed})")
    ck = load_checkpoint()
    if ck:
        click.echo(f"Checkpoint: {json.dumps(ck)}")
    init_db()
    rep = summary()
    click.echo(f"Ledger run_id={rep['run_id']} attempts={rep['total_attempts']}")
    if rep["by_outcome"]:
        click.echo(f"  by_outcome: {rep['by_outcome']}")
    if rep["top_rate_limited_hosts"]:
        click.echo(f"  top_rate_limited_hosts: {rep['top_rate_limited_hosts']}")


@harvest_group.command("report")
@click.option("--transient", is_flag=True, help="Only transient failures.")
@click.option("--outcome", default=None, help="Filter by outcome (e.g. rate_limited).")
@click.option("--doc-id", default=None, help="Filter by document id.")
@click.option("--limit", default=50, show_default=True, type=int)
@click.option("--json", "as_json", is_flag=True, help="JSON output.")
def harvest_report_cmd(
    transient: bool,
    outcome: str | None,
    doc_id: str | None,
    limit: int,
    as_json: bool,
) -> None:
    """Show per-URL download attempts from harvest.db."""
    init_db()
    rows = query_attempts(
        transient=True if transient else None,
        outcome=outcome,
        doc_id=doc_id,
        limit=limit,
    )
    if as_json:
        click.echo(json.dumps(rows, indent=2))
        return
    if not rows:
        click.echo("No matching attempts.")
        return
    for row in rows:
        click.echo(
            f"{row['created_at']} {row['outcome']:14} "
            f"transient={row['transient']} {row['doc_id'] or '-':40} {row['url'][:80]}"
        )


# Backward-compatible alias for cli.py
harvest_cmd = harvest_group
