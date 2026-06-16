"""Graded relevance judgments (qrels) produced by multi-system pooling + LLM judging.

The production gold set (`gold_cases.py`) was expanded via *single-system* BM25
pooling, which biases the judge toward lexical retrieval: documents that only a
dense/ColBERT/SPLADE system surfaces were never shown for labeling, so they
score as non-relevant and drag neural retrievers down (classic TREC pooling
bias; Buckley & Voorhees; Lin et al. 2022).

This module stores the de-biased judgments built from a *diverse* pool and
overlays them onto the hand-curated gold cases. The overlay only ever **adds**
relevant docs (union) — an existing hand label is never dropped — so the neutral
qrels are a strict superset of the curated set.

Qrels file shape (``data/eval/qrels/<name>.json``)::

    {
      "version": 1,
      "judge_model": "gemini-3.1-pro-preview",
      "relevance_threshold": 2,            # grade >= threshold => binary-relevant
      "cases": {
        "<case_id>": {
          "<canonical_doc_id>": {"grade": 3, "rationale": "...",
                                  "systems": ["dense", "colbert"]}
        }
      }
    }

Grades follow the UMBRELA 0-3 scale: 0 irrelevant, 1 related, 2 highly relevant,
3 perfectly relevant. The default binary threshold (grade >= 2) keeps the
existing binary metrics in `metrics.py` meaningful.
"""
from __future__ import annotations

import json
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from rag_literature_rag.eval.gold_cases import EvalCase

DEFAULT_RELEVANCE_THRESHOLD = 2
QRELS_ENV = "RAG_LIT_QRELS_PATH"


def graded_labels(qrels: dict[str, Any]) -> dict[str, dict[str, int]]:
    """case_id -> {doc_id: grade} from a loaded qrels payload."""
    out: dict[str, dict[str, int]] = {}
    for case_id, docs in (qrels.get("cases") or {}).items():
        out[case_id] = {
            doc_id: int(entry.get("grade", 0))
            for doc_id, entry in docs.items()
        }
    return out


def load_qrels(path: Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if "cases" not in payload:
        raise ValueError(f"Not a qrels file (missing 'cases'): {path}")
    return payload


def relevant_from_grades(
    grades: dict[str, int],
    *,
    threshold: int = DEFAULT_RELEVANCE_THRESHOLD,
) -> set[str]:
    return {doc_id for doc_id, grade in grades.items() if grade >= threshold}


def apply_qrels_overlay(
    cases: list[EvalCase],
    qrels: dict[str, Any],
    *,
    threshold: int | None = None,
) -> list[EvalCase]:
    """Union judged-relevant docs into each case's relevant_doc_ids.

    Only adds — existing hand-curated labels are preserved. Cases with no entry
    in the qrels are returned unchanged. Pooled docs are keyed by canonical id;
    the metrics canonicalize both sides so mixing curated manifest ids with
    canonical ids is safe.
    """
    if threshold is None:
        threshold = int(qrels.get("relevance_threshold", DEFAULT_RELEVANCE_THRESHOLD))
    labels = graded_labels(qrels)
    out: list[EvalCase] = []
    for case in cases:
        judged = labels.get(case.id)
        if not judged:
            out.append(case)
            continue
        additions = relevant_from_grades(judged, threshold=threshold)
        merged = frozenset(case.relevant_doc_ids) | additions
        out.append(replace(case, relevant_doc_ids=merged))
    return out


def write_qrels(
    path: Path,
    cases: dict[str, dict[str, dict[str, Any]]],
    *,
    judge_model: str,
    relevance_threshold: int = DEFAULT_RELEVANCE_THRESHOLD,
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "judge_model": judge_model,
        "relevance_threshold": relevance_threshold,
        "cases": cases,
    }
    if extra:
        payload.update(extra)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)
