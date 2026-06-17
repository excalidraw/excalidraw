"""Live file watcher: re-embed changed files so the index never goes stale.

`repo-rag watch` runs a foreground daemon that watches the include roots and, on
each debounced batch of saves, runs the incremental reindex (`run_index`) with the
graph rebuild skipped — keeping vector + BM25 fresh within ~1s of a save. The graph
(symbol/import/call edges) is a ~6-8s full-file scan, so it is rebuilt only once the
editor goes idle, not on every keystroke-batch.

Safety: the embed profile is pinned to whatever the existing index was built with
(read from ``ingest_state``). The daemon never re-resolves the profile from the
environment, so it cannot silently fall back to a weaker local model mid-session.

Caveat: harvest is git-tracked-only, so edits to tracked files are picked up live
(their working-tree sha256 changes) but a brand-new file is only indexed after
``git add``.
"""

from __future__ import annotations

import time
from pathlib import Path

import click

from repo_rag.harvest.walk import _is_excluded, _should_include
from repo_rag.ingest.index import embed_config_from_state, load_ingest_state
from repo_rag.ingest.run import run_index
from repo_rag.graph import build_graph
from repo_rag.harvest.walk import harvest_repo
from repo_rag.logging_config import get_logger
from repo_rag.paths import REPO_ROOT, profile_index_paths

log = get_logger("watch")

# watchfiles tunables (ms). debounce batches rapid editor saves; idle_ms is how long
# after the last change we wait before the (deferred) graph rebuild.
DEBOUNCE_MS = 1200
IDLE_MS = 15_000


def _relevant_change(_change, path: str) -> bool:
    """Cheap gate so the watcher only wakes on indexable source edits.

    Authoritative filtering (git-tracked, locale/minified noise, sha256 diff) still
    happens inside ``harvest_repo``/``run_index``; this just avoids waking on
    node_modules, build output, the RAG data dirs, etc.
    """
    try:
        rel = Path(path).resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return False
    name = rel.rsplit("/", 1)[-1]
    if _is_excluded(rel, name):
        return False
    return _should_include(rel)


def _reindex_once(profile: str) -> dict[str, object]:
    """One incremental reindex (graph skipped). Returns the run_index stats dict."""
    result = run_index(embed_profile=profile, build_graph_index=False)
    changed = result["changed_paths"]
    if changed:
        log.info(
            "reindexed %d file(s), %d chunks, ~$%.4f, %.2fs: %s",
            result["indexed"],
            result["written"],
            result["run_cost"],
            result["elapsed"],
            ", ".join(changed[:5]) + (" …" if len(changed) > 5 else ""),
        )
    else:
        log.info("no indexable changes in batch (%.2fs)", result["elapsed"])
    return result


@click.command("watch")
def watch_cmd() -> None:
    """Watch the repo and re-embed changed files live (incremental, graph-deferred)."""
    try:
        from watchfiles import watch
    except ModuleNotFoundError as exc:
        raise SystemExit(
            f"watch needs the 'watch' extra: cd tools/repo-rag && uv sync --extra watch ({exc})"
        )

    state = load_ingest_state(profile_index_paths())
    indexed = embed_config_from_state(state)
    profile = state.get("embed_profile")
    if indexed is None or not profile:
        raise SystemExit(
            "No prior index found (or it has no pinned embed profile). Build one first:\n"
            "  repo-rag index --force --rebuild --embed-profile <profile>"
        )

    log.info(
        "watch start root=%s embed_profile=%s backend=%s dims=%d debounce_ms=%d idle_ms=%d",
        REPO_ROOT,
        profile,
        indexed.backend,
        indexed.dimensions,
        DEBOUNCE_MS,
        IDLE_MS,
    )
    click.echo(
        f"Watching {REPO_ROOT} — live re-embed on save "
        f"(profile={profile}, backend={indexed.backend}, dims={indexed.dimensions}). Ctrl-C to stop."
    )

    graph_dirty = False
    for changes in watch(
        REPO_ROOT,
        watch_filter=_relevant_change,
        debounce=DEBOUNCE_MS,
        rust_timeout=IDLE_MS,
        yield_on_timeout=True,
    ):
        if changes:
            result = _reindex_once(profile)
            # Guard the profile pin: if the effective backend ever drifts from the
            # indexed one, stop rather than corrupt the index with mismatched vectors.
            if result["backend"] != indexed.backend:
                raise SystemExit(
                    f"Embed backend drifted ({indexed.backend} -> {result['backend']}); "
                    "stopping watch. Check RAG_EMBED_PROFILE / .env."
                )
            if result["changed_paths"]:
                graph_dirty = True
            continue

        # Empty yield == idle timeout. Reconcile the deferred graph once.
        if graph_dirty:
            started = time.monotonic()
            counts = build_graph(harvest_repo())
            graph_dirty = False
            log.info(
                "idle graph rebuild: %d nodes/%d edges (%.2fs)",
                counts["nodes"],
                counts["edges"],
                time.monotonic() - started,
            )
