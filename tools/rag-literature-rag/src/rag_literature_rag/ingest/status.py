from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import click

from rag_literature_rag.paths import ProfileIndexPaths, profile_index_paths


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_run_status(
    *,
    paths: ProfileIndexPaths,
    backend: str,
    model: str,
    dimensions: int,
    fingerprint: dict[str, object],
    embed_workers: int,
    extract_workers: int,
) -> dict[str, Any]:
    now = now_iso()
    return {
        "run_id": str(uuid.uuid4()),
        "pid": os.getpid(),
        "status": "running",
        "started_at": now,
        "last_progress_at": now,
        "phase": "initializing",
        "profile": paths.profile,
        "backend": backend,
        "model": model,
        "dimensions": dimensions,
        "chunking_fingerprint": fingerprint,
        "embed_workers": embed_workers,
        "extract_workers": extract_workers,
        "extract_queue_depth": 0,
        "extract_queue_capacity": 0,
        "extract_backpressure_blocked": False,
        "extract_backpressure_seconds": 0.0,
        "documents_extracted": 0,
        "documents_queued": 0,
        "documents_embedding": 0,
        "documents_checkpointed": 0,
        "extraction_seconds": 0.0,
        "embedding_seconds": 0.0,
        "lancedb_seconds": 0.0,
        "bm25_seconds": 0.0,
        "embed_cache_hits": 0,
        "embed_cache_misses": 0,
        "extract_cache": None,
        "embed_cache": None,
        "indexing_seconds": 0.0,
        "total_throughput_documents_per_second": 0.0,
        "extraction_throughput_documents_per_second": 0.0,
        "embedding_throughput_chunks_per_second": 0.0,
        "lancedb_throughput_rows_per_second": 0.0,
        "bm25_throughput_rows_per_second": 0.0,
        "gemini_limiter": None,
        "manifest_items_scanned": 0,
        "manifest_items_total": 0,
        "canonical_documents_total": 0,
        "documents_processed": 0,
        "documents_completed": 0,
        "documents_indexed": 0,
        "documents_remaining": 0,
        "progress_percent": 0.0,
        "elapsed_seconds": 0.0,
        "documents_per_second": 0.0,
        "eta_seconds": None,
        "eta_at": None,
        "last_document_id": None,
        "last_document_status": None,
        "last_document_reason": None,
        "last_document_chunks": 0,
        "last_document_extraction_seconds": None,
        "canonical_pdfs_completed": 0,
        "metadata_documents_completed": 0,
        "aliases_skipped": 0,
        "missing_pdfs": 0,
        "fallbacks": 0,
        "errors": 0,
        "chunks_written": 0,
        "checkpoint_count": 0,
        "estimated_embedding_tokens": 0,
        "estimated_cost_usd": 0.0,
    }


def write_status(status: dict[str, Any], profile: str | ProfileIndexPaths | None = None) -> None:
    paths = profile if isinstance(profile, ProfileIndexPaths) else profile_index_paths(profile)
    paths.root.mkdir(parents=True, exist_ok=True)
    status_path = paths.ingest_status or paths.root / "ingest_status.json"
    tmp = status_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, status_path)


def load_status(profile: str | ProfileIndexPaths | None = None) -> dict[str, Any]:
    paths = profile if isinstance(profile, ProfileIndexPaths) else profile_index_paths(profile)
    status_path = paths.ingest_status or paths.root / "ingest_status.json"
    if not status_path.is_file():
        return {"profile": paths.profile, "status": "not_started"}
    return json.loads(status_path.read_text(encoding="utf-8"))


def progress(status: dict[str, Any], **increments: int | float) -> None:
    for key, value in increments.items():
        status[key] = status.get(key, 0) + value
    status["last_progress_at"] = now_iso()


def refresh_progress_estimate(
    status: dict[str, Any],
    *,
    completed: int,
    total: int,
    started_monotonic: float,
    phase: str,
    now_monotonic: float | None = None,
) -> None:
    """Refresh blended run progress and ETA from fully completed canonical documents."""
    now = time.monotonic() if now_monotonic is None else now_monotonic
    elapsed = max(0.0, now - started_monotonic)
    remaining = max(0, total - completed)
    rate = completed / elapsed if completed and elapsed else 0.0
    eta_seconds = remaining / rate if rate else None

    status["phase"] = phase
    status["documents_completed"] = completed
    status["documents_remaining"] = remaining
    status["progress_percent"] = round((completed / total * 100) if total else 100.0, 2)
    status["elapsed_seconds"] = round(elapsed, 1)
    status["documents_per_second"] = round(rate, 4)
    status["eta_seconds"] = round(eta_seconds, 1) if eta_seconds is not None else None
    status["eta_at"] = (
        (datetime.now(timezone.utc) + timedelta(seconds=eta_seconds)).isoformat()
        if eta_seconds is not None
        else None
    )
    status["last_progress_at"] = now_iso()


def format_duration(seconds: float | int | None) -> str:
    if seconds is None:
        return "unknown"
    seconds = max(0, int(round(seconds)))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes:02d}m {seconds:02d}s"
    if minutes:
        return f"{minutes}m {seconds:02d}s"
    return f"{seconds}s"


@click.command("status")
@click.option("--embed-profile", default=None)
@click.option("--json", "as_json", is_flag=True)
def ingest_status_cmd(embed_profile: str | None, as_json: bool) -> None:
    """Show atomic telemetry for the latest ingest attempt."""
    status = load_status(embed_profile)
    if as_json:
        click.echo(json.dumps(status, indent=2))
        return
    click.echo(
        f"{status.get('profile')}: {status.get('status')} phase={status.get('phase', '-')} "
        f"progress={status.get('progress_percent', 0):.1f}% "
        f"documents={status.get('documents_processed', 0)}/"
        f"{status.get('canonical_documents_total', 0)} "
        f"completed={status.get('documents_completed', 0)} "
        f"indexed={status.get('documents_indexed', 0)} "
        f"chunks={status.get('chunks_written', 0)} "
        f"elapsed={format_duration(status.get('elapsed_seconds'))} "
        f"eta={format_duration(status.get('eta_seconds'))} "
        f"last_progress={status.get('last_progress_at', '-')}"
    )
