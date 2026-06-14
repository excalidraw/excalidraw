"""Retrieval-quality evaluation for repo-rag.

Computes ranking metrics (Hit@k, MRR, nDCG@k) plus latency over the judged query
set in ``eval/queries.json``. Relevance is judged from each query's
``expect_path_contains`` (any substring matches the result ``file_path``) and/or
``expect_source_type`` (matches the result ``source_type``) — a lightweight,
labeling-free proxy that is stable enough to compare retrieval variants
(e.g. cross-encoder reranking on vs off) via ``--compare``.
"""

from __future__ import annotations

import json
import math
import time
from typing import Any

from repo_rag.paths import EVAL_QUERIES_PATH
from repo_rag.query.search import search


def _load_queries(limit: int | None) -> list[dict[str, Any]]:
    raw = json.loads(EVAL_QUERIES_PATH.read_text(encoding="utf-8"))
    queries = raw if isinstance(raw, list) else raw.get("queries", [])
    items = [q if isinstance(q, dict) else {"query": q} for q in queries]
    return items[:limit] if limit else items


def _is_relevant(result: dict[str, Any], item: dict[str, Any]) -> bool:
    """A result is relevant when it satisfies every expectation the query declares."""
    expect_paths = item.get("expect_path_contains") or []
    expect_type = item.get("expect_source_type")
    if expect_paths:
        fp = result.get("file_path") or ""
        if not any(token in fp for token in expect_paths):
            return False
    if expect_type and result.get("source_type") != expect_type:
        return False
    # A query with no expectations cannot be judged; treat nothing as relevant.
    return bool(expect_paths or expect_type)


def _query_metrics(results: list[dict[str, Any]], item: dict[str, Any], k: int) -> dict[str, float]:
    rels = [_is_relevant(r, item) for r in results[:k]]
    first_rank = next((i + 1 for i, rel in enumerate(rels) if rel), 0)
    hit = 1.0 if first_rank else 0.0
    rr = 1.0 / first_rank if first_rank else 0.0

    dcg = sum(1.0 / math.log2(i + 2) for i, rel in enumerate(rels) if rel)
    n_rel = sum(1 for rel in rels if rel)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(n_rel))
    ndcg = dcg / idcg if idcg else 0.0

    return {"hit": hit, "rr": rr, "ndcg": round(ndcg, 4), "first_rank": first_rank}


def benchmark(limit: int | None = None, *, k: int = 10, rerank: bool | None = None) -> dict:
    """Run the judged query set once; return per-query + aggregate metrics."""
    queries = _load_queries(limit)
    rows: list[dict[str, Any]] = []
    for item in queries:
        query = item.get("query", item.get("text", ""))
        started = time.monotonic()
        results = search(query, top=k, rerank=rerank)
        latency_ms = round((time.monotonic() - started) * 1000, 2)
        metrics = _query_metrics(results, item, k)
        rows.append(
            {
                "query": query,
                "latency_ms": latency_ms,
                "results": len(results),
                "judged": bool(item.get("expect_path_contains") or item.get("expect_source_type")),
                **metrics,
                "top_files": [r.get("file_path") for r in results[:5]],
            }
        )

    judged = [r for r in rows if r["judged"]]
    n = len(judged) or 1
    aggregate = {
        "queries": len(rows),
        "judged_queries": len(judged),
        "k": k,
        "rerank": rerank,
        "hit_rate": round(sum(r["hit"] for r in judged) / n, 4),
        "mrr": round(sum(r["rr"] for r in judged) / n, 4),
        "ndcg": round(sum(r["ndcg"] for r in judged) / n, 4),
        "mean_latency_ms": round(sum(r["latency_ms"] for r in rows) / (len(rows) or 1), 2),
    }
    return {**aggregate, "results": rows}


def compare(limit: int | None = None, *, k: int = 10) -> dict:
    """Run the benchmark with reranking off vs on and report the metric delta."""
    off = benchmark(limit, k=k, rerank=False)
    on = benchmark(limit, k=k, rerank=True)
    keys = ("hit_rate", "mrr", "ndcg", "mean_latency_ms")
    delta = {key: round(on[key] - off[key], 4) for key in keys}
    return {
        "k": k,
        "metrics": {
            "no_rerank": {key: off[key] for key in keys},
            "rerank": {key: on[key] for key in keys},
            "delta": delta,
        },
        "no_rerank": off,
        "rerank": on,
    }
