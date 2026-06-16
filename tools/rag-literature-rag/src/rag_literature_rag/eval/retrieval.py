from __future__ import annotations

import json
from statistics import mean

import click

from rag_literature_rag.eval.benchmark import evaluate_strategy
from rag_literature_rag.eval.gold_cases import gold_cases
from rag_literature_rag.eval.strategies import DenseStrategy, HybridRerankStrategy, HybridStrategy


def evaluate_mode(*, embed_profile: str, mode: str) -> dict:
    strategy_map = {
        "dense": DenseStrategy(),
        "hybrid": HybridStrategy(),
        "reranked": HybridRerankStrategy(),
    }
    strategy = strategy_map[mode]
    payload = evaluate_strategy(strategy, embed_profile=embed_profile, top=20)
    payload["mode"] = mode
    return payload


@click.command("retrieval")
@click.option("--embed-profile", required=True)
@click.option(
    "--mode",
    "modes",
    type=click.Choice(["dense", "hybrid", "reranked"]),
    multiple=True,
    help="Mode(s) to compare; defaults to all.",
)
@click.option("--json", "as_json", is_flag=True)
def retrieval_eval_cmd(embed_profile: str, modes: tuple[str, ...], as_json: bool) -> None:
    """Evaluate deterministic graph-layout retrieval cases."""
    selected = modes or ("dense", "hybrid", "reranked")
    payload = {
        "profile": embed_profile,
        "case_count": len(gold_cases()),
        "results": [evaluate_mode(embed_profile=embed_profile, mode=mode) for mode in selected],
    }
    if as_json:
        click.echo(json.dumps(payload, indent=2))
    else:
        for row in payload["results"]:
            click.echo(
                f"{row['mode']}: R@5={row['recall@5']:.3f} MRR={row['mrr']:.3f} "
                f"nDCG@10={row['ndcg@10']:.3f} latency={row['latency_ms_mean']:.0f}ms"
            )
