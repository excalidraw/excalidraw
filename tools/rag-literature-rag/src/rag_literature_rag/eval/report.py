from __future__ import annotations

from pathlib import Path
from typing import Any


def _metric_table(results: list[dict[str, Any]]) -> str:
    header = (
        "| Track | Strategy | HR@5 | R@5 | R@10 | MAP@10 | MRR | nDCG@10 | p95 ms | Peak GB | Cost | Failures |\n"
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n"
    )
    rows = []
    for row in sorted(results, key=lambda item: (-item["mrr"], -item["ndcg@10"])):
        rows.append(
            f"| `{row.get('track', 'catalog')}` | `{row['strategy']}` | "
            f"{row['hit_rate@5']:.3f} | {row['recall@5']:.3f} | {row['recall@10']:.3f} | "
            f"{row['map@10']:.3f} | {row['mrr']:.3f} | {row['ndcg@10']:.3f} | "
            f"{row['latency_ms_p95']:.0f} | {row.get('peak_process_rss_gb', 0):.2f} | "
            f"${row.get('estimated_cloud_cost_usd', 0):.3f} | "
            f"{len(row['failures'])} |"
        )
    return header + "\n".join(rows) + "\n"


def _category_table(best: dict[str, Any]) -> str:
    per_category = best.get("per_category") or {}
    if not per_category:
        return "_No per-category breakdown._\n"

    lines = [
        "| Category | MRR | nDCG@10 | R@10 |\n",
        "| --- | ---: | ---: | ---: |\n",
    ]
    for category, metrics in sorted(per_category.items()):
        lines.append(
            f"| `{category}` | {metrics['mrr']:.3f} | {metrics['ndcg@10']:.3f} | "
            f"{metrics['recall@10']:.3f} |\n"
        )
    return "".join(lines)


def _failure_section(results: list[dict[str, Any]], *, limit: int = 15) -> str:
    lines = ["## Failure analysis\n"]
    for row in results:
        if not row["failures"]:
            continue
        lines.append(f"### `{row['strategy']}`\n")
        for failure in row["failures"][:limit]:
            lines.append(
                f"- **{failure['id']}**: expected `{failure['relevant_doc_ids']}`; "
                f"got `{failure['top_doc_ids'][:5]}`\n"
            )
        if len(row["failures"]) > limit:
            lines.append(f"- _… {len(row['failures']) - limit} more_\n")
    return "".join(lines)


def render_markdown_report(payload: dict[str, Any]) -> str:
    results = payload["results"]
    completed = [row for row in results if "mrr" in row]
    if not completed:
        return "# RAG Literature — Retrieval Evaluation Report\n\n_No strategies completed._\n"
    best = max(completed, key=lambda row: (row["mrr"], row["ndcg@10"], row["recall@10"]))
    offline = [row for row in completed if not row["requires_llm"]]
    llm = [row for row in completed if row["requires_llm"]]
    interactive = [
        row
        for row in completed
        if row["latency_ms_p95"] <= 2000 and row.get("peak_process_rss_gb", 0) <= 8
    ]
    balanced = [
        row
        for row in completed
        if row["latency_ms_p95"] <= 4000 and row.get("peak_process_rss_gb", 0) <= 10
    ]
    best_interactive = max(interactive, key=lambda row: row["ndcg@10"], default=None)
    best_balanced = max(balanced, key=lambda row: row["ndcg@10"], default=None)

    parts = [
        "# RAG Literature — Retrieval Evaluation Report\n\n",
        f"Generated: {payload['generated_at']}\n\n",
        "## Executive summary\n\n",
        f"- **Index profile:** `{payload['embed_profile']}`\n",
        f"- **Gold cases by track:** `{payload.get('case_count_by_track', {})}`\n",
        f"- **Best overall strategy:** `{best['strategy']}` "
        f"(MRR={best['mrr']:.3f}, nDCG@10={best['ndcg@10']:.3f}, "
        f"R@10={best['recall@10']:.3f})\n",
        "- **Recommended agent default:** `hybrid` using dense + BM25 with RRF k=60. "
        "Local reranking remains off because it reduced quality and increased memory pressure.\n\n",
        "## Hardware-aligned recommendations\n\n",
        f"- **Interactive:** `{best_interactive['strategy'] if best_interactive else 'none'}` "
        "(p95 <=2s, peak RSS <=8 GB)\n",
        f"- **Balanced:** `{best_balanced['strategy'] if best_balanced else 'none'}` "
        "(p95 <=4s, peak RSS <=10 GB)\n",
        f"- **Maximum quality under hard limits:** `{best['strategy']}`\n\n",
        "## SOTA patterns reviewed\n\n",
        "| Pattern | Role in this corpus |\n",
        "| --- | --- |\n",
        "| Hybrid BM25 + dense + RRF | Captures exact method names (ColBERT, Self-RAG, RRF, HyDE, REPLUG) |\n",
        "| Cross-encoder rerank | Improves precision from a wide candidate pool |\n",
        "| Category / pdf_only filters | Best precision for specific RAG sub-topic threads |\n",
        "| Multi-query expansion | Helps ambiguous research phrasing; may add noise on precise terms |\n",
        "| HyDE | Hypothetical passage embedding for vague exploratory queries |\n",
        "| Step-back | Broader abstraction for over-specific factual queries |\n\n",
        "## Methodology\n\n",
        f"- Top-k evaluated: {payload['top']}\n",
        f"- LLM transforms enabled: {payload['llm_transforms']}\n",
        "- Metrics: doc-level hit-rate@k, true recall@k, MAP@10, MRR, and nDCG@10\n",
        "- Strategies tested: "
        + ", ".join(f"`{name}`" for name in payload["strategies_tested"])
        + "\n\n",
        "## Results\n\n",
        _metric_table(completed),
        "\n",
    ]

    if offline:
        parts.append("### Offline strategies\n\n")
        parts.append(_metric_table(offline))
        parts.append("\n")

    if llm:
        parts.append("### LLM query transforms\n\n")
        parts.append(_metric_table(llm))
        parts.append("\n")

    parts.extend(
        [
            f"### Per-category breakdown (`{best['strategy']}`)\n\n",
            _category_table(best),
            "\n",
            _failure_section(results),
            "## Agent playbook\n\n",
            "```bash\n",
            "# Default RAG-literature research query\n",
            "yarn rag-lit:query \"Self-RAG reflection tokens\" \\\n",
            "  --embed-profile gemini-2-structure-v1 --json\n\n",
            "# Run offline benchmark\n",
            "yarn rag-lit:eval -- --embed-profile gemini-2-structure-v1\n\n",
            "# Full benchmark including LLM transforms\n",
            "yarn rag-lit:eval -- --embed-profile gemini-2-structure-v1 --llm-transforms\n",
            "```\n\n",
            "## Limitations and next steps\n\n",
            "- Gold labels are manually curated for ~30 cases; expand toward 50+ for regression testing.\n",
            "- Tag/category filters run post-fusion; push selective filters into LanceDB prefilters.\n",
            "- LLM transforms add latency and depend on Vertex availability; cache lives in `data/eval/transform_cache.json`.\n",
            "- Consider parent-child chunking or RAPTOR if multi-hop synthesis quality becomes a bottleneck.\n",
        ]
    )
    return "".join(parts)


def write_markdown_report(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_markdown_report(payload) + "\n", encoding="utf-8")
