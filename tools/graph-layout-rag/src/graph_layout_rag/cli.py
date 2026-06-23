from __future__ import annotations

import json
import sys

import click

from graph_layout_rag.env import load_env_file

load_env_file()

from graph_layout_rag.catalog.classify import build_catalog, summarize_catalog
from graph_layout_rag.catalog.taxonomy import PIPELINE_CATEGORIES, UNCATEGORIZED
from graph_layout_rag.harvest.run import harvest_group
from graph_layout_rag.ingest.run import ingest_cmd
from graph_layout_rag.query.search import search
from graph_layout_rag.query.retrieve import DEFAULT_HYBRID

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
from graph_layout_rag.eval.pool_commands import (  # noqa: E402
    corpus_health_cmd,
    diagnostics_cmd,
    gate_cmd,
    judge_cmd,
    pool_cmd,
)

eval_group.add_command(retrieval_eval_cmd, name="retrieval")
eval_group.add_command(benchmark_cmd, name="benchmark")
eval_group.add_command(validate_gold_cmd, name="validate-gold")
eval_group.add_command(build_retrieval_index_cmd, name="build-retrieval-index")
eval_group.add_command(pool_cmd, name="pool")
eval_group.add_command(judge_cmd, name="judge")
eval_group.add_command(diagnostics_cmd, name="diagnostics")
eval_group.add_command(corpus_health_cmd, name="corpus-health")
eval_group.add_command(gate_cmd, name="gate")


@eval_group.command("related")
@click.option("--variant", "variants", multiple=True, help="Restrict to these variants (repeatable).")
@click.option("--folds", default=150, show_default=True, help="Max leave-one-out folds.")
@click.option("--min-refs", default=1, show_default=True, help="Min in-corpus references to be a seed.")
@click.option("--embed-model", type=click.Choice(["scincl", "specter2"]), default="scincl", show_default=True)
@click.option("--report", is_flag=True, help="Also write a markdown report next to -o.")
@click.option("-o", "--output", type=click.Path(), default=None, help="Write JSON payload here.")
def eval_related_cmd(
    variants: tuple[str, ...], folds: int, min_refs: int, embed_model: str,
    report: bool, output: str | None,
) -> None:
    """Leave-one-out citation-prediction A/B for the `find related papers` rankers."""
    from pathlib import Path

    from graph_layout_rag.eval.related_eval import run_related_eval, write_related_report

    try:
        payload = run_related_eval(
            variants=list(variants) or None, max_cases=folds,
            min_refs=min_refs, embed_model=embed_model,
        )
    except RuntimeError as exc:
        click.echo(str(exc), err=True)
        sys.exit(1)

    if output:
        out_path = Path(output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        if report:
            write_related_report(payload, out_path.with_suffix(".md"))
            click.echo(f"Report: {out_path.with_suffix('.md')}")

    for r in sorted(payload["results"], key=lambda x: -x.get("mrr", 0)):
        click.echo(
            f"{r['variant']:<16} MRR={r.get('mrr', 0):.3f} nDCG@10={r.get('ndcg@10', 0):.3f} "
            f"R@10={r.get('recall@10', 0):.3f} HR@10={r.get('hit_rate@10', 0):.3f} "
            f"p95={r.get('latency_ms_p95', 0):.0f}ms"
        )
    if payload.get("variants_skipped"):
        click.echo(f"Skipped (no doc vectors): {', '.join(payload['variants_skipped'])}", err=True)


@main.group("cite")
def cite_group() -> None:
    """Citation graph: enrich from OpenAlex/Semantic Scholar, find related papers."""


@cite_group.command("enrich")
@click.option("--force", is_flag=True, help="Re-fetch OpenAlex records already enriched.")
@click.option("--workers", default=16, show_default=True, help="Parallel OpenAlex fetchers.")
@click.option("--no-s2", is_flag=True, help="Skip the Semantic Scholar isInfluential pass.")
@click.option(
    "--incoming/--no-incoming",
    default=True,
    show_default=True,
    help="Fetch incoming citations from Semantic Scholar (revives co-citation).",
)
@click.option("--incoming-cap", default=500, show_default=True, help="Cap incoming citers per paper.")
@click.option("--incoming-workers", default=32, show_default=True, help="Parallel S2 incoming fetchers.")
def cite_enrich_cmd(force: bool, workers: int, no_s2: bool, incoming: bool, incoming_cap: int, incoming_workers: int) -> None:
    """Build/refresh data/citations.sqlite from the manifest DOIs.

    OpenAlex supplies outgoing references + counts; Semantic Scholar supplies incoming
    citations (the half OpenAlex meters) so co-citation and the backward PPR signal work.
    The incoming pass resumes on its own marker — safe to re-run without --force.
    """
    from graph_layout_rag.harvest.cite_enrich import enrich_citations

    stats = enrich_citations(
        force=force, workers=workers, with_s2=not no_s2,
        incoming=incoming, incoming_cap=incoming_cap, incoming_workers=incoming_workers,
    )
    click.echo(json.dumps(stats, indent=2))


@cite_group.command("stats")
def cite_stats_cmd() -> None:
    """Show citation-graph counts."""
    from graph_layout_rag import citation_store as cs

    if not cs.CITATIONS_DB_PATH.exists():
        click.echo("No citation store yet. Run: graph-layout-rag cite enrich")
        sys.exit(1)
    db = cs.connect()
    click.echo(json.dumps(cs.counts(db), indent=2))
    db.close()


@cite_group.command("embed-related")
@click.option(
    "--model",
    type=click.Choice(["scincl", "specter2"]),
    default="scincl",
    show_default=True,
    help="Citation-trained doc embedding to build.",
)
@click.option("--rebuild", is_flag=True, help="Drop and rebuild the doc-vector table.")
@click.option("--batch-size", default=16, show_default=True)
def cite_embed_related_cmd(model: str, rebuild: bool, batch_size: int) -> None:
    """Build per-document SciNCL/SPECTER2 vectors over the whole manifest (incl. metadata-only)."""
    from graph_layout_rag.doc_vectors import build_doc_vectors

    count = build_doc_vectors(model, rebuild=rebuild, batch_size=batch_size)
    click.echo(json.dumps({"model": model, "doc_vectors": count}, indent=2))


# Fused relatedness weights, tuned on the leave-one-out eval: co-citation leads (it became
# the strongest signal once incoming citations were backfilled), undirected PPR + coupling
# cover the gaps, embedding is a light topical tiebreak. Re-tune via `eval related`.
_FUSED_WEIGHTS = {
    "w_ppr": 0.6, "w_ppr_fwd": 0.0, "w_ppr_bwd": 0.0,
    "w_coupling": 0.3, "w_cocitation": 1.5, "w_prior": 0.02, "w_embedding": 0.15,
}


@cite_group.command("related")
@click.argument("doc_id")
@click.option("--top", default=15, show_default=True)
@click.option(
    "--signal",
    type=click.Choice(["graph", "embedding", "fused"]),
    default="fused",
    show_default=True,
    help="graph = citation structure; embedding = SciNCL/SPECTER2 cosine; fused = both.",
)
@click.option(
    "--model",
    type=click.Choice(["scincl", "specter2"]),
    default="scincl",
    show_default=True,
    help="Doc-embedding model for the embedding/fused signals.",
)
@click.option("--json", "as_json", is_flag=True, help="Emit JSON.")
def cite_related_cmd(doc_id: str, top: int, signal: str, model: str, as_json: bool) -> None:
    """Papers most related to DOC_ID (citation structure, embedding, or both)."""
    from graph_layout_rag import citation_store as cs
    from graph_layout_rag.doc_vectors import (
        embedding_scores,
        has_doc_vectors,
        load_all_vectors,
        related_by_embedding,
    )
    from graph_layout_rag.query.citation_rank import load_graph, related_to_docs
    from graph_layout_rag.query.identity import canonical_identity_map

    identities = canonical_identity_map()
    seed_doc_ids = identities.component_doc_ids(doc_id)

    if signal == "embedding":
        if not has_doc_vectors(model):
            click.echo(f"No {model} doc vectors. Run: graph-layout-rag cite embed-related --model {model}", err=True)
            sys.exit(1)
        vectors = load_all_vectors(model)
        vector_seed = next((candidate for candidate in seed_doc_ids if candidate in vectors), None)
        emb = related_by_embedding(model, vector_seed, top=max(top * 4, top)) if vector_seed else []
        if not emb:
            click.echo(f"{doc_id!r} has no doc vector (not in manifest?).", err=True)
            sys.exit(1)
        canonical_seed = identities.canonicalize_doc_id(doc_id)
        seen: set[str] = set()
        canonical_emb: list[dict] = []
        for row in emb:
            canonical = identities.canonicalize_doc_id(row["doc_id"])
            if canonical == canonical_seed or canonical in seen:
                continue
            canonical_emb.append({**row, "doc_id": canonical})
            seen.add(canonical)
            if len(canonical_emb) >= top:
                break
        emb = canonical_emb
        if as_json:
            click.echo(json.dumps({"seed": doc_id, "signal": signal, "model": model, "related": emb}, indent=2))
            return
        for i, r in enumerate(emb, 1):
            click.echo(f"{i:2d}. [{r['score']:.3f}] {r['doc_id']}  (embedding)")
        return

    if not cs.CITATIONS_DB_PATH.exists():
        click.echo("No citation store yet. Run: graph-layout-rag cite enrich", err=True)
        sys.exit(1)
    db = cs.connect()
    graph = load_graph(db)
    if not any(candidate in graph.doc_to_oa for candidate in seed_doc_ids):
        click.echo(f"{doc_id!r} has no citation node (no DOI enriched?).", err=True)
        sys.exit(1)

    weights: dict | None = None
    embed_scores_by_doc: dict[str, float] | None = None
    if signal == "fused":
        weights = dict(_FUSED_WEIGHTS)
        if has_doc_vectors(model):
            embed_scores_by_doc = embedding_scores(model, list(seed_doc_ids))
        else:
            weights["w_embedding"] = 0.0

    results = related_to_docs(
        db, [doc_id], top=top, graph=graph,
        weights=weights, embed_scores_by_doc=embed_scores_by_doc,
    )
    rows = [
        {
            "doc_id": r.doc_id,
            "score": round(r.score, 4),
            "ppr": round(r.ppr, 4),
            "ppr_fwd": round(r.ppr_fwd, 4),
            "ppr_bwd": round(r.ppr_bwd, 4),
            "coupling": round(r.coupling, 3),
            "co_citation": round(r.cocitation, 3),
            "embedding": round(r.embedding, 3),
            "citation_prior": round(r.prior, 2),
            "shared_references": r.shared_refs,
            "shared_citations": r.shared_citations,
        }
        for r in results
    ]
    db.close()
    if as_json:
        click.echo(json.dumps({"seed": doc_id, "signal": signal, "model": model, "related": rows}, indent=2))
        return
    for i, r in enumerate(rows, 1):
        why = []
        if r["shared_references"]:
            why.append(f"{r['shared_references']} shared refs")
        if r["shared_citations"]:
            why.append(f"{r['shared_citations']} co-citations")
        if r["embedding"]:
            why.append(f"emb {r['embedding']:.2f}")
        click.echo(f"{i:2d}. [{r['score']:.3f}] {r['doc_id']}  ({', '.join(why) or 'PPR'})")


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
@click.option(
    "--max-per-doc",
    default=2,
    show_default=True,
    type=click.IntRange(min=1),
    help="Maximum evidence passages retained for each canonical paper.",
)
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
@click.option(
    "--expand",
    type=click.Choice(["off", "auto", "force"]),
    default="off",
    show_default=True,
    help="LLM query expansion (multi-query + step-back) for vague queries. "
    "auto = only when the query looks vague/under-served; force = always.",
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
    expand: str,
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
            expand=expand,
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
