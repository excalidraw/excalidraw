from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import click

from repo_rag.chunk.ast_ts import chunk_file
from repo_rag.chunk.ast_ts import count_tokens
from repo_rag.chunk.contextualize import contextual_enabled, contextualize_chunks
from repo_rag.chunk.types import TextChunk
from repo_rag.harvest.manifest import FileEntry, save_manifest
from repo_rag.harvest.walk import harvest_repo
from repo_rag.graph import build_graph, graph_counts
from repo_rag.ingest import bm25 as bm25_index
from repo_rag.ingest.embed import ENV_PREFIX, EmbedConfig, EmbedStats, embed_config_from_env, prepare_embed_config, resolve_workers
from rag_common.profiles import resolve_profile_name
from repo_rag.logging_config import get_logger
from repo_rag.ingest.index import (
    chunk_count as lance_chunk_count,
    delete_chunks_for_file,
    embed_config_mismatch,
    load_ingest_state,
    save_ingest_state,
    update_ingest_metadata,
    upsert_chunks,
)
from repo_rag.paths import REPO_ROOT

log = get_logger("index")

PROGRESS_EVERY = 50
LANCE_WRITE_BATCH = 2000


def _read_file(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8", errors="replace")


def _chunk_one(
    entry: FileEntry,
    *,
    contextual: bool = False,
    use_llm: bool = False,
) -> tuple[FileEntry, list[TextChunk], str | None]:
    try:
        content = _read_file(entry.path)
        chunks = chunk_file(entry, content)
        if contextual and chunks:
            # Per-file so the cached document prefix stays warm across its chunks.
            contextualize_chunks(chunks, content, use_llm=use_llm)
        return entry, chunks, None
    except OSError as exc:
        return entry, [], str(exc)


def _chunk_entries_parallel(
    entries: list[FileEntry],
    workers: int,
    *,
    contextual: bool = False,
    use_llm: bool = False,
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
            entry, chunks, err = _chunk_one(entry, contextual=contextual, use_llm=use_llm)
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
        futures = {
            pool.submit(_chunk_one, entry, contextual=contextual, use_llm=use_llm): entry
            for entry in entries
        }
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


def run_index(
    *,
    force: bool = False,
    rebuild: bool = False,
    embed_profile: str | None = None,
    workers: int | None = None,
    contextual: bool = False,
    build_graph_index: bool = True,
) -> dict[str, object]:
    """Harvest, chunk, embed, and index. Returns a stats dict.

    ``build_graph_index=False`` skips the full graph rebuild (a ~6-8s scan of every
    file) — used by the live watcher, which keeps vector + BM25 fresh per save and
    rebuilds the graph only when editing goes idle.
    """
    started = time.monotonic()
    n_workers = resolve_workers(workers, prefix=ENV_PREFIX)
    contextual = contextual or contextual_enabled()
    use_llm = contextual and bool(
        os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")
    )
    if contextual and not use_llm:
        log.warning("contextual retrieval on but no ANTHROPIC_API_KEY; using deterministic heuristic")

    manifest = harvest_repo()
    save_manifest(manifest)
    if build_graph_index:
        graph_stats = build_graph(manifest)
    else:
        graph_stats = graph_counts()
    log.info("harvested %d files into manifest", len(manifest.files))

    state = load_ingest_state()
    file_hashes: dict[str, str] = dict(state.get("files", {}))
    # Inherit the profile the existing index was built with when none is given
    # explicitly (arg or env). Without this, a bare incremental run resolves to the
    # local default, embed_config_mismatch fires, and we silently full-rebuild the
    # whole index with the wrong (weaker) model. Mirrors `repo-rag watch`'s pin.
    effective_profile = resolve_profile_name(prefix=ENV_PREFIX, profile=embed_profile)
    if not effective_profile:
        effective_profile = state.get("embed_profile") or None
    config = prepare_embed_config(profile=effective_profile)
    stats = EmbedStats()

    if embed_config_mismatch(state, config) and not rebuild:
        log.warning(
            "embed backend/model changed (%s -> %s); auto-enabling rebuild",
            state.get("embed_backend"),
            config.backend,
        )
        rebuild = True
        force = True

    mode = "rebuild" if rebuild else ("force" if force else "incremental")
    log.info(
        "index start mode=%s workers=%d embed_backend=%s embed_model=%s dims=%d previously_indexed=%d",
        mode,
        n_workers,
        config.backend,
        config.model,
        config.dimensions,
        len(file_hashes),
    )

    if rebuild:
        file_hashes = {}
        to_process = list(manifest.files)
    else:
        current_paths = {entry.path for entry in manifest.files}
        deleted_paths = sorted(set(file_hashes) - current_paths)
        if deleted_paths:
            _purge_changed_files(deleted_paths)
            for path in deleted_paths:
                file_hashes.pop(path, None)
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
    all_chunks, new_hashes, errors = _chunk_entries_parallel(
        to_process, n_workers, contextual=contextual, use_llm=use_llm
    )
    log.info("chunk phase elapsed_s=%.1f contextual=%s use_llm=%s", time.monotonic() - chunk_started, contextual, use_llm)

    for msg in errors:
        click.echo(f"  skip unreadable: {msg}", err=True)

    written = 0
    if all_chunks:
        embed_started = time.monotonic()
        estimated_tokens = sum(count_tokens(chunk.text) for chunk in all_chunks)
        log.info(
            "embedding and indexing start chunks=%d estimated_source_tokens=%d workers=%d",
            len(all_chunks),
            estimated_tokens,
            n_workers,
        )
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
    state["contextual"] = contextual
    effective = stats.effective_config or config
    update_ingest_metadata(state, config=effective, run_tokens=stats.tokens)
    save_ingest_state(state)

    total = lance_chunk_count()
    elapsed = time.monotonic() - started
    from rag_common.config import embed_cost_per_million

    run_cost = (
        (stats.tokens / 1_000_000) * embed_cost_per_million(effective.backend)
        if effective.is_remote
        else 0.0
    )
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
    return {
        "indexed": indexed,
        "written": written,
        "skipped": skipped,
        "tokens": stats.tokens,
        "requests": stats.requests,
        "run_cost": run_cost,
        "total_chunks": total,
        "changed_paths": changed_paths,
        "backend": effective.backend,
        "graph": graph_stats,
        "workers": n_workers,
        "elapsed": elapsed,
    }


@click.command("index")
@click.option("--force", is_flag=True, help="Re-index all files regardless of sha256.")
@click.option("--rebuild", is_flag=True, help="Drop and recreate vector + BM25 indexes.")
@click.option(
    "--embed-profile",
    default=None,
    help="Named embed profile (overrides RAG_EMBED_PROFILE / REPO_RAG_EMBED_PROFILE).",
)
@click.option(
    "--workers",
    default=None,
    type=int,
    help="Parallel workers for chunking + embed API (default: REPO_RAG_WORKERS or 8).",
)
@click.option(
    "--contextual",
    is_flag=True,
    help="Contextual Retrieval: prepend an LLM-generated situating blurb to each chunk "
    "before embedding + BM25 (requires --force/--rebuild; needs ANTHROPIC_API_KEY for the "
    "LLM path, else uses a deterministic heuristic).",
)
def index_cmd(
    force: bool,
    rebuild: bool,
    embed_profile: str | None,
    workers: int | None,
    contextual: bool,
) -> None:
    """Harvest repo files, chunk, embed, and index."""
    result = run_index(
        force=force,
        rebuild=rebuild,
        embed_profile=embed_profile,
        workers=workers,
        contextual=contextual,
        build_graph_index=True,
    )
    graph_stats = result["graph"]
    click.echo(
        f"Indexed {result['indexed']} files ({result['written']} chunks written, "
        f"{result['skipped']} skipped). "
        f"Backend: {result['backend']}. "
        f"Tokens this run: {result['tokens']:,} (~${result['run_cost']:.4f}). "
        f"Index total: {result['total_chunks']} chunks. "
        f"Graph: {graph_stats['nodes']} nodes/{graph_stats['edges']} edges. "
        f"Elapsed: {result['elapsed']:.1f}s ({result['workers']} workers)."
    )
