from __future__ import annotations

import logging
import os
import queue
import sys
import threading
import time
from concurrent.futures import FIRST_COMPLETED, Future, ProcessPoolExecutor, wait
from dataclasses import dataclass
from typing import Iterable, Iterator, Literal

import click

from rag_literature_rag.catalog.classify import classify_item
from rag_literature_rag.ingest.canonical import IngestDocument, canonical_ingest_projection
from rag_literature_rag.ingest.chunk import (
    TextChunk,
    chunk_metadata,
    chunk_pages,
    chunking_fingerprint,
)
from rag_literature_rag.ingest.embed import EmbedStats, prepare_embed_config, resolve_workers
from rag_common.config import local_embed_quant, mlx_q4_model_id, use_mlx_q4_embed
from rag_literature_rag.ingest.extract import (
    default_pdf_backend,
    extract_metadata_text,
    extract_pdf_pages,
)
from rag_literature_rag.ingest.index import (
    chunk_count,
    chunking_fingerprint_mismatch,
    clear_doc_entries,
    doc_sha256,
    embed_config_mismatch,
    load_ingest_state,
    pdf_backend_mismatch,
    save_ingest_state,
    update_ingest_metadata,
    upsert_chunks,
    IndexPhaseStats,
)
from rag_literature_rag.ingest.log import setup_ingest_logging
from rag_literature_rag.manifest import ManifestItem, load_manifest
from rag_literature_rag.paths import PKG_ROOT, profile_index_paths
from rag_literature_rag.ingest.status import (
    format_duration,
    ingest_status_cmd,
    load_status,
    new_run_status,
    now_iso,
    progress,
    refresh_progress_estimate,
    write_status,
)


def _ingest_doc_batch() -> int:
    return int(os.getenv("RAG_LIT_INGEST_DOC_BATCH", "25"))


def _extract_queue_docs(doc_batch: int | None = None) -> int:
    default = 2 * (doc_batch if doc_batch is not None else _ingest_doc_batch())
    raw = os.getenv("RAG_LIT_EXTRACT_QUEUE_DOCS", str(default))
    try:
        return max(1, int(raw))
    except ValueError:
        logging.getLogger("rag_literature_rag.ingest").warning(
            "invalid RAG_LIT_EXTRACT_QUEUE_DOCS=%r; using %d", raw, default
        )
        return default


def _scan_log_every() -> int:
    return int(os.getenv("RAG_LIT_INGEST_SCAN_LOG_EVERY", "100"))


def _progress_log_every() -> int:
    return max(1, int(os.getenv("RAG_LIT_INGEST_PROGRESS_LOG_EVERY", "25")))


def _progress_log_interval_s() -> float:
    return max(1.0, float(os.getenv("RAG_LIT_INGEST_PROGRESS_LOG_INTERVAL_S", "30")))


def _extract_workers() -> int:
    raw = os.getenv("RAG_LIT_EXTRACT_WORKERS", "4")
    try:
        return max(0, int(raw))
    except ValueError:
        logging.getLogger("rag_literature_rag.ingest").warning(
            "invalid RAG_LIT_EXTRACT_WORKERS=%r; using 4", raw
        )
        return 4


def _ensure_pdf_backend_available(pdf_backend: str) -> None:
    if pdf_backend != "docling":
        return
    try:
        from docling.document_converter import DocumentConverter  # noqa: F401
    except ImportError as exc:
        raise click.ClickException(
            "RAG_LIT_PDF_BACKEND=docling but docling is not installed. "
            "Run: uv sync --extra docling"
        ) from exc


@dataclass
class ExtractionTask:
    item: ManifestItem
    pdf_backend: str
    pipeline_categories: list[str]
    aliases: list[ManifestItem] | None = None


@dataclass
class ExtractionOutcome:
    item: ManifestItem
    chunks: list[TextChunk]
    aliases: list[ManifestItem] | None = None
    reason: str | None = None
    error: str | None = None
    elapsed_seconds: float | None = None


@dataclass
class ItemDecision:
    kind: Literal["skip", "metadata", "pdf"]
    item: ManifestItem
    pipeline_categories: list[str]
    reason: str | None = None


@dataclass
class ExtractionPipelineTelemetry:
    queue_capacity: int
    documents_extracted: int = 0
    documents_queued: int = 0
    extraction_seconds: float = 0.0
    backpressure_seconds: float = 0.0
    backpressure_blocked: bool = False
    max_queue_depth: int = 0
    producer_done: bool = False


@dataclass
class ProducerFailure:
    error: BaseException


def _classify_ingest_item(
    item: ManifestItem,
    *,
    force: bool,
    state: dict,
) -> ItemDecision:
    """Classify manifest work on the parent process with an explicit skip reason."""
    pipeline_cats, _ = classify_item(item)
    if item.status == "ok" and item.localPath:
        if not (PKG_ROOT / item.localPath).is_file():
            return ItemDecision("skip", item, pipeline_cats, "missing_pdf")
        if not force and item.sha256 and doc_sha256(state, item.id) == item.sha256:
            return ItemDecision("skip", item, pipeline_cats, "unchanged")
        return ItemDecision("pdf", item, pipeline_cats)

    if item.status == "metadata_only":
        if not force and item.id in state:
            return ItemDecision("skip", item, pipeline_cats, "unchanged_metadata")
        return ItemDecision("metadata", item, pipeline_cats)

    return ItemDecision("skip", item, pipeline_cats, f"status:{item.status}")


def _metadata_outcome(
    item: ManifestItem,
    pipeline_categories: list[str],
    *,
    reason: str | None = None,
    error: str | None = None,
    aliases: list[ManifestItem] | None = None,
) -> ExtractionOutcome:
    chunks = chunk_metadata(
        item,
        extract_metadata_text(item),
        pipeline_categories=pipeline_categories,
        alias_doc_ids=sorted(item.id for item in aliases or []),
        alias_source_urls=sorted({value.url for value in aliases or [] if value.url}),
        alias_dois=sorted({value.doi for value in aliases or [] if value.doi}),
    )
    return ExtractionOutcome(item, chunks, aliases=aliases, reason=reason, error=error)


def _extract_pdf_task(task: ExtractionTask) -> ExtractionOutcome:
    """Extract and chunk one PDF. This top-level worker is process-pool picklable."""
    from rag_literature_rag.ingest.extract_cache import get as cache_get, put as cache_put

    started = time.monotonic()
    aliases = task.aliases or []
    sha256 = task.item.sha256 or ""

    # Cache hit: skip Docling/MuPDF entirely
    cached = cache_get(sha256, task.pdf_backend) if sha256 else None
    if cached is not None:
        return ExtractionOutcome(
            task.item,
            cached,
            aliases=aliases,
            elapsed_seconds=time.monotonic() - started,
            reason="cache_hit",
        )

    pages = extract_pdf_pages(task.item, backend=task.pdf_backend)
    if pages:
        chunks = chunk_pages(
            task.item,
            pages,
            pipeline_categories=task.pipeline_categories,
            alias_doc_ids=sorted(item.id for item in aliases),
            alias_source_urls=sorted({item.url for item in aliases if item.url}),
            alias_dois=sorted({item.doi for item in aliases if item.doi}),
            canonical_sha256=sha256,
        )
        if sha256:
            cache_put(sha256, task.pdf_backend, chunks)
        return ExtractionOutcome(
            task.item,
            chunks,
            aliases=aliases,
            elapsed_seconds=time.monotonic() - started,
        )
    outcome = _metadata_outcome(
        task.item,
        task.pipeline_categories,
        reason="empty_pdf_metadata_fallback",
        aliases=aliases,
    )
    outcome.elapsed_seconds = time.monotonic() - started
    return outcome


def _future_outcome(future: Future[ExtractionOutcome], task: ExtractionTask) -> ExtractionOutcome:
    try:
        return future.result()
    except Exception as exc:  # noqa: BLE001 - a bad document must not abort ingest
        return _metadata_outcome(
            task.item,
            task.pipeline_categories,
            reason="worker_error_metadata_fallback",
            error=str(exc),
            aliases=task.aliases,
        )


def _drain_one(
    pending: dict[Future[ExtractionOutcome], ExtractionTask],
    stop_event: threading.Event | None = None,
) -> Iterator[ExtractionOutcome]:
    if stop_event is None:
        done, _ = wait(pending, return_when=FIRST_COMPLETED)
    else:
        done, _ = wait(pending, timeout=0.1, return_when=FIRST_COMPLETED)
    for future in done:
        task = pending.pop(future)
        yield _future_outcome(future, task)


def _iter_extraction_outcomes(
    items: Iterable[IngestDocument],
    *,
    force: bool,
    state: dict,
    pdf_backend: str,
    extract_workers: int,
    stop_event: threading.Event | None = None,
) -> Iterator[ExtractionOutcome]:
    """Yield inline metadata and bounded, out-of-order PDF extraction outcomes."""
    use_pool = pdf_backend in {"docling", "pymupdf"} and extract_workers > 1
    max_pending = max(2 * extract_workers, 2)

    if not use_pool:
        for raw_document in items:
            if stop_event is not None and stop_event.is_set():
                return
            document = raw_document if isinstance(raw_document, IngestDocument) else IngestDocument(raw_document)
            item = document.item
            decision = _classify_ingest_item(item, force=force, state=state)
            if decision.kind == "skip":
                yield ExtractionOutcome(item, [], reason=decision.reason)
            elif decision.kind == "metadata":
                yield _metadata_outcome(item, decision.pipeline_categories)
            else:
                task = ExtractionTask(item, pdf_backend, decision.pipeline_categories, document.aliases)
                try:
                    yield _extract_pdf_task(task)
                except Exception as exc:  # noqa: BLE001
                    yield _metadata_outcome(
                        item,
                        decision.pipeline_categories,
                        reason="extraction_error_metadata_fallback",
                        error=str(exc),
                        aliases=document.aliases,
                    )
        return

    pending: dict[Future[ExtractionOutcome], ExtractionTask] = {}
    executor = ProcessPoolExecutor(max_workers=extract_workers)
    try:
        for raw_document in items:
            if stop_event is not None and stop_event.is_set():
                break
            document = raw_document if isinstance(raw_document, IngestDocument) else IngestDocument(raw_document)
            item = document.item
            decision = _classify_ingest_item(item, force=force, state=state)
            if decision.kind == "skip":
                yield ExtractionOutcome(item, [], reason=decision.reason)
            elif decision.kind == "metadata":
                yield _metadata_outcome(item, decision.pipeline_categories)
            else:
                task = ExtractionTask(item, pdf_backend, decision.pipeline_categories, document.aliases)
                pending[executor.submit(_extract_pdf_task, task)] = task
                if len(pending) >= max_pending:
                    yield from _drain_one(pending, stop_event)

        while pending and not (stop_event is not None and stop_event.is_set()):
            yield from _drain_one(pending, stop_event)
    finally:
        interrupted = stop_event is not None and stop_event.is_set()
        for future in pending:
            future.cancel()
        executor.shutdown(wait=not interrupted, cancel_futures=True)


def _iter_queued_extraction_outcomes(
    items: Iterable[IngestDocument],
    *,
    force: bool,
    state: dict,
    pdf_backend: str,
    extract_workers: int,
    queue_capacity: int,
    telemetry: ExtractionPipelineTelemetry,
    log: logging.Logger,
) -> Iterator[ExtractionOutcome]:
    """Run extraction in a producer thread and yield its bounded queued outcomes."""
    outcome_queue: queue.Queue[ExtractionOutcome | ProducerFailure | object] = queue.Queue(
        maxsize=queue_capacity
    )
    stop_event = threading.Event()
    done = object()
    full_warning_at = 0.0

    def put(value: ExtractionOutcome | ProducerFailure | object) -> bool:
        nonlocal full_warning_at
        blocked_started: float | None = None
        while not stop_event.is_set():
            try:
                outcome_queue.put(value, timeout=0.1)
                if blocked_started is not None:
                    telemetry.backpressure_seconds += time.monotonic() - blocked_started
                telemetry.backpressure_blocked = False
                telemetry.max_queue_depth = max(
                    telemetry.max_queue_depth, outcome_queue.qsize()
                )
                return True
            except queue.Full:
                if blocked_started is None:
                    blocked_started = time.monotonic()
                telemetry.backpressure_blocked = True
                now = time.monotonic()
                if now - full_warning_at >= 30:
                    log.warning(
                        "extraction queue full depth=%d capacity=%d; producer blocked by backpressure",
                        outcome_queue.qsize(),
                        queue_capacity,
                    )
                    full_warning_at = now
        return False

    def produce() -> None:
        started = time.monotonic()
        try:
            for outcome in _iter_extraction_outcomes(
                items,
                force=force,
                state=state,
                pdf_backend=pdf_backend,
                extract_workers=extract_workers,
                stop_event=stop_event,
            ):
                telemetry.documents_extracted += 1
                if not put(outcome):
                    return
                telemetry.documents_queued += 1
        except BaseException as exc:  # propagate infrastructure failures to the main thread
            put(ProducerFailure(exc))
        finally:
            telemetry.extraction_seconds = time.monotonic() - started
            telemetry.producer_done = True
            put(done)

    producer = threading.Thread(target=produce, name="graph-rag-extract", daemon=True)
    producer.start()
    try:
        while True:
            value = outcome_queue.get()
            if value is done:
                break
            if isinstance(value, ProducerFailure):
                raise value.error
            yield value
    finally:
        stop_event.set()
        producer.join(timeout=5)
        if producer.is_alive():
            log.warning("extraction producer did not stop within 5s; shutdown continues")



def _mark_item_ingested(item: ManifestItem, state: dict) -> None:
    if item.sha256:
        state[item.id] = item.sha256
    elif item.status == "metadata_only":
        state[item.id] = item.sha256 or f"meta:{item.id}"


def _mark_outcome_ingested(outcome: ExtractionOutcome, state: dict) -> None:
    _mark_item_ingested(outcome.item, state)
    for alias in outcome.aliases or []:
        state[alias.id] = alias.sha256 or outcome.item.sha256 or f"alias:{outcome.item.id}"


def _execute_ingest(
    *,
    force: bool,
    rebuild: bool,
    verbose: bool,
    log_file: str | None,
    embed_profile: str | None,
    pdf_backend: str | None = None,
) -> None:
    from pathlib import Path

    log = setup_ingest_logging(
        log_file=Path(log_file) if log_file else None,
        verbose=verbose,
    )
    t_start = time.monotonic()

    pdf_backend = pdf_backend or default_pdf_backend()
    _ensure_pdf_backend_available(pdf_backend)
    manifest = load_manifest()
    projection = canonical_ingest_projection(manifest.items)
    cfg = prepare_embed_config(profile=embed_profile)
    index_slug = cfg.profile or profile_index_paths(embed_profile).profile
    index_paths = profile_index_paths(index_slug)
    state = load_ingest_state(index_paths)
    stats = EmbedStats()
    fingerprint = chunking_fingerprint()

    if rebuild:
        clear_doc_entries(state)

    ok_count = sum(1 for i in manifest.items if i.status == "ok")
    meta_count = sum(1 for i in manifest.items if i.status == "metadata_only")
    log.info(
        "ingest start manifest=%d (ok=%d metadata_only=%d) force=%s rebuild=%s index=%s",
        len(manifest.items),
        ok_count,
        meta_count,
        force,
        rebuild,
        index_paths.root,
    )

    if embed_config_mismatch(state, cfg) and not rebuild:
        log.warning(
            "embed model/dims changed for profile %s (%s/%s → %s/%s); auto-enabling rebuild",
            index_slug,
            state.get("embed_backend"),
            state.get("embed_model"),
            cfg.backend,
            cfg.model,
        )
        click.echo(
            f"Embed config changed for profile {index_slug!r}; auto-enabling --rebuild.",
            err=True,
        )
        rebuild = True
        force = True

    if pdf_backend_mismatch(state, pdf_backend) and not rebuild:
        log.warning(
            "pdf backend changed for profile %s (%s → %s); auto-enabling rebuild",
            index_slug,
            state.get("pdf_backend"),
            pdf_backend,
        )
        click.echo(
            f"PDF backend changed for profile {index_slug!r} "
            f"({state.get('pdf_backend')} → {pdf_backend}); auto-enabling --rebuild.",
            err=True,
        )
        clear_doc_entries(state)
        rebuild = True
        force = True

    if chunking_fingerprint_mismatch(state, fingerprint) and not rebuild:
        log.warning("chunking fingerprint changed for profile %s; auto-enabling rebuild", index_slug)
        click.echo(f"Chunking fingerprint changed for profile {index_slug!r}; auto-enabling --rebuild.", err=True)
        clear_doc_entries(state)
        rebuild = True
        force = True

    default_workers = (
        "48" if cfg.backend == "gemini" else ("2" if cfg.backend == "openai" else "4")
    )
    workers = resolve_workers(
        int(os.getenv("RAG_LIT_WORKERS", default_workers)),
        prefix="RAG_LIT_",
    )
    doc_batch = _ingest_doc_batch()
    scan_every = _scan_log_every()
    progress_every = _progress_log_every()
    progress_interval_s = _progress_log_interval_s()
    extract_workers = _extract_workers()
    extract_queue_docs = _extract_queue_docs(doc_batch)
    pipeline_telemetry = ExtractionPipelineTelemetry(extract_queue_docs)
    index_phase_stats = IndexPhaseStats()
    run_status = new_run_status(
        paths=index_paths,
        backend=cfg.backend,
        model=cfg.model,
        dimensions=cfg.dimensions,
        fingerprint=fingerprint,
        embed_workers=workers,
        extract_workers=extract_workers,
    )
    run_status["aliases_skipped"] = sum(len(document.aliases) for document in projection)
    run_status["manifest_items_total"] = len(manifest.items)
    run_status["canonical_documents_total"] = len(projection)
    run_status["documents_remaining"] = len(projection)
    run_status["extract_queue_capacity"] = extract_queue_docs
    write_status(run_status, index_paths)

    quant = local_embed_quant(cfg)
    quant_note = ""
    if cfg.backend == "local" and use_mlx_q4_embed(cfg.model, cfg):
        quant_note = f" quant=4bit mlx={mlx_q4_model_id(cfg.model)}"
    elif quant:
        quant_note = f" quant={quant}"
    profile_note = f" profile={cfg.profile}" if cfg.profile else ""

    msg = (
        f"Embedding backend={cfg.backend} model={cfg.model} dims={cfg.dimensions}"
        f"{profile_note}{quant_note} workers={workers} doc_batch={doc_batch} "
        f"pdf_backend={pdf_backend} extract_workers={extract_workers} "
        f"extract_queue_docs={extract_queue_docs} "
        f"documents={len(projection)} aliases={run_status['aliases_skipped']} "
        f"progress_every={progress_every} progress_interval_s={progress_interval_s:g} "
        f"index_dir={index_paths.root}"
    )
    log.info(msg)
    click.echo(msg, err=True)

    ingested = 0
    skipped = 0
    missing = 0
    written = 0
    batch_chunks: list[TextChunk] = []
    batch_outcomes: list[ExtractionOutcome] = []
    docs_in_batch = 0
    rebuild_table = rebuild
    scanned = 0
    last_progress_log_at = t_start

    def report_progress(*, phase: str, force_log: bool = False) -> None:
        nonlocal last_progress_log_at
        now = time.monotonic()
        completed = int(run_status["documents_indexed"]) + skipped + missing
        run_status["documents_processed"] = scanned
        refresh_progress_estimate(
            run_status,
            completed=completed,
            total=len(projection),
            started_monotonic=t_start,
            phase=phase,
            now_monotonic=now,
        )
        run_status["documents_extracted"] = pipeline_telemetry.documents_extracted
        run_status["documents_queued"] = pipeline_telemetry.documents_queued
        run_status["extract_queue_depth"] = min(
            extract_queue_docs,
            max(0, pipeline_telemetry.documents_queued - scanned),
        )
        run_status["extract_queue_max_depth"] = pipeline_telemetry.max_queue_depth
        run_status["extract_backpressure_blocked"] = pipeline_telemetry.backpressure_blocked
        run_status["extract_backpressure_seconds"] = round(
            pipeline_telemetry.backpressure_seconds, 2
        )
        run_status["extraction_seconds"] = round(pipeline_telemetry.extraction_seconds, 2)
        run_status["embedding_seconds"] = round(index_phase_stats.embedding_seconds, 2)
        run_status["lancedb_seconds"] = round(index_phase_stats.lancedb_seconds, 2)
        run_status["bm25_seconds"] = round(index_phase_stats.bm25_seconds, 2)
        run_status["indexing_seconds"] = round(
            index_phase_stats.lancedb_seconds + index_phase_stats.bm25_seconds, 2
        )
        run_status["total_throughput_documents_per_second"] = run_status[
            "documents_per_second"
        ]
        if pipeline_telemetry.extraction_seconds:
            run_status["extraction_throughput_documents_per_second"] = round(
                pipeline_telemetry.documents_extracted / pipeline_telemetry.extraction_seconds,
                4,
            )
        chunks_written = int(run_status["chunks_written"])
        if index_phase_stats.embedding_seconds:
            run_status["embedding_throughput_chunks_per_second"] = round(
                chunks_written / index_phase_stats.embedding_seconds, 4
            )
        if index_phase_stats.lancedb_seconds:
            run_status["lancedb_throughput_rows_per_second"] = round(
                chunks_written / index_phase_stats.lancedb_seconds, 4
            )
        if index_phase_stats.bm25_seconds:
            run_status["bm25_throughput_rows_per_second"] = round(
                chunks_written / index_phase_stats.bm25_seconds, 4
            )
        if cfg.backend == "gemini":
            from rag_common.gemini_rate_limit import get_rate_limiter

            run_status["gemini_limiter"] = get_rate_limiter().snapshot()
        should_log = (
            force_log
            or (scanned > 0 and scanned % progress_every == 0)
            or now - last_progress_log_at >= progress_interval_s
        )
        if should_log:
            log.info(
                "progress phase=%s processed=%d/%d completed=%d/%d (%.1f%%) indexed=%d "
                "chunks=%d queued_batch_docs=%d queued_batch_chunks=%d "
                "rate=%.2f docs/min elapsed=%s eta=%s skipped=%d missing=%d "
                "fallbacks=%d errors=%d",
                phase,
                scanned,
                len(projection),
                completed,
                len(projection),
                run_status["progress_percent"],
                run_status["documents_indexed"],
                run_status["chunks_written"],
                docs_in_batch,
                len(batch_chunks),
                run_status["documents_per_second"] * 60,
                format_duration(run_status["elapsed_seconds"]),
                format_duration(run_status["eta_seconds"]),
                skipped,
                missing,
                run_status["fallbacks"],
                run_status["errors"],
            )
            last_progress_log_at = now
        write_status(run_status, index_paths)

    def flush_batch() -> None:
        nonlocal written, rebuild_table, batch_chunks, batch_outcomes, docs_in_batch
        if not batch_chunks:
            docs_in_batch = 0
            batch_outcomes = []
            return
        batch_started = time.monotonic()
        run_status["current_batch_documents"] = docs_in_batch
        run_status["current_batch_chunks"] = len(batch_chunks)
        run_status["documents_embedding"] = docs_in_batch
        if (
            cfg.backend == "gemini"
            and pipeline_telemetry.documents_queued <= scanned
            and not pipeline_telemetry.producer_done
        ):
            log.warning(
                "Gemini embedding workers may be starved by extraction: queue depth=0"
            )
        report_progress(phase="embedding_and_indexing", force_log=True)
        log.info(
            "batch start documents=%d chunks=%d indexed_documents=%d chunks_written=%d",
            docs_in_batch,
            len(batch_chunks),
            run_status["documents_indexed"],
            written,
        )
        written += upsert_chunks(
            batch_chunks,
            rebuild=rebuild_table,
            config=cfg,
            stats=stats,
            workers=workers,
            profile=index_paths,
            phase_stats=index_phase_stats,
        )
        for outcome in batch_outcomes:
            _mark_outcome_ingested(outcome, state)
        state["pdf_backend"] = pdf_backend
        state["chunking_fingerprint"] = fingerprint
        if rebuild_table:
            rebuild_table = False
        save_ingest_state(state, index_paths)
        progress(
            run_status,
            chunks_written=len(batch_chunks),
            checkpoint_count=1,
            estimated_embedding_tokens=max(0, stats.tokens - int(run_status["estimated_embedding_tokens"])),
            documents_indexed=docs_in_batch,
            documents_checkpointed=docs_in_batch,
        )
        run_status["estimated_cost_usd"] = state.get("estimated_cost_usd", 0.0)
        batch_elapsed = time.monotonic() - batch_started
        run_status["last_batch_seconds"] = round(batch_elapsed, 1)
        run_status["last_batch_documents"] = docs_in_batch
        run_status["last_batch_chunks"] = len(batch_chunks)
        run_status["last_batch_chunks_per_second"] = round(
            len(batch_chunks) / batch_elapsed if batch_elapsed else 0.0,
            3,
        )
        log.info(
            "batch done documents=%d chunks=%d elapsed=%s chunks_per_second=%.2f "
            "total_indexed_documents=%d total_chunks_written=%d tokens=%d checkpoints=%d",
            docs_in_batch,
            len(batch_chunks),
            format_duration(batch_elapsed),
            run_status["last_batch_chunks_per_second"],
            run_status["documents_indexed"],
            written,
            stats.tokens,
            run_status["checkpoint_count"],
        )
        batch_chunks = []
        batch_outcomes = []
        docs_in_batch = 0
        run_status["current_batch_documents"] = 0
        run_status["current_batch_chunks"] = 0
        run_status["documents_embedding"] = 0
        report_progress(phase="extracting", force_log=True)

    report_progress(phase="extracting", force_log=True)
    for outcome in _iter_queued_extraction_outcomes(
        projection,
        force=force,
        state=state,
        pdf_backend=pdf_backend,
        extract_workers=extract_workers,
        queue_capacity=extract_queue_docs,
        telemetry=pipeline_telemetry,
        log=log,
    ):
        item = outcome.item
        scanned += 1
        run_status["last_document_id"] = item.id
        run_status["last_document_status"] = item.status
        run_status["last_document_reason"] = outcome.reason or "ok"
        run_status["last_document_chunks"] = len(outcome.chunks)
        run_status["last_document_extraction_seconds"] = (
            round(outcome.elapsed_seconds, 2) if outcome.elapsed_seconds is not None else None
        )
        progress(run_status, manifest_items_scanned=1 + len(outcome.aliases or []))
        if scanned % scan_every == 0:
            log.debug("scan checkpoint documents=%d/%d", scanned, len(projection))

        if outcome.error:
            log.error(
                "PDF extraction failed for %s (%s); using metadata fallback: %s",
                item.id,
                item.localPath,
                outcome.error,
            )
        if outcome.reason == "missing_pdf":
            missing += 1
            progress(run_status, missing_pdfs=1)
            write_status(run_status, index_paths)
            log.warning("skip missing PDF: %s (%s)", item.id, item.localPath)
            report_progress(phase="extracting")
            continue
        if not outcome.chunks:
            skipped += 1
            log.debug("skip %s: %s", item.id, outcome.reason)
            report_progress(phase="extracting")
            continue

        chunks = outcome.chunks
        if not chunks:
            continue

        batch_chunks.extend(chunks)
        batch_outcomes.append(outcome)
        ingested += 1
        docs_in_batch += 1
        if item.status == "ok":
            progress(run_status, canonical_pdfs_completed=1)
        else:
            progress(run_status, metadata_documents_completed=1)
        if outcome.reason and "fallback" in outcome.reason:
            progress(run_status, fallbacks=1)
        if outcome.error:
            progress(run_status, errors=1)
        log.debug(
            "extracted document=%s status=%s chunks=%d reason=%s extraction_s=%s "
            "batch_documents=%d/%d",
            item.id,
            item.status,
            len(chunks),
            outcome.reason or "ok",
            f"{outcome.elapsed_seconds:.2f}" if outcome.elapsed_seconds is not None else "n/a",
            docs_in_batch,
            doc_batch,
        )
        report_progress(phase="extracting")

        if docs_in_batch >= doc_batch:
            flush_batch()

    flush_batch()

    effective = stats.effective_config or cfg
    if written or stats.tokens:
        update_ingest_metadata(
            state, config=effective, run_tokens=stats.tokens, pdf_backend=pdf_backend
        )

    save_ingest_state(state, index_paths)
    run_status["status"] = "completed"
    run_status["phase"] = "completed"
    run_status["completed_at"] = now_iso()
    run_status["estimated_embedding_tokens"] = stats.tokens
    run_status["estimated_cost_usd"] = state.get("estimated_cost_usd", 0.0)
    refresh_progress_estimate(
        run_status,
        completed=len(projection),
        total=len(projection),
        started_monotonic=t_start,
        phase="completed",
    )
    write_status(run_status, index_paths)
    total = chunk_count(index_paths)
    elapsed = time.monotonic() - t_start
    cost_note = ""
    if stats.tokens and effective.is_remote:
        from rag_common.config import embed_cost_per_million

        run_cost = (stats.tokens / 1_000_000) * embed_cost_per_million(effective.backend)
        cost_note = f" Embed: {stats.tokens} tokens (~${run_cost:.4f})."
    summary = (
        f"Ingested {ingested} docs ({written} new chunks written, {skipped} skipped"
        f"{f', {missing} missing PDFs' if missing else ''}). "
        f"Backend: {effective.backend}. "
        f"Index total: {total} chunks.{cost_note}"
    )
    log.info(
        "ingest done in %.1fs — %d docs, %d chunks written, %d skipped, %d missing, index=%d",
        elapsed,
        ingested,
        written,
        skipped,
        missing,
        total,
    )
    click.echo(summary)


def ingest_options(f):
    f = click.option("--force", is_flag=True, help="Re-ingest all documents regardless of sha256.")(f)
    f = click.option("--rebuild", is_flag=True, help="Drop and recreate the LanceDB table.")(f)
    f = click.option(
        "--embed-profile",
        default=None,
        help="Named embed profile (overrides RAG_EMBED_PROFILE / RAG_LIT_EMBED_PROFILE).",
    )(f)
    f = click.option(
        "--pdf-backend",
        type=click.Choice(["pymupdf", "docling", "gemini"]),
        default=None,
        help="PDF extraction backend (default RAG_LIT_PDF_BACKEND or pymupdf). "
        "'gemini' makes one vision API call per page (cost). "
        "Changing this requires --force --rebuild.",
    )(f)
    f = click.option("-v", "--verbose", is_flag=True, help="Debug logging to console.")(f)
    f = click.option(
        "--log-file",
        default=None,
        help="Log file path (default: data/ingest.log).",
    )(f)
    return f


@click.group(invoke_without_command=True)
@ingest_options
@click.pass_context
def ingest_group(
    ctx: click.Context,
    force: bool,
    rebuild: bool,
    embed_profile: str | None,
    pdf_backend: str | None,
    verbose: bool,
    log_file: str | None,
) -> None:
    """Extract, chunk, embed, and index manifest documents."""
    if ctx.invoked_subcommand is None:
        try:
            _execute_ingest(
                force=force,
                rebuild=rebuild,
                verbose=verbose,
                log_file=log_file,
                embed_profile=embed_profile,
                pdf_backend=pdf_backend,
            )
        except BaseException:
            status = load_status(embed_profile)
            if status.get("status") == "running":
                status["status"] = "interrupted" if isinstance(sys.exc_info()[1], KeyboardInterrupt) else "failed"
                status["finished_at"] = now_iso()
                write_status(status, embed_profile)
            raise


from rag_literature_rag.ingest.check_pdfs import check_pdfs_cmd  # noqa: E402
from rag_literature_rag.ingest.compare_extract import compare_extract_cmd  # noqa: E402

ingest_group.add_command(check_pdfs_cmd, name="check-pdfs")
ingest_group.add_command(compare_extract_cmd, name="compare-extract")
ingest_group.add_command(ingest_status_cmd, name="status")

ingest_cmd = ingest_group
