"""Re-embed chunk vectors from an existing profile index (same chunks, new embed model)."""

from __future__ import annotations

import logging
import shutil
import time
from dataclasses import replace
from typing import Any

import click
import lancedb

from rag_literature_rag.ingest.chunk import TextChunk, chunking_fingerprint
from rag_literature_rag.ingest.embed import EmbedStats, prepare_embed_config
from rag_literature_rag.ingest.index import (
    IndexPhaseStats,
    load_ingest_state,
    save_ingest_state,
    update_ingest_metadata,
    upsert_chunks,
)
from rag_literature_rag.ingest.log import setup_ingest_logging
from rag_literature_rag.paths import CHUNKS_TABLE, profile_index_paths

log = logging.getLogger("rag_literature_rag.ingest.reembed")

REEMBED_OFFSET_KEY = "reembed_offset"


def _split_csv(value: Any) -> list[str]:
    if not value:
        return []
    return [part for part in str(value).split(",") if part]


def _row_to_chunk(row: dict[str, Any]) -> TextChunk:
    year = row.get("year")
    page = row.get("page")
    page_end = row.get("page_end")
    return TextChunk(
        doc_id=str(row["doc_id"]),
        title=str(row.get("title") or ""),
        text=str(row.get("text") or ""),
        page=int(page) if page is not None else None,
        chunk_index=int(row.get("chunk_index", 0)),
        source_url=str(row.get("source_url") or ""),
        year=int(year) if year is not None else None,
        tags=_split_csv(row.get("tags")),
        authors=_split_csv(row.get("authors")),
        pipeline_categories=_split_csv(row.get("pipeline_categories")),
        page_end=int(page_end) if page_end is not None else None,
        section_path=str(row.get("section_path") or ""),
        alias_doc_ids=_split_csv(row.get("alias_doc_ids")),
        alias_source_urls=_split_csv(row.get("alias_source_urls")),
        alias_dois=_split_csv(row.get("alias_dois")),
        canonical_sha256=row.get("canonical_sha256") or None,
    )


def _load_source_rows(source_profile: str) -> list[dict[str, Any]]:
    paths = profile_index_paths(source_profile)
    if not paths.lance_dir.is_dir():
        raise click.ClickException(f"source index not found: {paths.root}")
    db = lancedb.connect(str(paths.lance_dir))
    tables = db.list_tables()
    table_names = tables if isinstance(tables, list) else list(getattr(tables, "tables", tables))
    if CHUNKS_TABLE not in table_names:
        raise click.ClickException(f"source index missing {CHUNKS_TABLE} table: {paths.root}")
    return db.open_table(CHUNKS_TABLE).to_arrow().to_pylist()


def _copy_bm25_index(source_profile: str, target_profile: str) -> None:
    src = profile_index_paths(source_profile).bm25_dir
    dst = profile_index_paths(target_profile).bm25_dir
    if not src.is_dir():
        raise click.ClickException(f"source BM25 index not found: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    log.info("copied BM25 index %s -> %s", src, dst)


def run_reembed(
    *,
    source_profile: str,
    target_profile: str,
    batch_size: int = 256,
    verbose: bool = False,
    log_file: str | None = None,
) -> None:
    setup_ingest_logging(verbose=verbose, log_file=log_file)
    config = prepare_embed_config(profile=target_profile)
    if config.profile is None:
        config = replace(config, profile=target_profile)

    source_paths = profile_index_paths(source_profile)
    target_paths = profile_index_paths(target_profile)
    target_paths.root.mkdir(parents=True, exist_ok=True)

    rows = _load_source_rows(source_profile)
    if not rows:
        raise click.ClickException(f"no chunks in source profile {source_profile!r}")

    state = load_ingest_state(target_paths)
    offset = int(state.get(REEMBED_OFFSET_KEY, 0)) if state else 0
    if offset >= len(rows):
        offset = 0

    if offset == 0:
        _copy_bm25_index(source_profile, target_profile)
        state = {
            "embed_backend": config.backend,
            "embed_model": config.model,
            "embed_dims": config.dimensions,
            "embed_profile": target_profile,
            "chunking_fingerprint": load_ingest_state(source_paths).get(
                "chunking_fingerprint", chunking_fingerprint()
            ),
            "pdf_backend": load_ingest_state(source_paths).get("pdf_backend"),
            "reembed_source_profile": source_profile,
        }
        if config.quant:
            state["embed_quant"] = config.quant
        save_ingest_state(state, target_paths)

    stats = EmbedStats()
    phase_stats = IndexPhaseStats()
    t0 = time.monotonic()
    rebuild = offset == 0
    total = len(rows)

    click.echo(
        f"re-embed {total} chunks: {source_profile} -> {target_profile} "
        f"(offset={offset}, batch={batch_size})"
    )

    while offset < total:
        batch_rows = rows[offset : offset + batch_size]
        chunks = [_row_to_chunk(row) for row in batch_rows]
        upsert_chunks(
            chunks,
            rebuild=rebuild,
            config=config,
            stats=stats,
            profile=target_paths,
            phase_stats=phase_stats,
            skip_bm25=True,
            delete_scope="chunk_id",
        )
        offset += len(batch_rows)
        rebuild = False
        state = load_ingest_state(target_paths)
        state[REEMBED_OFFSET_KEY] = offset
        update_ingest_metadata(state, config=config, run_tokens=0)
        save_ingest_state(state, target_paths)
        elapsed = time.monotonic() - t0
        rate = offset / elapsed if elapsed else 0.0
        eta = (total - offset) / rate if rate else 0.0
        log.info(
            "reembed progress: %d/%d (%.1f%%, %.1f texts/s, eta %.0fs)",
            offset,
            total,
            offset / total * 100,
            rate,
            eta,
        )
        click.echo(f"  {offset}/{total} chunks ({rate:.1f} chunks/s, eta {eta:.0f}s)")

    state = load_ingest_state(target_paths)
    state.pop(REEMBED_OFFSET_KEY, None)
    state["reembed_completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_ingest_state(state, target_paths)
    elapsed = time.monotonic() - t0
    click.echo(
        f"reembed done: {total} chunks in {elapsed:.1f}s "
        f"({total / elapsed:.1f} chunks/s) -> {target_paths.root}"
    )


@click.command("reembed")
@click.option("--source-profile", required=True, help="Existing index to read chunk text from.")
@click.option("--target-profile", required=True, help="New embed profile index to write.")
@click.option("--batch-size", default=256, show_default=True, help="Chunks per embed/write batch.")
@click.option("-v", "--verbose", is_flag=True)
@click.option("--log-file", default=None)
def reembed_cmd(
    source_profile: str,
    target_profile: str,
    batch_size: int,
    verbose: bool,
    log_file: str | None,
) -> None:
    """Re-embed vectors from an existing profile index (same chunks, new embed model)."""
    run_reembed(
        source_profile=source_profile,
        target_profile=target_profile,
        batch_size=batch_size,
        verbose=verbose,
        log_file=log_file,
    )
