from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import click

from repo_rag.chunk.ast_ts import chunk_file
from repo_rag.chunk.types import TextChunk
from repo_rag.harvest.manifest import FileEntry, save_manifest
from repo_rag.harvest.walk import harvest_repo
from repo_rag.ingest import bm25 as bm25_index
from repo_rag.ingest.embed import EmbedConfig, EmbedStats, resolve_workers
from repo_rag.logging_config import get_logger
from repo_rag.ingest.index import (
    chunk_count as lance_chunk_count,
    delete_chunks_for_file,
    load_ingest_state,
    save_ingest_state,
    update_ingest_metadata,
    upsert_chunks,
)
from repo_rag.paths import EMBED_COST_PER_MILLION_TOKENS, REPO_ROOT

log = get_logger("index")

PROGRESS_EVERY = 50
LANCE_WRITE_BATCH = 2000


def _read_file(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8", errors="replace")


def _chunk_one(entry: FileEntry) -> tuple[FileEntry, list[TextChunk], str | None]:
    try:
        content = _read_file(entry.path)
        return entry, chunk_file(entry, content), None
    except OSError as exc:
        return entry, [], str(exc)


def _chunk_entries_parallel(
    entries: list[FileEntry],
    workers: int,
) -> tuple[list[TextChunk], dict[str, str], list[str]]:
    """Read and chunk files in parallel. Returns chunks, path->sha256, error messages."""
    if not entries:
        return [], {}, []

    all_chunks: list[TextChunk] = []
    file_hashes: dict[str, str] = {}
    errors: list[str] = []
    done = 0
    total = len(entries)

    log.info("chunking %d files with %d workers", total, workers)

    if workers == 1 or total == 1:
        for entry in entries:
            entry, chunks, err = _chunk_one(entry)
            if err:
                errors.append(f"{entry.path}: {err}")
                log.warning("skip unreadable file %s: %s", entry.path, err)
            elif chunks:
                all_chunks.extend(chunks)
                file_hashes[entry.path] = entry.sha256
            done += 1
            if done % PROGRESS_EVERY == 0:
                log.info("chunk progress %d/%d files, %d chunks", done, total, len(all_chunks))
        return all_chunks, file_hashes, errors

    with ThreadPoolExecutor(max_workers=min(workers, total)) as pool:
        futures = {pool.submit(_chunk_one, entry): entry for entry in entries}
        for future in as_completed(futures):
            entry, chunks, err = future.result()
            if err:
                errors.append(f"{entry.path}: {err}")
                log.warning("skip unreadable file %s: %s", entry.path, err)
            elif chunks:
                all_chunks.extend(chunks)
                file_hashes[entry.path] = entry.sha256
            done += 1
            if done % PROGRESS_EVERY == 0:
                log.info("chunk progress %d/%d files, %d chunks", done, total, len(all_chunks))

    log.info("chunked %d files -> %d chunks (%d errors)", len(file_hashes), len(all_chunks), len(errors))
    return all_chunks, file_hashes, errors


def _purge_changed_files(paths: list[str]) -> None:
    if not paths:
        return
    log.info("purging %d changed file(s) from indexes", len(paths))
    for path in paths:
        delete_chunks_for_file(path)
        bm25_index.delete_chunks_for_file(path)


def _bulk_upsert(
    chunks: list[TextChunk],
    *,
    rebuild: bool,
    config: EmbedConfig,
    stats: EmbedStats,
    workers: int,
) -> int:
    if not chunks:
        return 0

    if rebuild or len(chunks) <= LANCE_WRITE_BATCH:
        written = upsert_chunks(chunks, rebuild=rebuild, config=config, stats=stats, workers=workers)
        bm25_index.upsert_chunks(chunks, rebuild=rebuild)
        return written

    log.info("bulk upsert %d chunks in batches of %d", len(chunks), LANCE_WRITE_BATCH)
    total = 0
    for i in range(0, len(chunks), LANCE_WRITE_BATCH):
        batch = chunks[i : i + LANCE_WRITE_BATCH]
        first = i == 0
        total += upsert_chunks(
            batch,
            rebuild=rebuild and first,
            config=config,
            stats=stats,
            workers=workers,
        )
        bm25_index.upsert_chunks(batch, rebuild=rebuild and first)
        rebuild = False
        log.info("upsert progress %d/%d chunks", min(i + LANCE_WRITE_BATCH, len(chunks)), len(chunks))
    return total


@click.command("index")
@click.option("--force", is_flag=True, help="Re-index all files regardless of sha256.")
@click.option("--rebuild", is_flag=True, help="Drop and recreate vector + BM25 indexes.")
@click.option(
    "--workers",
    default=None,
    type=int,
    help="Parallel workers for chunking + embed API (default: REPO_RAG_WORKERS or 8).",
)
def index_cmd(force: bool, rebuild: bool, workers: int | None) -> None:
    """Harvest repo files, chunk, embed with OpenAI, and index."""
    started = time.monotonic()
    n_workers = resolve_workers(workers)

    manifest = harvest_repo()
    save_manifest(manifest)
    log.info("harvested %d files into manifest", len(manifest.files))

    state = load_ingest_state()
    file_hashes: dict[str, str] = dict(state.get("files", {}))
    config = EmbedConfig.from_env()
    stats = EmbedStats()

    mode = "rebuild" if rebuild else ("force" if force else "incremental")
    log.info(
        "index start mode=%s workers=%d embed_model=%s dims=%d previously_indexed=%d",
        mode,
        n_workers,
        config.model,
        config.dimensions,
        len(file_hashes),
    )

    if rebuild:
        file_hashes = {}
        to_process = list(manifest.files)
    else:
        to_process = [
            entry
            for entry in manifest.files
            if force or file_hashes.get(entry.path) != entry.sha256
        ]

    skipped = len(manifest.files) - len(to_process)
    log.info("%d files to process, %d unchanged", len(to_process), skipped)

    changed_paths = [e.path for e in to_process]
    if not rebuild and changed_paths:
        _purge_changed_files(changed_paths)

    chunk_started = time.monotonic()
    all_chunks, new_hashes, errors = _chunk_entries_parallel(to_process, n_workers)
    log.info("chunk phase elapsed_s=%.1f", time.monotonic() - chunk_started)

    for msg in errors:
        click.echo(f"  skip unreadable: {msg}", err=True)

    written = 0
    if all_chunks:
        embed_started = time.monotonic()
        log.info("embedding and indexing %d chunks", len(all_chunks))
        written = _bulk_upsert(
            all_chunks,
            rebuild=rebuild,
            config=config,
            stats=stats,
            workers=n_workers,
        )
        log.info("embed+index phase elapsed_s=%.1f", time.monotonic() - embed_started)

    file_hashes.update(new_hashes)
    state["files"] = file_hashes
    update_ingest_metadata(state, config=config, run_tokens=stats.tokens)
    save_ingest_state(state)

    total = lance_chunk_count()
    elapsed = time.monotonic() - started
    run_cost = (stats.tokens / 1_000_000) * EMBED_COST_PER_MILLION_TOKENS
    indexed = len(new_hashes)
    log.info(
        "index done files=%d skipped=%d chunks_written=%d total_chunks=%d "
        "tokens=%d embed_requests=%d run_cost_usd=%.4f elapsed_s=%.1f workers=%d",
        indexed,
        skipped,
        written,
        total,
        stats.tokens,
        stats.requests,
        run_cost,
        elapsed,
        n_workers,
    )
    click.echo(
        f"Indexed {indexed} files ({written} chunks written, {skipped} skipped). "
        f"Tokens this run: {stats.tokens:,} (~${run_cost:.4f}). "
        f"Index total: {total} chunks. "
        f"Elapsed: {elapsed:.1f}s ({n_workers} workers)."
    )
