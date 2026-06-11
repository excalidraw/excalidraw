from __future__ import annotations

import os

import click

from graph_layout_rag.ingest.chunk import chunk_metadata, chunk_pages
from graph_layout_rag.ingest.embed import EmbedStats, prepare_embed_config, resolve_workers
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
from graph_layout_rag.manifest import load_manifest
from graph_layout_rag.paths import PKG_ROOT


@click.command()
@click.option("--force", is_flag=True, help="Re-ingest all documents regardless of sha256.")
@click.option("--rebuild", is_flag=True, help="Drop and recreate the LanceDB table.")
def ingest_cmd(force: bool, rebuild: bool) -> None:
    """Extract, chunk, embed, and index manifest documents."""
    manifest = load_manifest()
    state = load_ingest_state()
    cfg = prepare_embed_config()
    stats = EmbedStats()

    if embed_config_mismatch(state, cfg) and not rebuild:
        click.echo(
            f"Embed backend/model changed ({state.get('embed_backend')} → {cfg.backend}); "
            "auto-enabling --rebuild.",
            err=True,
        )
        rebuild = True
        force = True

    default_workers = "2" if cfg.backend == "openai" else "4"
    workers = resolve_workers(
        int(os.getenv("GRAPH_RAG_WORKERS", default_workers)),
        prefix="GRAPH_RAG_",
    )

    click.echo(
        f"Embedding backend={cfg.backend} model={cfg.model} dims={cfg.dimensions} workers={workers}",
        err=True,
    )

    all_chunks = []
    ingested = 0
    skipped = 0
    missing = 0

    for item in manifest.items:
        if item.status == "ok" and item.localPath:
            if not (PKG_ROOT / item.localPath).is_file():
                click.echo(f"  skip missing PDF: {item.id} ({item.localPath})", err=True)
                missing += 1
                continue
            if not force and item.sha256 and doc_sha256(state, item.id) == item.sha256:
                skipped += 1
                continue
            pages = extract_pdf_pages(item)
            chunks = chunk_pages(item, pages)
            if chunks:
                all_chunks.extend(chunks)
                if item.sha256:
                    state[item.id] = item.sha256
                ingested += 1
        elif item.status == "metadata_only":
            if not force and item.id in state:
                skipped += 1
                continue
            text = extract_metadata_text(item)
            all_chunks.extend(chunk_metadata(item, text))
            state[item.id] = item.sha256 or f"meta:{item.id}"
            ingested += 1

    if rebuild and all_chunks:
        written = upsert_chunks(
            all_chunks, rebuild=True, config=cfg, stats=stats, workers=workers
        )
    elif all_chunks:
        written = upsert_chunks(
            all_chunks, rebuild=False, config=cfg, stats=stats, workers=workers
        )
    else:
        written = 0

    effective = stats.effective_config or cfg
    if written or stats.tokens:
        update_ingest_metadata(state, config=effective, run_tokens=stats.tokens)

    save_ingest_state(state)
    total = chunk_count()
    cost_note = ""
    if stats.tokens and effective.backend == "openai":
        run_cost = (stats.tokens / 1_000_000) * 0.13
        cost_note = f" Embed: {stats.tokens} tokens (~${run_cost:.4f})."
    click.echo(
        f"Ingested {ingested} docs ({written} new chunks written, {skipped} skipped"
        f"{f', {missing} missing PDFs' if missing else ''}). "
        f"Backend: {effective.backend}. "
        f"Index total: {total} chunks.{cost_note}"
    )
