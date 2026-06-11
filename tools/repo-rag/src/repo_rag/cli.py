from __future__ import annotations

import json
import sys
import time

import click

from repo_rag.env import load_env_file
from repo_rag.logging_config import get_logger, setup_logging

load_env_file()
setup_logging()

from repo_rag.harvest.manifest import save_manifest
from repo_rag.harvest.walk import harvest_repo
from repo_rag.ingest import bm25 as bm25_index
from repo_rag.ingest.embed import EmbedConfig
from repo_rag.ingest.index import chunk_count, load_ingest_state
from repo_rag.ingest.run import index_cmd
from repo_rag.paths import DEFAULT_LOG_FILE
from repo_rag.query.search import search


@click.group()
@click.option("-v", "--verbose", is_flag=True, help="DEBUG logging (per-file progress).")
@click.option(
    "--log-file",
    type=click.Path(path_type=str),
    default=None,
    help=f"Append logs to file (default with --log-file: {DEFAULT_LOG_FILE.name}).",
)
@click.option("--log", "enable_log_file", is_flag=True, help=f"Write logs to {DEFAULT_LOG_FILE}.")
@click.pass_context
def main(ctx: click.Context, verbose: bool, log_file: str | None, enable_log_file: bool) -> None:
    """Full-repo RAG for excalidraw-tf — index, query, status."""
    path = log_file
    if enable_log_file and path is None:
        path = str(DEFAULT_LOG_FILE)
    if verbose or path is not None:
        setup_logging(verbose=verbose, log_file=path)
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose


main.add_command(index_cmd, name="index")


@main.command("query")
@click.argument("text")
@click.option("--top", default=8, show_default=True)
@click.option("--source-type", default=None, help="Filter: handoff, terraform, code, app, test, doc")
@click.option("--package", default=None, help="Filter by package name.")
@click.option("--path-contains", default=None, help="Filter file_path substring.")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def query_cmd(
    text: str,
    top: int,
    source_type: str | None,
    package: str | None,
    path_contains: str | None,
    as_json: bool,
) -> None:
    """Hybrid semantic + BM25 search over the indexed repo."""
    log = get_logger("query")
    started = time.monotonic()
    log.info(
        "query start top=%d source_type=%s package=%s path_contains=%s q=%r",
        top,
        source_type,
        package,
        path_contains,
        text[:120],
    )
    results = search(
        text,
        top=top,
        source_type=source_type,
        package=package,
        path_contains=path_contains,
    )
    elapsed = time.monotonic() - started
    log.info("query done results=%d elapsed_s=%.3f", len(results), elapsed)
    if results:
        log.debug("top hit: %s score=%s", results[0].get("file_path"), results[0].get("score"))
    payload = {"query": text, "results": results}

    if as_json:
        click.echo(json.dumps(payload, indent=2))
        return

    if not results:
        click.echo("No results. Run: yarn repo-rag:index")
        sys.exit(1)

    for i, r in enumerate(results, 1):
        line = f":{r['start_line']}" if r.get("start_line") else ""
        click.echo(f"{i}. [{r['score']}] {r['file_path']}{line}")
        if r.get("symbol"):
            click.echo(f"   {r['symbol']}")
        click.echo(f"   {r['excerpt'][:200]}...")
        click.echo()


@main.command("status")
def status_cmd() -> None:
    """Show index stats, embed model, and estimated cost."""
    state = load_ingest_state()
    config = EmbedConfig.from_env()
    manifest = harvest_repo()

    payload = {
        "chunks_lance": chunk_count(),
        "chunks_bm25": bm25_index.chunk_count(),
        "files_in_repo": len(manifest.files),
        "files_indexed": len(state.get("files", {})),
        "embed_model": state.get("embed_model", config.model),
        "embed_dims": state.get("embed_dims", config.dimensions),
        "total_tokens_embedded": state.get("total_tokens_embedded", 0),
        "estimated_cost_usd": state.get("estimated_cost_usd", 0.0),
        "last_indexed_at": state.get("last_indexed_at"),
    }
    click.echo(json.dumps(payload, indent=2))


@main.command("harvest")
def harvest_cmd() -> None:
    """Walk repo and write manifest.json (no embedding)."""
    log = get_logger("harvest")
    manifest = harvest_repo()
    save_manifest(manifest)
    by_type: dict[str, int] = {}
    for f in manifest.files:
        by_type[f.source_type] = by_type.get(f.source_type, 0) + 1
    log.info("harvested %d files by_type=%s", len(manifest.files), by_type)
    click.echo(f"Harvested {len(manifest.files)} files into manifest.json")


if __name__ == "__main__":
    main()
