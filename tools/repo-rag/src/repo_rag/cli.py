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
from repo_rag.context import assemble_context, read_entity
from repo_rag.graph import find_entities, graph_counts, neighbors
from repo_rag.ingest import bm25 as bm25_index
from repo_rag.ingest.embed import embed_config_from_env
from repo_rag.ingest.index import chunk_count, embed_config_from_state, load_ingest_state
from repo_rag.ingest.run import index_cmd
from repo_rag.watch import watch_cmd
from repo_rag.paths import DEFAULT_LOG_FILE
from repo_rag.query.search import search
from repo_rag.eval import benchmark, compare


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
main.add_command(watch_cmd, name="watch")


@main.group("embed")
def embed_group() -> None:
    """Embedding profile helpers."""


@embed_group.command("profiles")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def embed_profiles_cmd(as_json: bool) -> None:
    """List named embed profiles (backend, model, dimensions)."""
    from repo_rag.ingest.embed import list_embed_profiles

    rows = list_embed_profiles()
    if as_json:
        payload = [
            {
                "name": name,
                "backend": backend,
                "model": model,
                "dimensions": dims,
                "quant": quant,
            }
            for name, backend, model, dims, quant in rows
        ]
        click.echo(json.dumps(payload, indent=2))
        return

    click.echo(f"{'Profile':<22} {'Backend':<8} {'Dims':>5}  Model")
    for name, backend, model, dims, quant in rows:
        quant_note = f" quant={quant}" if quant else ""
        click.echo(f"{name:<22} {backend:<8} {dims:>5}  {model}{quant_note}")


@main.command("query")
@click.argument("text")
@click.option("--top", default=8, show_default=True)
@click.option("--source-type", default=None, help="Filter: handoff, terraform, code, app, test, doc")
@click.option("--package", default=None, help="Filter by package name.")
@click.option("--path-contains", default=None, help="Filter file_path substring.")
@click.option(
    "--embed-profile",
    default=None,
    help="Named embed profile (must match index; see: embed profiles).",
)
@click.option(
    "--rerank/--no-rerank",
    "rerank",
    default=None,
    help="Cross-encoder rerank the fused candidates (default: RAG_RERANK_ENABLED env).",
)
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def query_cmd(
    text: str,
    top: int,
    source_type: str | None,
    package: str | None,
    path_contains: str | None,
    embed_profile: str | None,
    rerank: bool | None,
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
        embed_profile=embed_profile,
        rerank=rerank,
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


@main.command("search")
@click.argument("text")
@click.option("--top", default=8, show_default=True)
@click.option(
    "--rerank/--no-rerank",
    "rerank",
    default=None,
    help="Cross-encoder rerank the fused candidates (default: RAG_RERANK_ENABLED env).",
)
def search_cmd(text: str, top: int, rerank: bool | None) -> None:
    """JSON-first hybrid seed retrieval."""
    click.echo(
        json.dumps({"query": text, "results": search(text, top=top, rerank=rerank)}, indent=2)
    )


@main.command("symbol")
@click.argument("name")
def symbol_cmd(name: str) -> None:
    """Exact symbol or file lookup."""
    click.echo(json.dumps({"entity": name, "results": find_entities(name)}, indent=2))


@main.command("neighbors")
@click.argument("entity")
@click.option("--edge", "edge_type", default=None)
@click.option("--depth", default=1, type=click.IntRange(1, 5), show_default=True)
def neighbors_cmd(entity: str, edge_type: str | None, depth: int) -> None:
    """Traverse incoming and outgoing repository graph edges."""
    click.echo(json.dumps({"entity": entity, "results": neighbors(entity, edge_type, depth)}, indent=2))


@main.command("read")
@click.argument("entity")
def read_cmd(entity: str) -> None:
    """Read an entity with enclosing source context."""
    click.echo(json.dumps({"entity": entity, "results": read_entity(entity)}, indent=2))


@main.command("context")
@click.argument("task")
@click.option("--budget", default=6000, type=click.IntRange(100, 100000), show_default=True)
@click.option("--agentic", is_flag=True, help="Reserved provider-neutral explorer mode; currently deterministic.")
def context_cmd(task: str, budget: int, agentic: bool) -> None:
    """Assemble task-aware hybrid and graph context."""
    payload = assemble_context(task, budget)
    payload["mode"] = "bounded-graph" if agentic else "deterministic"
    click.echo(json.dumps(payload, indent=2))


@main.command("explain")
@click.argument("result_id")
def explain_cmd(result_id: str) -> None:
    """Explain indexed entity and graph evidence."""
    rows = find_entities(result_id)
    click.echo(json.dumps({"result_id": result_id, "entities": rows, "neighbors": neighbors(result_id) if rows else []}, indent=2))


@main.group("eval")
def eval_group() -> None:
    """Repository retrieval evaluation."""


@eval_group.command("benchmark")
@click.option("--limit", default=None, type=click.IntRange(1, 10000))
@click.option("-k", "k", default=10, type=click.IntRange(1, 100), show_default=True, help="Cutoff for Hit@k / nDCG@k.")
@click.option(
    "--rerank/--no-rerank",
    "rerank",
    default=None,
    help="Force rerank on/off for this run (default: RAG_RERANK_ENABLED env).",
)
@click.option("--compare", "do_compare", is_flag=True, help="Run rerank off vs on and report the metric delta.")
def benchmark_cmd(limit: int | None, k: int, rerank: bool | None, do_compare: bool) -> None:
    """Run the judged query benchmark (Hit@k, MRR, nDCG@k, latency) and emit JSON."""
    if do_compare:
        click.echo(json.dumps(compare(limit, k=k), indent=2))
        return
    click.echo(json.dumps(benchmark(limit, k=k, rerank=rerank), indent=2))


@main.command("status")
def status_cmd() -> None:
    """Show index stats, embed model, and estimated cost."""
    state = load_ingest_state()
    resolved = embed_config_from_env()
    indexed = embed_config_from_state(state)
    manifest = harvest_repo()

    payload = {
        "chunks_lance": chunk_count(),
        "chunks_bm25": bm25_index.chunk_count(),
        "files_in_repo": len(manifest.files),
        "files_indexed": len(state.get("files", {})),
        "embed_backend": state.get("embed_backend", indexed.backend if indexed else resolved.backend),
        "embed_model": state.get("embed_model", indexed.model if indexed else resolved.model),
        "embed_dims": state.get("embed_dims", indexed.dimensions if indexed else resolved.dimensions),
        "embed_profile": state.get("embed_profile", indexed.profile if indexed else resolved.profile),
        "resolved_backend": resolved.backend,
        "resolved_model": resolved.model,
        "resolved_profile": resolved.profile,
        "total_tokens_embedded": state.get("total_tokens_embedded", 0),
        "estimated_cost_usd": state.get("estimated_cost_usd", 0.0),
        "last_indexed_at": state.get("last_indexed_at"),
        "graph": graph_counts(),
    }
    click.echo(json.dumps(payload, indent=2))


@main.command("mcp")
def mcp_cmd() -> None:
    """Run the MCP server (stdio) exposing search/symbol/neighbors/context/read."""
    try:
        from repo_rag.mcp_server import run as run_mcp
    except ModuleNotFoundError as exc:
        raise SystemExit(
            f"MCP server needs the 'mcp' extra: cd tools/repo-rag && uv sync --extra mcp ({exc})"
        )
    run_mcp()


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
