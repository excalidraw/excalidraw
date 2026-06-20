from __future__ import annotations

import collections
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click

from rag_literature_rag.eval.corpus_health import _load_qrel_doc_weights, _scan_extraction_log
from rag_literature_rag.ingest.chunk import chunking_fingerprint
from rag_literature_rag.ingest.extract import PDF_BACKENDS, extraction_cache_options, extract_pdf_result
from rag_literature_rag.manifest import ManifestItem, load_manifest, manifest_by_id
from rag_literature_rag.paths import CHUNKS_TABLE, DATA_DIR, INGEST_LOG_PATH, PKG_ROOT, profile_index_paths

LOCAL_BACKENDS = ("pymupdf", "docling")
TRACKS = ("catalog", "pdf-deep-read")
REFERENCE_HEADING_RE = re.compile(r"^\s*(references|bibliography)\s*$", re.IGNORECASE | re.MULTILINE)


@dataclass
class BackendReproduction:
    backend: str
    available: bool
    open_error: str | None = None
    pages: int = 0
    nonempty_pages: int = 0
    text_chars: int = 0
    failed_pages: int = 0
    text_quality: dict[str, Any] | None = None
    mupdf_messages: str = ""
    error: str | None = None

    @property
    def extracts_text(self) -> bool:
        return self.available and not self.open_error and self.text_chars > 0


def _sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _resolve_local_path(item: ManifestItem | None) -> Path | None:
    if item is None or not item.localPath:
        return None
    path = Path(item.localPath)
    return path if path.is_absolute() else PKG_ROOT / path


def text_quality_metrics(texts: list[str]) -> dict[str, Any]:
    """Cheap extraction-quality checks for repair triage."""
    joined = "\n".join(text.strip() for text in texts if text and text.strip())
    chars = len(joined)
    tokens_est = max(0, chars // 4)
    lines = [line.strip() for line in joined.splitlines() if line.strip()]
    duplicate_line_ratio = 0.0
    if lines:
        duplicate_line_ratio = round(1.0 - (len(set(lines)) / len(lines)), 4)
    lower = joined.lower()
    boilerplate_terms = ("all rights reserved", "copyright", "downloaded from", "arxiv:")
    boilerplate_hits = sum(lower.count(term) for term in boilerplate_terms)
    reference_chars = 0
    match = REFERENCE_HEADING_RE.search(joined)
    if match:
        reference_chars = len(joined[match.start():])
    reference_ratio = round(reference_chars / chars, 4) if chars else 0.0
    ascii_chars = sum(1 for ch in joined if ord(ch) < 128)
    ascii_ratio = round(ascii_chars / chars, 4) if chars else 0.0
    return {
        "text_chars": chars,
        "estimated_tokens": tokens_est,
        "line_count": len(lines),
        "duplicate_line_ratio": duplicate_line_ratio,
        "reference_section_ratio": reference_ratio,
        "boilerplate_hits": boilerplate_hits,
        "ascii_ratio": ascii_ratio,
        "nonempty": chars > 0,
    }


def qrel_weights_by_track(tracks: tuple[str, ...] = TRACKS) -> dict[str, dict[str, int]]:
    return {track: _load_qrel_doc_weights(track) for track in tracks}


def ranked_fallback_docs(
    *,
    log_path: Path = INGEST_LOG_PATH,
    tracks: tuple[str, ...] = TRACKS,
) -> list[dict[str, Any]]:
    stats = _scan_extraction_log(log_path)
    weights_by_track = qrel_weights_by_track(tracks)
    rows: list[dict[str, Any]] = []
    for doc_id, reason in stats["fallback_docs"].items():
        by_track = {track: weights.get(doc_id, 0) for track, weights in weights_by_track.items()}
        total = sum(by_track.values())
        rows.append(
            {
                "doc_id": doc_id,
                "fallback_reason": reason,
                "qrels_by_track": by_track,
                "qrel_placements": total,
            }
        )
    rows.sort(key=lambda row: (-row["qrel_placements"], row["doc_id"]))
    return rows


def reproduce_extractors(
    item: ManifestItem,
    *,
    include_gemini: bool = False,
    backends: tuple[str, ...] | None = None,
) -> list[BackendReproduction]:
    selected = tuple(backends or LOCAL_BACKENDS)
    if include_gemini and "gemini" not in selected:
        selected = (*selected, "gemini")
    out: list[BackendReproduction] = []
    for backend in selected:
        if backend not in PDF_BACKENDS:
            out.append(BackendReproduction(backend=backend, available=False, error="unknown backend"))
            continue
        try:
            result = extract_pdf_result(item, clean=True, backend=backend)
        except Exception as exc:  # noqa: BLE001 - this is an audit, not ingest
            out.append(BackendReproduction(backend=backend, available=False, error=str(exc)))
            continue
        text_chars = sum(len(text.strip()) for _, text in result.pages)
        nonempty_pages = sum(1 for _, text in result.pages if text.strip())
        out.append(
            BackendReproduction(
                backend=backend,
                available=True,
                open_error=result.open_error,
                pages=len(result.pages),
                nonempty_pages=nonempty_pages,
                text_chars=text_chars,
                failed_pages=len(result.failed_pages),
                text_quality=text_quality_metrics([text for _, text in result.pages]),
                mupdf_messages=result.mupdf_messages[:1000],
            )
        )
    return out


def classify_fallback(item: ManifestItem | None, file_exists: bool, reproductions: list[BackendReproduction]) -> str:
    if item is None or not item.localPath or not file_exists:
        return "missing_pdf"
    if any(row.extracts_text for row in reproductions):
        return "repairable_local_extraction"
    if reproductions:
        return "image_or_corrupt_pdf"
    return "unclassified"


def index_doc_stats(doc_ids: list[str], *, embed_profile: str) -> dict[str, dict[str, Any]]:
    """Read current indexed chunk stats for doc ids, best-effort."""
    if not doc_ids:
        return {}
    try:
        import lancedb
    except Exception:  # noqa: BLE001
        return {doc_id: {"error": "lancedb unavailable"} for doc_id in doc_ids}
    paths = profile_index_paths(embed_profile)
    if not paths.lance_dir.exists():
        return {doc_id: {"chunk_count": 0, "text_chars": 0, "index_missing": True} for doc_id in doc_ids}
    try:
        db = lancedb.connect(str(paths.lance_dir))
        names = db.list_tables()
        names = names if isinstance(names, list) else list(getattr(names, "tables", names))
        if CHUNKS_TABLE not in names:
            return {doc_id: {"chunk_count": 0, "text_chars": 0, "table_missing": True} for doc_id in doc_ids}
        table = db.open_table(CHUNKS_TABLE)
        rows = table.search().select(["doc_id", "text"]).limit(table.count_rows()).to_arrow().to_pylist()
    except Exception as exc:  # noqa: BLE001
        return {doc_id: {"error": str(exc)} for doc_id in doc_ids}

    wanted = set(doc_ids)
    grouped: dict[str, list[str]] = {doc_id: [] for doc_id in doc_ids}
    for row in rows:
        doc_id = row.get("doc_id")
        if doc_id in wanted:
            grouped[doc_id].append(str(row.get("text") or ""))
    return {
        doc_id: {
            "chunk_count": len(texts),
            "text_chars": sum(len(text.strip()) for text in texts),
            "text_quality": text_quality_metrics(texts),
            "metadata_like": len(texts) <= 1 and sum(len(text.strip()) for text in texts) < 4000,
        }
        for doc_id, texts in grouped.items()
    }


def enrich_rows(
    rows: list[dict[str, Any]],
    *,
    include_gemini: bool = False,
    reproduce: bool = True,
) -> list[dict[str, Any]]:
    manifest = manifest_by_id(load_manifest())
    enriched: list[dict[str, Any]] = []
    for row in rows:
        item = manifest.get(row["doc_id"])
        path = _resolve_local_path(item)
        file_exists = bool(path and path.is_file())
        reproductions = reproduce_extractors(item, include_gemini=include_gemini) if item and reproduce else []
        file_size = path.stat().st_size if file_exists and path else None
        sha256 = item.sha256 if item else None
        if item and not sha256 and path:
            sha256 = _sha256(path)
        enriched.append(
            {
                **row,
                "title": item.title if item else None,
                "manifest_status": item.status if item else "missing_manifest_record",
                "doi": item.doi if item else None,
                "url": item.url if item else None,
                "localPath": item.localPath if item else None,
                "file_exists": file_exists,
                "file_size": file_size,
                "sha256": sha256,
                "classification": classify_fallback(item, file_exists, reproductions),
                "extractors": [asdict(rep) | {"extracts_text": rep.extracts_text} for rep in reproductions],
            }
        )
    return enriched


def run_fallback_audit(
    *,
    log_path: Path = INGEST_LOG_PATH,
    top: int = 0,
    include_gemini: bool = False,
    reproduce: bool = True,
) -> dict[str, Any]:
    rows = ranked_fallback_docs(log_path=log_path)
    if top:
        rows = rows[:top]
    enriched = enrich_rows(rows, include_gemini=include_gemini, reproduce=reproduce)
    classifications = collections.Counter(row["classification"] for row in enriched)
    return {
        "log_path": str(log_path),
        "tracks": list(TRACKS),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fallback_docs": len(rows),
        "classifications": dict(classifications),
        "rows": enriched,
    }


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def write_report(payload: dict[str, Any], run_dir: Path) -> tuple[Path, Path]:
    run_dir.mkdir(parents=True, exist_ok=True)
    json_path = run_dir / "fallback-audit.json"
    md_path = run_dir / "fallback-audit.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Fallback Audit",
        "",
        f"- Log: `{payload['log_path']}`",
        f"- Generated: `{payload.get('generated_at', '')}`",
        f"- Fallback docs: {payload['fallback_docs']}",
        f"- Classifications: `{json.dumps(payload['classifications'], sort_keys=True)}`",
        "",
        "| Rank | Doc | Qrels | Class | Status | File | Best local extractor | Reason |",
        "| ---: | --- | ---: | --- | --- | --- | --- | --- |",
    ]
    for idx, row in enumerate(payload["rows"], start=1):
        file_note = "yes" if row["file_exists"] else "no"
        best = max(row.get("extractors", []), key=lambda rep: rep.get("text_chars", 0), default={})
        best_note = (
            f"{best.get('backend')}:{best.get('text_chars', 0)} chars"
            if best
            else "not reproduced"
        )
        lines.append(
            f"| {idx} | `{row['doc_id']}` | {row['qrel_placements']} | "
            f"`{row['classification']}` | `{row['manifest_status']}` | {file_note} | "
            f"`{best_note}` | `{row['fallback_reason']}` |"
        )
    if payload.get("repair"):
        repair = payload["repair"]
        lines.extend(
            [
                "",
                "## Repair",
                "",
                f"- Embed profile: `{repair.get('embed_profile')}`",
                f"- PDF backend: `{repair.get('pdf_backend')}`",
                f"- Doc ids: `{', '.join(repair.get('doc_ids') or [])}`",
                f"- Cache invalidations: `{json.dumps(repair.get('cache_invalidations', {}), sort_keys=True)}`",
            ]
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, md_path


def invalidate_repair_caches(rows: list[dict[str, Any]], *, pdf_backend: str, embed_profile: str) -> dict[str, Any]:
    from rag_literature_rag.ingest.extract_cache import invalidate

    options = extraction_cache_options(pdf_backend)
    out: dict[str, Any] = {}
    for row in rows:
        sha256 = row.get("sha256") or ""
        out[row["doc_id"]] = invalidate(
            sha256,
            pdf_backend,
            chunk_profiles=(None, embed_profile),
            options=options,
        )
    return out


@click.command("fallback-audit")
@click.option("--log-path", type=click.Path(path_type=Path, exists=True), default=INGEST_LOG_PATH)
@click.option("--top", default=0, show_default=True, type=click.IntRange(min=0), help="Limit rows; 0 = all.")
@click.option("--include-gemini", is_flag=True, help="Also try Gemini vision extraction; can incur cloud cost.")
@click.option("--no-reproduce", is_flag=True, help="Skip extractor reproduction.")
@click.option("--repair", is_flag=True, help="Re-ingest locally repairable docs only.")
@click.option("--embed-profile", default="cuda-qwen0.6b-1024", show_default=True)
@click.option("--pdf-backend", type=click.Choice(["pymupdf", "docling"]), default="docling", show_default=True)
@click.option("--json", "as_json", is_flag=True, help="Print JSON to stdout.")
def fallback_audit_cmd(
    log_path: Path,
    top: int,
    include_gemini: bool,
    no_reproduce: bool,
    repair: bool,
    embed_profile: str,
    pdf_backend: str,
    as_json: bool,
) -> None:
    """Rank and classify qrel-heavy extraction fallback documents."""
    payload = run_fallback_audit(
        log_path=log_path,
        top=top,
        include_gemini=include_gemini,
        reproduce=not no_reproduce,
    )
    run_dir = DATA_DIR / "eval" / "runs" / f"{_timestamp()}-fallback-repair"
    json_path, md_path = write_report(payload, run_dir)
    if repair:
        repair_rows = [
            row
            for row in payload["rows"]
            if row["classification"] == "repairable_local_extraction"
        ]
        repair_ids = [row["doc_id"] for row in repair_rows]
        before_index = index_doc_stats(repair_ids, embed_profile=embed_profile)
        cache_invalidations = invalidate_repair_caches(
            repair_rows,
            pdf_backend=pdf_backend,
            embed_profile=embed_profile,
        )
        payload["repair"] = {
            "doc_ids": repair_ids,
            "embed_profile": embed_profile,
            "pdf_backend": pdf_backend,
            "chunking_fingerprint": chunking_fingerprint(embed_profile),
            "before_index": before_index,
            "cache_invalidations": cache_invalidations,
        }
        json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        if repair_ids:
            from rag_literature_rag.ingest.run import _execute_ingest

            _execute_ingest(
                force=True,
                rebuild=False,
                verbose=True,
                log_file=str(run_dir / "repair-ingest.log"),
                embed_profile=embed_profile,
                pdf_backend=pdf_backend,
                doc_ids=tuple(repair_ids),
            )
            payload["repair"]["after_index"] = index_doc_stats(repair_ids, embed_profile=embed_profile)
            payload["repair"]["after_audit"] = run_fallback_audit(
                log_path=Path(run_dir / "repair-ingest.log"),
                top=0,
                include_gemini=False,
                reproduce=False,
            )
            write_report(payload, run_dir)
    if as_json:
        click.echo(json.dumps(payload, indent=2))
    else:
        click.echo(f"Wrote {json_path}")
        click.echo(f"Report: {md_path}")
