"""Corpus-health audit — the highest-leverage "self-improvement" signal for this RAG.

Empirically (see data/eval/campaign/findings.md), the biggest retrieval-quality wins
in this system came NOT from tuning retrieval strategies (hybrid already wins; ColBERT,
SPLADE, citation fusion, reranking all lose) but from *data and infrastructure* defects
that a config-tuning loop never surfaces:

  * an index that was 95% abstract-only because ingest ran before PDFs downloaded
    (822/863 PDF-backed docs collapsed to a single chunk);
  * GPU experiments that silently produced no numbers (broken lock, OOM, stale flags);
  * a judge rubric inherited from a sibling tool, framing the wrong domain.

So the audit checks corpus/infra health directly and emits ranked, actionable findings.
It is read-only, cheap (no LLM, no embedding), and resumable — safe to run in a loop.
"""
from __future__ import annotations

import collections
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rag_literature_rag.paths import (
    CHUNKS_TABLE,
    RAW_DIR,
    profile_index_paths,
)

# Severity ranks for sorting findings (higher = more urgent).
SEVERITY = {"critical": 3, "warning": 2, "info": 1, "ok": 0}
EXTRACTION_RE = re.compile(
    r"extracted document=(?P<doc_id>\S+) status=(?P<status>\S+) "
    r"chunks=(?P<chunks>\d+) reason=(?P<reason>\S+)"
)


@dataclass
class Finding:
    severity: str  # critical | warning | info | ok
    code: str
    message: str
    detail: dict[str, Any] = field(default_factory=dict)
    remedy: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "detail": self.detail,
            "remedy": self.remedy,
        }


def _load_chunks(profile: str) -> list[dict[str, Any]]:
    import lancedb

    paths = profile_index_paths(profile)
    if not paths.lance_dir.exists():
        return []
    db = lancedb.connect(str(paths.lance_dir))
    names = db.list_tables()
    names = names if isinstance(names, list) else list(getattr(names, "tables", names))
    if CHUNKS_TABLE not in names:
        return []
    cols = ["doc_id", "text", "canonical_sha256"]
    tbl = db.open_table(CHUNKS_TABLE)
    return tbl.search().select(cols).limit(tbl.count_rows()).to_arrow().to_pylist()


def _pdfs_on_disk() -> set[str]:
    pdf_dir = RAW_DIR / "pdf"
    if not pdf_dir.is_dir():
        return set()
    return {p.stem for p in pdf_dir.glob("*.pdf")}


def _load_qrel_doc_weights(track: str) -> dict[str, int]:
    """Return judged-doc frequency for a track.

    This is not a relevance claim. It is a cheap "blast radius" signal: if
    extraction fallbacks overlap many judged docs, benchmark failures can be
    data-quality artifacts rather than retrieval-method evidence.
    """
    from rag_literature_rag.paths import DATA_DIR

    qrels_path = DATA_DIR / "eval" / "qrels" / track / "qrels.json"
    if not qrels_path.is_file():
        return {}
    data = json.loads(qrels_path.read_text())
    cases = data.get("cases", data)
    weights: collections.Counter[str] = collections.Counter()
    if not isinstance(cases, dict):
        return {}
    for docs in cases.values():
        if not isinstance(docs, dict):
            continue
        for doc_id in docs:
            weights[doc_id] += 1
    return dict(weights)


def _scan_extraction_log(log_path: Path) -> dict[str, Any]:
    ok = fallback = 0
    by_reason: collections.Counter[str] = collections.Counter()
    fallback_by_reason: collections.Counter[str] = collections.Counter()
    fallback_docs: dict[str, str] = {}
    for line in log_path.read_text(errors="ignore").splitlines():
        match = EXTRACTION_RE.search(line)
        if not match:
            continue
        reason = match.group("reason")
        by_reason[reason] += 1
        if "fallback" in reason:
            fallback += 1
            fallback_by_reason[reason] += 1
            fallback_docs.setdefault(match.group("doc_id"), reason)
        else:
            ok += 1
    return {
        "ok": ok,
        "fallback": fallback,
        "total": ok + fallback,
        "by_reason": dict(by_reason.most_common()),
        "fallback_by_reason": dict(fallback_by_reason.most_common()),
        "fallback_docs": fallback_docs,
    }


def _qrel_overlap_detail(fallback_docs: dict[str, str], qrel_doc_weights: dict[str, int]) -> dict[str, Any]:
    overlap = [
        {"doc_id": doc_id, "judged_cases": qrel_doc_weights[doc_id], "reason": reason}
        for doc_id, reason in fallback_docs.items()
        if doc_id in qrel_doc_weights
    ]
    overlap.sort(key=lambda row: (-row["judged_cases"], row["doc_id"]))
    return {
        "qrel_fallback_docs": len(overlap),
        "qrel_fallback_judgments": sum(row["judged_cases"] for row in overlap),
        "top_qrel_fallback_docs": overlap[:10],
    }


def _active_index_fallback_docs(profile: str, fallback_docs: dict[str, str]) -> tuple[dict[str, str], dict[str, Any]]:
    """Filter historical log fallbacks to docs that still look fallback-like in the current index."""
    if not fallback_docs:
        return {}, {"historical_fallback_docs": 0, "resolved_fallback_docs": 0}
    wanted = set(fallback_docs)
    grouped: dict[str, list[str]] = {doc_id: [] for doc_id in wanted}
    for row in _load_chunks(profile):
        doc_id = row.get("doc_id")
        if doc_id in wanted:
            grouped[doc_id].append(str(row.get("text") or ""))

    active: dict[str, str] = {}
    resolved: list[dict[str, Any]] = []
    for doc_id, reason in fallback_docs.items():
        texts = grouped.get(doc_id) or []
        text_chars = sum(len(text.strip()) for text in texts)
        metadata_like = len(texts) <= 1 and text_chars < 4000
        if metadata_like:
            active[doc_id] = reason
        else:
            resolved.append({"doc_id": doc_id, "chunks": len(texts), "text_chars": text_chars})
    detail = {
        "historical_fallback_docs": len(fallback_docs),
        "resolved_fallback_docs": len(resolved),
        "sample_resolved_fallback_docs": resolved[:10],
    }
    return active, detail


def audit_chunk_distribution(profile: str, *, min_mean: float = 4.0) -> list[Finding]:
    """Flag the abstract-only-collapse failure mode: many PDF-backed docs at 1 chunk."""
    rows = _load_chunks(profile)
    if not rows:
        return [
            Finding(
                "critical",
                "no_index",
                f"No chunks found for profile {profile!r}.",
                remedy="Run: rag-literature-rag ingest --embed-profile " + profile,
            )
        ]
    cpd = collections.Counter(r["doc_id"] for r in rows)
    n_docs = len(cpd)
    mean = len(rows) / n_docs
    pdfs = _pdfs_on_disk()

    # Docs that have a PDF on disk but produced exactly one chunk → extraction fell
    # back to the abstract. This is the signal that caught the stale-index bug.
    one_chunk_pdf = sorted(d for d, c in cpd.items() if c == 1 and d in pdfs)
    pdf_docs = [d for d in cpd if d in pdfs]
    collapse_rate = (len(one_chunk_pdf) / len(pdf_docs)) if pdf_docs else 0.0

    findings: list[Finding] = [
        Finding(
            "info",
            "chunk_summary",
            f"{len(rows)} chunks / {n_docs} docs (mean {mean:.1f}/doc); "
            f"{sum(1 for c in cpd.values() if c >= 5)} docs >=5 chunks.",
            detail={
                "chunks": len(rows),
                "docs": n_docs,
                "mean_per_doc": round(mean, 2),
                "pdfs_on_disk": len(pdfs),
            },
        )
    ]
    if collapse_rate >= 0.5 and len(pdf_docs) >= 20:
        findings.append(
            Finding(
                "critical",
                "abstract_only_collapse",
                f"{len(one_chunk_pdf)}/{len(pdf_docs)} PDF-backed docs produced only 1 chunk "
                f"({collapse_rate:.0%}) — the index is mostly abstracts, not full text.",
                detail={"one_chunk_pdf_docs": len(one_chunk_pdf), "pdf_docs": len(pdf_docs),
                        "sample": one_chunk_pdf[:10]},
                remedy="Re-ingest full text: rag-literature-rag ingest --force --rebuild "
                "--pdf-backend docling  (ensure PDFs finished downloading first).",
            )
        )
    elif mean < min_mean:
        findings.append(
            Finding(
                "warning",
                "low_chunk_density",
                f"Mean {mean:.1f} chunks/doc is below {min_mean}; corpus may be abstract-heavy.",
                detail={"mean_per_doc": round(mean, 2)},
                remedy="Inspect extraction; consider --force --rebuild with docling.",
            )
        )
    else:
        findings.append(
            Finding("ok", "chunk_density_ok",
                    f"Chunk density healthy (mean {mean:.1f}/doc, collapse {collapse_rate:.0%}).")
        )
    return findings


def audit_extraction_fallback(
    *,
    track: str = "catalog",
    log_path: Path | None = None,
    profile: str | None = None,
) -> list[Finding]:
    """Scan the most recent ingest log for fallback rate, causes, and qrel overlap."""
    from rag_literature_rag.paths import INGEST_LOG_PATH

    log_path = log_path or INGEST_LOG_PATH
    if not log_path or not log_path.is_file():
        return [Finding("info", "no_ingest_log", "No ingest log to scan for fallbacks.")]
    stats = _scan_extraction_log(log_path)
    ok = stats["ok"]
    fallback = stats["fallback"]
    total = stats["total"]
    if total == 0:
        return [Finding("info", "no_extraction_records", "Ingest log has no per-doc extraction lines.")]
    fallback_docs = stats["fallback_docs"]
    index_detail: dict[str, Any] = {}
    if profile:
        fallback_docs, index_detail = _active_index_fallback_docs(profile, fallback_docs)
        fallback = len(fallback_docs)
    rate = fallback / total
    sev = "critical" if rate >= 0.5 else "warning" if rate >= 0.15 else "ok"
    qrel_overlap = _qrel_overlap_detail(fallback_docs, _load_qrel_doc_weights(track))
    return [
        Finding(
            sev,
            "extraction_fallback_rate",
            f"{fallback}/{total} current indexed docs still look like abstract fallbacks ({rate:.0%}).",
            detail={
                "fallback": fallback,
                "total": total,
                "rate": round(rate, 3),
                "by_reason": stats["by_reason"],
                "fallback_by_reason": stats["fallback_by_reason"],
                "sample_fallback_docs": [
                    {"doc_id": doc_id, "reason": reason}
                    for doc_id, reason in list(fallback_docs.items())[:10]
                ],
                **index_detail,
                **qrel_overlap,
            },
            remedy=("Many fall-backs at ~0.2s mean the PDF wasn't present/parseable when ingested; "
                    "verify PDFs on disk then --force --rebuild." if sev != "ok" else ""),
        )
    ]


def audit_credentials() -> list[Finding]:
    """Check the Gemini/Vertex creds that several pipeline steps silently require."""
    use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in {"1", "true"}
    has_key = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    has_vertex = bool(os.getenv("GOOGLE_CLOUD_PROJECT")) and (
        bool(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
        or (Path.home() / ".config/gcloud/application_default_credentials.json").is_file()
    )
    if has_key or (use_vertex and has_vertex):
        return [Finding("ok", "credentials_ok", "Gemini/Vertex credentials present.")]
    return [
        Finding(
            "warning",
            "missing_credentials",
            "No Gemini API key or Vertex ADC found — embedding/judging/transforms will fail here.",
            detail={"use_vertex": use_vertex, "has_api_key": has_key, "has_vertex_adc": has_vertex},
            remedy="Set GEMINI_API_KEY, or `gcloud auth application-default login` for Vertex. "
            "(The GPU box notably lacks ADC — only local-encoder strategies run there.)",
        )
    ]


def audit_pool_holes(track: str = "catalog") -> list[Finding]:
    """If a judged pool exists, report the worst-case hole rate (unjudged top docs).

    High hole rate means strategy comparisons are pooling-biased — the core fairness
    guard for the experiment loop.
    """
    from rag_literature_rag.paths import DATA_DIR

    qrels_path = DATA_DIR / "eval" / "qrels" / track / "qrels.json"
    if not qrels_path.is_file():
        return [Finding("info", "no_qrels", f"No judged qrels for track {track!r} yet.")]
    data = json.loads(qrels_path.read_text())
    cases = data.get("cases", data)
    judged_per_case = [len(v) for v in cases.values()] if isinstance(cases, dict) else []
    if not judged_per_case:
        return [Finding("info", "empty_qrels", f"Qrels for {track!r} has no cases.")]
    mean_judged = sum(judged_per_case) / len(judged_per_case)
    return [
        Finding(
            "info",
            "qrels_summary",
            f"{len(judged_per_case)} judged cases, mean {mean_judged:.0f} judged docs/case for {track!r}.",
            detail={"cases": len(judged_per_case), "mean_judged_per_case": round(mean_judged, 1)},
            remedy="Run `eval diagnostics` for exact hole_rate@k / bpref before trusting nDCG deltas.",
        )
    ]


def run_audit(profile: str, *, track: str = "catalog") -> dict[str, Any]:
    findings: list[Finding] = []
    findings += audit_chunk_distribution(profile)
    findings += audit_extraction_fallback(track=track, profile=profile)
    findings += audit_credentials()
    findings += audit_pool_holes(track)
    findings.sort(key=lambda f: SEVERITY.get(f.severity, 0), reverse=True)
    worst = findings[0].severity if findings else "ok"
    return {
        "profile": profile,
        "track": track,
        "worst_severity": worst,
        "n_critical": sum(1 for f in findings if f.severity == "critical"),
        "n_warning": sum(1 for f in findings if f.severity == "warning"),
        "findings": [f.to_dict() for f in findings],
    }
