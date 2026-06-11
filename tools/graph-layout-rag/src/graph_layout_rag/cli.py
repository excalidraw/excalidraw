from __future__ import annotations

import json
import sys

import click

from graph_layout_rag.env import load_env_file
from graph_layout_rag.harvest.run import harvest_group
from graph_layout_rag.ingest.run import ingest_cmd
from graph_layout_rag.query.search import search

load_env_file()


@click.group()
def main() -> None:
    """Graph layout theory RAG — harvest, ingest, query."""


main.add_command(harvest_group, name="harvest")
main.add_command(ingest_cmd, name="ingest")


@main.command("query")
@click.argument("text")
@click.option("--top", default=8, show_default=True)
@click.option("--tag", default=None, help="Filter by tag substring.")
@click.option("--source", default=None, help="Filter by source (e.g. handbook, graphviz).")
@click.option("--year-min", type=int, default=None)
@click.option("--json", "as_json", is_flag=True, help="Emit JSON for LLM agents.")
def query_cmd(text: str, top: int, tag: str | None, source: str | None, year_min: int | None, as_json: bool) -> None:
    """Semantic search over the graph layout corpus."""
    results = search(text, top=top, tag=tag, source=source, year_min=year_min)
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


if __name__ == "__main__":
    main()
