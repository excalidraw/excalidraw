from __future__ import annotations

import json
import sys

import click

from graph_layout_rag.catalog.classify import build_catalog, summarize_catalog
from graph_layout_rag.catalog.taxonomy import PIPELINE_CATEGORIES, UNCATEGORIZED
from graph_layout_rag.env import load_env_file
from graph_layout_rag.harvest.run import harvest_group
from graph_layout_rag.ingest.run import ingest_cmd
from graph_layout_rag.query.search import search
from graph_layout_rag.query.retrieve import DEFAULT_HYBRID

load_env_file()


@click.group()
def main() -> None:
    """Graph layout theory RAG — harvest, ingest, query."""


main.add_command(harvest_group, name="harvest")
main.add_command(ingest_cmd, name="ingest")


@main.group("eval")
def eval_group() -> None:
    """Retrieval evaluation commands."""


from graph_layout_rag.eval.retrieval import retrieval_eval_cmd  # noqa: E402
from graph_layout_rag.eval.benchmark import benchmark_cmd  # noqa: E402
from graph_layout_rag.eval.commands import validate_gold_cmd  # noqa: E402
from graph_layout_rag.eval.experimental_index import build_retrieval_index_cmd  # noqa: E402

eval_group.add_command(retrieval_eval_cmd, name="retrieval")
eval_group.add_command(benchmark_cmd, name="benchmark")
eval_group.add_command(validate_gold_cmd, name="validate-gold")
eval_group.add_command(build_retrieval_index_cmd, name="build-retrieval-index")


@main.group("embed")
def embed_group() -> None:
    """Embedding profile helpers."""


@embed_group.command("profiles")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def embed_profiles_cmd(as_json: bool) -> None:
    """List named embed profiles (backend, model, dimensions)."""
    from graph_layout_rag.ingest.embed import list_embed_profiles

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


@embed_group.command("indexes")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def embed_indexes_cmd(as_json: bool) -> None:
    """List built per-profile vector indexes (chunk count, embed metadata)."""
    from graph_layout_rag.ingest.index import describe_profile_index
    from graph_layout_rag.paths import list_profile_indexes

    rows = [describe_profile_index(paths) for paths in list_profile_indexes()]
    if as_json:
        click.echo(json.dumps(rows, indent=2))
        return

    if not rows:
        click.echo("No profile indexes built yet. Run: graph-layout-rag ingest --force --rebuild")
        return

    click.echo(f"{'Profile':<22} {'Chunks':>8}  {'Dims':>5}  Model / path")
    for row in rows:
        model = row.get("embed_model") or "-"
        dims = row.get("embed_dims") or "-"
        chunks = row.get("chunks", 0)
        click.echo(
            f"{row['profile']:<22} {chunks:>8}  {dims:>5}  {model}\n"
            f"{'':22} {'':>8}        {row['path']}"
        )


@main.command("query")
@click.argument("text")
@click.option("--top", default=8, show_default=True)
@click.option("--max-per-doc", default=2, show_default=True, type=click.IntRange(min=1))
@click.option("--tag", default=None, help="Filter by tag substring.")
@click.option("--category", default=None, help="Filter by pipeline category slug.")
@click.option("--pdf-only", is_flag=True, help="Exclude metadata-only documents.")
@click.option("--source", default=None, help="Filter by source (e.g. handbook, graphviz).")
@click.option("--year-min", type=int, default=None)
@click.option(
    "--embed-profile",
    default=None,
    help="Named embed profile (must match index; see: embed profiles).",
)
@click.option(
    "--rerank/--no-rerank",
    "rerank",
    default=None,
    help="Local cross-encoder rerank (overrides RAG_RERANK_ENABLED).",
)
@click.option(
    "--hybrid/--no-hybrid",
    "hybrid",
    default=DEFAULT_HYBRID,
    show_default=True,
    help="Fuse BM25 lexical search with dense vectors.",
)
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def query_cmd(
    text: str,
    top: int,
    max_per_doc: int,
    tag: str | None,
    category: str | None,
    pdf_only: bool,
    source: str | None,
    year_min: int | None,
    embed_profile: str | None,
    rerank: bool | None,
    hybrid: bool,
    as_json: bool,
) -> None:
    """Semantic search over the graph layout corpus."""
    if category and category not in PIPELINE_CATEGORIES:
        click.echo(
            f"Unknown category {category!r}. Choose from: {', '.join(PIPELINE_CATEGORIES)}",
            err=True,
        )
        sys.exit(1)
    try:
        results = search(
            text,
            top=top,
            tag=tag,
            category=category,
            pdf_only=pdf_only,
            source=source,
            year_min=year_min,
            embed_profile=embed_profile,
            rerank=rerank,
            hybrid=hybrid,
            max_per_doc=max_per_doc,
        )
    except ValueError as exc:
        click.echo(str(exc), err=True)
        sys.exit(1)
    payload = {"query": text, "results": results}

    if as_json:
        click.echo(json.dumps(payload, indent=2))
        return

    if not results:
        click.echo("No results. Run: graph-layout-rag harvest && graph-layout-rag ingest")
        sys.exit(1)

    for i, r in enumerate(results, 1):
        page = f" p.{r['page']}" if r.get("page") else ""
        click.echo(f"{i}. [{r['score']}] {r['title']}{page}")
        click.echo(f"   {r['source_url']}")
        click.echo(f"   {r['excerpt'][:200]}...")
        click.echo()


@main.command("catalog")
@click.option("--status", default="ok", show_default=True, help="Manifest status filter (use 'all' for any).")
@click.option("--category", default=None, help="Filter to one pipeline category.")
@click.option("--uncategorized", is_flag=True, help="List PDFs with no pipeline category.")
@click.option("--doc-id", default=None, help="Show one document by manifest id.")
@click.option("--limit", default=50, show_default=True, type=int, help="Max entries when listing.")
@click.option("--include-orphans", is_flag=True, help="Include PDF files on disk missing from manifest.")
@click.option("--flag-off-topic", is_flag=True, help="Mark entries failing layout relevance check.")
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def catalog_cmd(
    status: str,
    category: str | None,
    uncategorized: bool,
    doc_id: str | None,
    limit: int,
    include_orphans: bool,
    flag_off_topic: bool,
    as_json: bool,
) -> None:
    """Summarize or list PDFs by pipeline-layout category."""
    status_filter = None if status == "all" else status
    entries = build_catalog(
        status=status_filter,
        include_orphans=include_orphans,
        flag_off_topic=flag_off_topic,
    )
    summary = summarize_catalog(entries)

    if doc_id:
        matches = [e for e in entries if e.doc_id == doc_id]
        if not matches:
            click.echo(f"No catalog entry for doc-id: {doc_id}", err=True)
            sys.exit(1)
        entries = matches
    elif category:
        if category not in PIPELINE_CATEGORIES:
            click.echo(
                f"Unknown category {category!r}. Choose from: {', '.join(PIPELINE_CATEGORIES)}",
                err=True,
            )
            sys.exit(1)
        entries = [e for e in entries if category in e.categories]
    elif uncategorized:
        entries = [e for e in entries if not e.categories]

    if as_json:
        list_entries = entries if doc_id else entries[:limit]
        payload: dict = {
            "summary": summary,
            "entries": [e.to_dict() for e in list_entries],
        }
        if not doc_id and len(entries) > limit:
            payload["truncated"] = len(entries) - limit
        click.echo(json.dumps(payload, indent=2))
        return

    status_label = status if status != "all" else "all"
    click.echo(f"Pipeline PDF catalog (status={status_label}, n={summary['total']})")
    click.echo("")
    click.echo(f"{'Category':<24} {'PDFs':>6} {'tag':>6} {'keyword':>8}")
    for cat in PIPELINE_CATEGORIES:
        counts = summary["by_category"][cat]
        click.echo(f"{cat:<24} {counts['total']:>6} {counts['tag']:>6} {counts['keyword']:>8}")
    click.echo(f"{UNCATEGORIZED:<24} {summary['uncategorized']:>6}")
    if flag_off_topic:
        click.echo(f"\nOff-topic flagged: {summary['off_topic']}")
    click.echo("")
    sources = " ".join(f"{k}={v}" for k, v in summary["by_source"].items())
    click.echo(f"Sources: {sources}")

    if doc_id or category or uncategorized:
        click.echo("")
        shown = entries if doc_id else entries[:limit]
        for entry in shown:
            cats = ", ".join(entry.categories) if entry.categories else UNCATEGORIZED
            methods = ", ".join(entry.methods) if entry.methods else "-"
            year = entry.year or "?"
            off = " [off-topic]" if entry.off_topic else ""
            click.echo(f"- [{cats}] ({methods}) {entry.title} ({year}){off}")
            click.echo(f"  id={entry.doc_id} source={entry.source}")
        if not doc_id and len(entries) > limit:
            click.echo(f"\n... {len(entries) - limit} more (use --limit or --json)")


if __name__ == "__main__":
    main()
