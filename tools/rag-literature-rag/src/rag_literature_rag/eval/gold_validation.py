from __future__ import annotations

import json
import os
from dataclasses import replace
from functools import lru_cache
from pathlib import Path
from typing import Literal

from rag_literature_rag.eval.gold_cases import EvalCase, gold_cases
from rag_literature_rag.manifest import Manifest, load_manifest
from rag_literature_rag.paths import DATA_DIR

EvalTrack = Literal["catalog", "pdf-deep-read"]
EVAL_TRACKS: tuple[EvalTrack, ...] = ("catalog", "pdf-deep-read")

GoldSplit = Literal["tune", "test"]
GOLD_SPLITS: tuple[GoldSplit, ...] = ("tune", "test")

#: Frozen tune/test split of gold case ids, stratified by category x track
#: (see ``eval/gold_split.py:build_tune_test_split``). Persisted once; later
#: phases reference it via the ``--split`` flag on ``benchmark``/``diagnostics``
#: so Phase-1+ tuning never touches the held-out test cases.
DEFAULT_SPLIT_PATH = DATA_DIR / "eval" / "tune_test_split.json"


@lru_cache(maxsize=4)
def _load_split_map(split_path: Path) -> dict[str, GoldSplit]:
    payload = json.loads(split_path.read_text())
    case_to_split: dict[str, GoldSplit] = {}
    for split_name in GOLD_SPLITS:
        for case_id in payload.get(split_name, []):
            case_to_split[case_id] = split_name  # type: ignore[assignment]
    return case_to_split


def split_for_case_id(case_id: str, *, split_path: Path | None = None) -> GoldSplit | None:
    """Look up which frozen split (``tune``/``test``) a gold case id belongs to.

    Returns ``None`` if the split file is missing or the id isn't in it (e.g. a
    gold case added after the split was frozen).
    """
    path = split_path or DEFAULT_SPLIT_PATH
    if not path.exists():
        return None
    return _load_split_map(path).get(case_id)


def filter_cases_by_split(
    cases: list[EvalCase],
    split: GoldSplit | None,
    *,
    split_path: Path | None = None,
) -> list[EvalCase]:
    """Filter ``cases`` to a frozen split. ``split=None`` is a no-op (full set)."""
    if split is None:
        return cases
    if split not in GOLD_SPLITS:
        raise ValueError(f"Unknown split {split!r}; choose from {', '.join(GOLD_SPLITS)}")
    path = split_path or DEFAULT_SPLIT_PATH
    if not path.exists():
        raise FileNotFoundError(f"No frozen split at {path}; run `eval gen-gold-split` first.")
    split_map = _load_split_map(path)
    return [case for case in cases if split_map.get(case.id) == split]


def validate_gold(manifest: Manifest | None = None) -> dict:
    manifest = manifest or load_manifest()
    by_id = {item.id: item for item in manifest.items}
    relevant_ids = sorted({doc_id for case in gold_cases() for doc_id in case.relevant_doc_ids})
    missing = [doc_id for doc_id in relevant_ids if doc_id not in by_id]
    metadata_only = [
        doc_id
        for doc_id in relevant_ids
        if doc_id in by_id and by_id[doc_id].status == "metadata_only"
    ]
    failed = [
        doc_id
        for doc_id in relevant_ids
        if doc_id in by_id and by_id[doc_id].status == "failed"
    ]
    impossible_pdf_cases = []
    for case in gold_cases():
        if not case.pdf_only:
            continue
        usable = [
            doc_id
            for doc_id in case.relevant_doc_ids
            if doc_id in by_id and by_id[doc_id].status == "ok" and by_id[doc_id].localPath
        ]
        if not usable:
            impossible_pdf_cases.append(case.id)
    return {
        "valid": not missing,
        "case_count": len(gold_cases()),
        "unique_relevant_doc_ids": len(relevant_ids),
        "missing_doc_ids": missing,
        "metadata_only_doc_ids": metadata_only,
        "failed_doc_ids": failed,
        "impossible_pdf_only_cases": impossible_pdf_cases,
    }


def cases_for_track(
    track: EvalTrack,
    *,
    manifest: Manifest | None = None,
    split: GoldSplit | None = None,
    split_path: Path | None = None,
) -> list[EvalCase]:
    if track not in EVAL_TRACKS:
        raise ValueError(f"Unknown eval track {track!r}; choose from {', '.join(EVAL_TRACKS)}")
    cases = gold_cases()
    if track == "catalog":
        out = [replace(case, pdf_only=False) for case in cases]
    else:
        manifest = manifest or load_manifest()
        pdf_ids = {
            item.id
            for item in manifest.items
            if item.status == "ok" and item.localPath
        }
        out = []
        for case in cases:
            relevant = frozenset(doc_id for doc_id in case.relevant_doc_ids if doc_id in pdf_ids)
            if not relevant:
                continue
            out.append(replace(case, relevant_doc_ids=relevant, pdf_only=True))
    # Falls back to RAG_LIT_GOLD_SPLIT so isolated benchmark-strategy subprocesses
    # (which inherit env but not Python call args) also honor --split.
    effective_split = split
    if effective_split is None:
        env_split = os.getenv("RAG_LIT_GOLD_SPLIT", "").strip()
        if env_split:
            effective_split = env_split  # type: ignore[assignment]
    return filter_cases_by_split(out, effective_split, split_path=split_path)
