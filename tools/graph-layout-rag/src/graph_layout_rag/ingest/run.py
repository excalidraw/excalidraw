from __future__ import annotations

import os
import time

import click

from graph_layout_rag.catalog.classify import classify_item
from graph_layout_rag.ingest.chunk import TextChunk, chunk_metadata, chunk_pages
from graph_layout_rag.ingest.embed import EmbedStats, prepare_embed_config, resolve_workers
from rag_common.config import local_embed_quant, mlx_q4_model_id, use_mlx_q4_embed
from graph_layout_rag.ingest.extract import extract_metadata_text, extract_pdf_pages
from graph_layout_rag.ingest.index import (
    chunk_count,
    doc_sha256,
    embed_config_mismatch,
    load_ingest_state,
    save_ingest_state,
    update_ingest_metadata,
    upsert_chunks,
)
from graph_layout_rag.ingest.log import get_logger, setup_ingest_logging
from graph_layout_rag.manifest import ManifestItem, load_manifest
from graph_layout_rag.paths import PKG_ROOT, profile_index_paths

def _ingest_doc_batch() -> int:
    return int(os.getenv("GRAPH_RAG_INGEST_DOC_BATCH", "50"))


def _scan_log_every() -> int:
    return int(os.getenv("GRAPH_RAG_INGEST_SCAN_LOG_EVERY", "100"))


def _extract_item_chunks(
    item: ManifestItem,
    *,
    force: bool,
    state: dict,
) -> list[TextChunk] | None:
    """Return chunks to index, or None if the item should be skipped."""
    log = get_logger()
    if item.status == "ok" and item.localPath:
        if not (PKG_ROOT / item.localPath).is_file():
            log.warning("skip missing PDF: %s (%s)", item.id, item.localPath)
            return None
        if not force and item.sha256 and doc_sha256(state, item.id) == item.sha256:
            log.debug("skip unchanged: %s", item.id)
            return None
        pages = extract_pdf_pages(item)
        pipeline_cats, _ = classify_item(item)
        if pages:
            chunks = chunk_pages(item, pages, pipeline_categories=pipeline_cats)
            log.debug("chunked %s: %d page(s) → %d chunk(s)", item.id, len(pages), len(chunks))
            return chunks
        log.warning(
            "PDF text empty for %s — falling back to title/abstract metadata",
            item.id,
        )
        text = extract_metadata_text(item)
        chunks = chunk_metadata(item, text, pipeline_categories=pipeline_cats)
        log.debug("metadata chunks for %s: %d", item.id, len(chunks))
        return chunks

    if item.status == "metadata_only":
        if not force and item.id in state:
            log.debug("skip unchanged metadata: %s", item.id)
            return None
        text = extract_metadata_text(item)
        pipeline_cats, _ = classify_item(item)
        chunks = chunk_metadata(item, text, pipeline_categories=pipeline_cats)
        log.debug("metadata-only %s: %d chunk(s)", item.id, len(chunks))
        return chunks

    return None


def _mark_item_ingested(item: ManifestItem, state: dict) -> None:
    if item.sha256:
        state[item.id] = item.sha256
    elif item.status == "metadata_only":
        state[item.id] = item.sha256 or f"meta:{item.id}"


def _execute_ingest(
    *,
    force: bool,
    rebuild: bool,
    verbose: bool,
    log_file: str | None,
    embed_profile: str | None,
) -> None:
    from pathlib import Path

    log = setup_ingest_logging(
        log_file=Path(log_file) if log_file else None,
        verbose=verbose,
    )
    t_start = time.monotonic()

    manifest = load_manifest()
    cfg = prepare_embed_config(profile=embed_profile)
    index_slug = cfg.profile or profile_index_paths(embed_profile).profile
    index_paths = profile_index_paths(index_slug)
    state = load_ingest_state(index_paths)
    stats = EmbedStats()

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

    default_workers = "2" if cfg.backend == "openai" else "4"
    workers = resolve_workers(
        int(os.getenv("GRAPH_RAG_WORKERS", default_workers)),
        prefix="GRAPH_RAG_",
    )
    doc_batch = _ingest_doc_batch()
    scan_every = _scan_log_every()

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
        f"index_dir={index_paths.root}"
    )
    log.info(msg)
    click.echo(msg, err=True)

    ingested = 0
    skipped = 0
    missing = 0
    written = 0
    batch_chunks: list[TextChunk] = []
    docs_in_batch = 0
    rebuild_table = rebuild
    scanned = 0

    def flush_batch() -> None:
        nonlocal written, rebuild_table, batch_chunks, docs_in_batch
        if not batch_chunks:
            docs_in_batch = 0
            return
        log.info(
            "flush batch: %d doc(s), %d chunk(s) (indexed so far: %d)",
            docs_in_batch,
            len(batch_chunks),
            written,
        )
        written += upsert_chunks(
            batch_chunks,
            rebuild=rebuild_table,
            config=cfg,
            stats=stats,
            workers=workers,
            profile=index_paths,
        )
        if rebuild_table:
            rebuild_table = False
        save_ingest_state(state, index_paths)
        click.echo(
            f"  indexed batch: {docs_in_batch} docs, {len(batch_chunks)} chunks "
            f"(total written {written})",
            err=True,
        )
        log.info("batch done — total chunks written: %d", written)
        batch_chunks = []
        docs_in_batch = 0

    for item in manifest.items:
        scanned += 1
        if scanned % scan_every == 0:
            log.info(
                "scan progress: %d/%d manifest items (ingested=%d skipped=%d)",
                scanned,
                len(manifest.items),
                ingested,
                skipped,
            )

        chunks = _extract_item_chunks(item, force=force, state=state)
        if chunks is None:
            if item.status == "ok" and item.localPath:
                if not (PKG_ROOT / item.localPath).is_file():
                    missing += 1
                else:
                    skipped += 1
            elif item.status == "metadata_only":
                skipped += 1
            continue

        if not chunks:
            continue

        batch_chunks.extend(chunks)
        _mark_item_ingested(item, state)
        ingested += 1
        docs_in_batch += 1
        log.debug("queued %s (%d chunk(s))", item.id, len(chunks))

        if docs_in_batch >= doc_batch:
            flush_batch()

    flush_batch()

    effective = stats.effective_config or cfg
    if written or stats.tokens:
        update_ingest_metadata(state, config=effective, run_tokens=stats.tokens)

    save_ingest_state(state, index_paths)
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
        help="Named embed profile (overrides RAG_EMBED_PROFILE / GRAPH_RAG_EMBED_PROFILE).",
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
    verbose: bool,
    log_file: str | None,
) -> None:
    """Extract, chunk, embed, and index manifest documents."""
    if ctx.invoked_subcommand is None:
        _execute_ingest(
            force=force,
            rebuild=rebuild,
            verbose=verbose,
            log_file=log_file,
            embed_profile=embed_profile,
        )


from graph_layout_rag.ingest.check_pdfs import check_pdfs_cmd  # noqa: E402

ingest_group.add_command(check_pdfs_cmd, name="check-pdfs")

ingest_cmd = ingest_group
