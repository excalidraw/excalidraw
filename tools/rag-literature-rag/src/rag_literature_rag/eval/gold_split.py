"""Frozen tune/test split of the gold case set.

Phase 0 of the measurement-repair campaign (see
``docs/quality-campaign-2026-06-18.md``) requires reporting Phase 1-3 deltas on
a held-out split so synthetic-gold tuning can't fit judge quirks. This module
builds and persists a deterministic, stratified split keyed by gold case id
(stable across ``cases_for_track`` re-labeling, since track only changes
``relevant_doc_ids``/``pdf_only``, never ``id``).

Stratification key: ``(category, track_membership)`` where ``track_membership``
is ``catalog`` if the case has any relevant doc with no usable local PDF (so it
*only* contributes to the catalog track), else ``both`` (it's eligible for both
catalog and pdf-deep-read). This keeps each split's category x track
distribution close to the full set's.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

from rag_literature_rag.eval.gold_cases import EvalCase, gold_cases
from rag_literature_rag.eval.gold_validation import DEFAULT_SPLIT_PATH, GOLD_SPLITS, cases_for_track
from rag_literature_rag.manifest import Manifest, load_manifest

TEST_FRACTION = 0.3


def _stratum_key(case: EvalCase, pdf_eligible_ids: set[str]) -> tuple[str, str]:
    category = case.category or "uncategorized"
    track_membership = "both" if (case.relevant_doc_ids & pdf_eligible_ids) else "catalog"
    return (category, track_membership)


def _stable_rank(case_id: str, seed: str) -> float:
    """Deterministic pseudo-random rank in [0, 1) for stratified shuffling."""
    digest = hashlib.sha256(f"{seed}:{case_id}".encode()).hexdigest()
    return int(digest[:16], 16) / 16**16


def build_tune_test_split(
    *,
    manifest: Manifest | None = None,
    test_fraction: float = TEST_FRACTION,
    seed: str = "rag-lit-gold-split-v1",
) -> dict:
    """Stratify the full gold case set by (category, track membership) and split
    each stratum ``1 - test_fraction`` / ``test_fraction`` into tune/test,
    rounding so every non-empty stratum contributes at least one test case.
    """
    manifest = manifest or load_manifest()
    pdf_eligible_ids = {item.id for item in manifest.items if item.status == "ok" and item.localPath}

    cases = gold_cases()
    strata: dict[tuple[str, str], list[EvalCase]] = defaultdict(list)
    for case in cases:
        strata[_stratum_key(case, pdf_eligible_ids)].append(case)

    tune_ids: list[str] = []
    test_ids: list[str] = []
    stratum_report: dict[str, dict] = {}
    for (category, track_membership), stratum_cases in sorted(strata.items()):
        ordered = sorted(stratum_cases, key=lambda c: _stable_rank(c.id, seed))
        n = len(ordered)
        n_test = max(1, round(n * test_fraction)) if n > 1 else 0
        test_cases = ordered[:n_test]
        tune_cases = ordered[n_test:]
        tune_ids.extend(c.id for c in tune_cases)
        test_ids.extend(c.id for c in test_cases)
        stratum_report[f"{category}::{track_membership}"] = {
            "total": n,
            "tune": len(tune_cases),
            "test": len(test_cases),
        }

    payload = {
        "version": "tune-test-split-v1",
        "seed": seed,
        "test_fraction": test_fraction,
        "total_cases": len(cases),
        "tune": sorted(tune_ids),
        "test": sorted(test_ids),
        "by_stratum": stratum_report,
    }
    return payload


def write_tune_test_split(payload: dict, *, path: Path | None = None) -> Path:
    out_path = path or DEFAULT_SPLIT_PATH
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n")
    return out_path


def validate_split_coverage(payload: dict) -> dict:
    """Sanity-check the split: full coverage, no overlap, both splits non-empty
    per track."""
    tune = set(payload["tune"])
    test = set(payload["test"])
    overlap = tune & test
    all_ids = {c.id for c in gold_cases()}
    covered = tune | test
    catalog_ids = {c.id for c in cases_for_track("catalog")}
    pdf_ids = {c.id for c in cases_for_track("pdf-deep-read")}
    return {
        "overlap_count": len(overlap),
        "missing_from_split": sorted(all_ids - covered),
        "extra_in_split": sorted(covered - all_ids),
        "tune_count": len(tune),
        "test_count": len(test),
        "catalog_tune": len(tune & catalog_ids),
        "catalog_test": len(test & catalog_ids),
        "pdf_deep_read_tune": len(tune & pdf_ids),
        "pdf_deep_read_test": len(test & pdf_ids),
        "valid": not overlap and not (all_ids - covered) and not (covered - all_ids),
    }


def format_split_report(payload: dict, coverage: dict) -> str:
    lines = [
        f"Tune/test split v{payload['version']} (seed={payload['seed']}, "
        f"test_fraction={payload['test_fraction']})",
        f"  total cases: {payload['total_cases']}  tune: {len(payload['tune'])}  "
        f"test: {len(payload['test'])}",
        f"  catalog: tune={coverage['catalog_tune']} test={coverage['catalog_test']}  "
        f"pdf-deep-read: tune={coverage['pdf_deep_read_tune']} test={coverage['pdf_deep_read_test']}",
        f"  coverage valid: {coverage['valid']} (overlap={coverage['overlap_count']}, "
        f"missing={len(coverage['missing_from_split'])}, extra={len(coverage['extra_in_split'])})",
    ]
    return "\n".join(lines)
