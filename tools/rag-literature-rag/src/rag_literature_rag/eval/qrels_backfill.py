"""Targeted qrels backfill for currently unjudged top-k retrieval holes."""
from __future__ import annotations

import copy
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rag_literature_rag.eval.diagnostics import run_diagnostics
from rag_literature_rag.eval.gold_validation import EvalTrack, cases_for_track
from rag_literature_rag.eval.judge import _RUBRIC_VERSION, _load_cache, judge_model, judge_pool
from rag_literature_rag.eval.pool_commands import _JUDGE_USD_PER_PAIR
from rag_literature_rag.eval.pooling import _EXPERIMENTAL_KIND
from rag_literature_rag.eval.qrels import DEFAULT_RELEVANCE_THRESHOLD, graded_labels, load_qrels
from rag_literature_rag.eval.strategies import strategy_registry
from rag_literature_rag.manifest import load_manifest, manifest_by_id
from rag_literature_rag.paths import DATA_DIR
from rag_literature_rag.query.identity import canonical_identity_map

DEFAULT_BACKFILL_STRATEGIES: tuple[str, ...] = ("dense", "hybrid", "bm25")


def _now_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def qrels_path(track: EvalTrack) -> Path:
    return DATA_DIR / "eval" / "qrels" / track / "qrels.json"


def _lookup_manifest_doc(by_id: dict[str, Any], doc_id: str) -> dict[str, Any]:
    item = by_id.get(doc_id)
    if item is None:
        return {"abstract": None}
    return {
        "title": item.title,
        "abstract": item.abstract,
        "year": item.year,
        "doc_kind": item.documentKind,
        "source_url": item.url,
    }


def _enrich_from_row(row: dict[str, Any], by_id: dict[str, Any], canonical: str) -> dict[str, Any]:
    manifest_doc = _lookup_manifest_doc(by_id, canonical)
    doc = {
        "canonical_doc_id": canonical,
        "doc_id": row.get("doc_id") or canonical,
        "title": row.get("title") or manifest_doc.get("title"),
        "excerpt": row.get("excerpt"),
        "source_url": row.get("source_url") or manifest_doc.get("source_url"),
        "systems": {},
        "curated": False,
        "abstract": manifest_doc.get("abstract"),
        "year": manifest_doc.get("year"),
        "doc_kind": manifest_doc.get("doc_kind"),
    }
    if not doc["abstract"] and row.get("abstract"):
        doc["abstract"] = row.get("abstract")
    return doc


def collect_unjudged_pool(
    *,
    track: EvalTrack,
    embed_profile: str,
    qrels_payload: dict[str, Any],
    strategies: list[str],
    depth: int,
    experimental_indexes: dict[str, str] | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    """Collect only unjudged canonical doc IDs from selected top-k rankings."""
    experimental_indexes = experimental_indexes or {}
    registry = strategy_registry()
    identities = canonical_identity_map()
    judged = graded_labels(qrels_payload)
    by_id = manifest_by_id(load_manifest())
    cases = cases_for_track(track)
    total_holes = 0

    pool_cases: dict[str, Any] = {}
    for case in cases:
        judged_set = {identities.canonicalize_doc_id(doc_id) for doc_id in judged.get(case.id, {})}
        pooled: dict[str, dict[str, Any]] = {}
        for name in strategies:
            strategy = registry.get(name)
            if strategy is None:
                raise ValueError(f"Unknown strategy {name!r}")
            kind = _EXPERIMENTAL_KIND.get(name)
            if kind:
                if kind not in experimental_indexes:
                    continue
                os.environ["RAG_LIT_EXPERIMENTAL_INDEX"] = experimental_indexes[kind]
            rows = strategy.run(case, embed_profile=embed_profile, top=depth)
            for rank, row in enumerate(rows[:depth], start=1):
                raw_doc_id = row.get("canonical_doc_id") or row.get("doc_id") or ""
                if not raw_doc_id:
                    continue
                canonical = identities.canonicalize_doc_id(raw_doc_id)
                if canonical in judged_set:
                    continue
                total_holes += 1
                entry = pooled.get(canonical)
                if entry is None:
                    entry = _enrich_from_row(row, by_id, canonical)
                    pooled[canonical] = entry
                prev = entry["systems"].get(name)
                entry["systems"][name] = rank if prev is None else min(prev, rank)
                if not entry.get("excerpt") and row.get("excerpt"):
                    entry["excerpt"] = row.get("excerpt")
        pool_cases[case.id] = {
            "query": case.query,
            "category": case.category,
            "pdf_only": case.pdf_only,
            "curated_relevant": sorted(case.relevant_doc_ids),
            "pooled": pooled,
        }

    unique_new_pairs = sum(len(case["pooled"]) for case in pool_cases.values())
    return (
        {
            "version": 1,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "track": track,
            "depth": depth,
            "embed_profile": embed_profile,
            "systems": strategies,
            "case_count": len(cases),
            "cases": pool_cases,
        },
        {"total_holes_found": total_holes, "unique_new_pairs": unique_new_pairs},
    )


def count_judge_cache_misses(pool: dict[str, Any], model: str) -> int:
    cache = _load_cache()
    misses = 0
    for case_id, case in pool["cases"].items():
        for doc_id in case["pooled"]:
            if f"{model}:{_RUBRIC_VERSION}:{case_id}:{doc_id}" not in cache:
                misses += 1
    return misses


def _cache_has_verdict(model: str, case_id: str, doc_id: str) -> bool:
    cache = _load_cache()
    return f"{model}:{_RUBRIC_VERSION}:{case_id}:{doc_id}" in cache


def merge_qrels(
    qrels_payload: dict[str, Any],
    judged_cases: dict[str, dict[str, dict[str, Any]]],
    *,
    model: str,
) -> tuple[dict[str, Any], dict[str, int]]:
    """Preserve existing qrels exactly and insert only missing judged doc IDs."""
    merged = copy.deepcopy(qrels_payload)
    cases = merged.setdefault("cases", {})
    inserted = 0
    skipped = 0
    for case_id, docs in judged_cases.items():
        target = cases.setdefault(case_id, {})
        for doc_id, verdict in docs.items():
            if doc_id in target:
                skipped += 1
                continue
            if not _cache_has_verdict(model, case_id, doc_id):
                skipped += 1
                continue
            target[doc_id] = copy.deepcopy(verdict)
            inserted += 1
    merged["generated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    merged.setdefault("judge_model", model)
    merged.setdefault("relevance_threshold", DEFAULT_RELEVANCE_THRESHOLD)
    return merged, {"judged_count": inserted, "skipped_or_error_count": skipped}


def write_qrels_atomic(path: Path, payload: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    backup = path.with_name(f"{path.stem}.backup-{_now_slug()}{path.suffix}")
    if path.exists():
        backup.write_bytes(path.read_bytes())
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)
    return backup


def _diagnostics_summary(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "strategy": row["strategy"],
            "hole@10": row["hole_rate@10"],
            "bpref": row["bpref_new"],
            "nDCG@10_new": row["ndcg@10_new"],
        }
        for row in payload.get("strategies", [])
    ]


def format_backfill_report(payload: dict[str, Any]) -> str:
    lines = [
        f"# Qrels backfill — {payload['track']}",
        "",
        f"- profile: {payload['embed_profile']}",
        f"- strategies: {', '.join(payload['strategies'])}",
        f"- depth: {payload['depth']}",
        f"- holes found: {payload['total_holes_found']}",
        f"- unique new pairs: {payload['unique_new_pairs']}",
        f"- judge cache misses: {payload['judge_cache_misses']}",
        f"- estimated cost: ${payload['estimated_cost_usd']:.2f}",
        f"- judged merged: {payload['judged_count']}",
        f"- skipped/errors: {payload['skipped_or_error_count']}",
        "",
        "## Before",
        "",
        "| strategy | hole@10 | bpref | nDCG@10_new |",
        "|---|---:|---:|---:|",
    ]
    for row in payload["before_diagnostics"]:
        lines.append(f"| {row['strategy']} | {row['hole@10']:.2f} | {row['bpref']:.3f} | {row['nDCG@10_new']:.3f} |")
    lines.extend(["", "## After", "", "| strategy | hole@10 | bpref | nDCG@10_new |", "|---|---:|---:|---:|"])
    for row in payload["after_diagnostics"]:
        lines.append(f"| {row['strategy']} | {row['hole@10']:.2f} | {row['bpref']:.3f} | {row['nDCG@10_new']:.3f} |")
    return "\n".join(lines) + "\n"


def write_run_report(payload: dict[str, Any], *, timestamp: str | None = None) -> Path:
    run_dir = DATA_DIR / "eval" / "runs" / f"{timestamp or _now_slug()}-qrels-backfill"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "report.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    (run_dir / "report.md").write_text(format_backfill_report(payload), encoding="utf-8")
    return run_dir


def run_qrels_backfill(
    *,
    track: EvalTrack,
    embed_profile: str,
    strategies: list[str] | None = None,
    depth: int = 10,
    budget_usd: float = 10.0,
    in_place: bool = False,
    qrels_file: Path | None = None,
    model: str | None = None,
    experimental_indexes: dict[str, str] | None = None,
) -> dict[str, Any]:
    selected = strategies or list(DEFAULT_BACKFILL_STRATEGIES)
    qrels_file = qrels_file or qrels_path(track)
    qrels_payload = load_qrels(qrels_file)
    resolved_model = model or judge_model()
    before = run_diagnostics(
        track=track,
        embed_profile=embed_profile,
        qrels_payload=qrels_payload,
        strategies=selected,
        depth=max(depth, 20),
        experimental_indexes=experimental_indexes,
    )
    pool, counts = collect_unjudged_pool(
        track=track,
        embed_profile=embed_profile,
        qrels_payload=qrels_payload,
        strategies=selected,
        depth=depth,
        experimental_indexes=experimental_indexes,
    )
    misses = count_judge_cache_misses(pool, resolved_model)
    estimated = misses * _JUDGE_USD_PER_PAIR
    if estimated > budget_usd:
        raise RuntimeError(
            f"Estimated ${estimated:.2f} exceeds --budget-usd {budget_usd:.2f}; "
            "nothing judged or merged."
        )
    judged_cases = judge_pool(pool, model=resolved_model)
    merged, merge_counts = merge_qrels(qrels_payload, judged_cases, model=resolved_model)
    backup_path: Path | None = None
    if in_place:
        backup_path = write_qrels_atomic(qrels_file, merged)
    after = run_diagnostics(
        track=track,
        embed_profile=embed_profile,
        qrels_payload=merged,
        strategies=selected,
        depth=max(depth, 20),
        experimental_indexes=experimental_indexes,
    )
    report = {
        "track": track,
        "embed_profile": embed_profile,
        "strategies": selected,
        "depth": depth,
        "qrels_path": str(qrels_file),
        "backup_path": str(backup_path) if backup_path else None,
        "in_place": in_place,
        **counts,
        "judge_model": resolved_model,
        "judge_cache_misses": misses,
        "estimated_cost_usd": estimated,
        **merge_counts,
        "before_diagnostics": _diagnostics_summary(before),
        "after_diagnostics": _diagnostics_summary(after),
    }
    report["run_dir"] = str(write_run_report(report))
    return report
