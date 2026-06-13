from __future__ import annotations

import math
from collections import Counter
from statistics import mean
from typing import Any, Iterable, Mapping, Sequence


def doc_ids_from_results(results: Sequence[Mapping[str, Any]]) -> list[str]:
    return [str(row.get("doc_id") or "") for row in results]


def case_metrics(
    results: Sequence[Mapping[str, Any]],
    relevant: set[str] | frozenset[str],
) -> dict[str, float]:
    ids = doc_ids_from_results(results)
    relevant_set = set(relevant)
    first = next((idx + 1 for idx, doc_id in enumerate(ids) if doc_id in relevant_set), None)

    seen_relevant: set[str] = set()
    dcg = 0.0
    precision_sum = 0.0
    for idx, doc_id in enumerate(ids[:10]):
        if doc_id in relevant_set and doc_id not in seen_relevant:
            dcg += 1.0 / math.log2(idx + 2)
            seen_relevant.add(doc_id)
            precision_sum += len(seen_relevant) / (idx + 1)

    ideal = sum(1.0 / math.log2(idx + 2) for idx in range(min(len(relevant_set), 10)))
    unique_ids = list(dict.fromkeys(ids))

    def hit_rate(k: int) -> float:
        return float(bool(relevant_set & set(unique_ids[:k])))

    def recall(k: int) -> float:
        if not relevant_set:
            return 0.0
        return len(relevant_set & set(unique_ids[:k])) / len(relevant_set)

    return {
        "hit_rate@5": hit_rate(5),
        "hit_rate@10": hit_rate(10),
        "hit_rate@20": hit_rate(20),
        "recall@5": recall(5),
        "recall@10": recall(10),
        "recall@20": recall(20),
        "mrr": 1.0 / first if first else 0.0,
        "map@10": precision_sum / min(len(relevant_set), 10) if relevant_set else 0.0,
        "ndcg@10": dcg / ideal if ideal else 0.0,
    }


def aggregate_metrics(
    case_rows: Sequence[Mapping[str, Any]],
    metric_names: Iterable[str] = (
        "hit_rate@5",
        "hit_rate@10",
        "hit_rate@20",
        "recall@5",
        "recall@10",
        "recall@20",
        "mrr",
        "map@10",
        "ndcg@10",
    ),
) -> dict[str, float]:
    names = list(metric_names)
    return {
        name: round(mean(row[name] for row in case_rows), 6)
        for name in names
    }


def per_category_metrics(
    case_rows: Sequence[Mapping[str, Any]],
    *,
    category_key: str = "category",
) -> dict[str, dict[str, float]]:
    by_category: dict[str, list[dict[str, Any]]] = {}
    for row in case_rows:
        category = row.get(category_key) or "uncategorized"
        by_category.setdefault(str(category), []).append(dict(row))
    return {
        category: aggregate_metrics(rows)
        for category, rows in sorted(by_category.items())
    }


def crowding_and_duplicates(
    results: Sequence[Mapping[str, Any]],
    *,
    expected_count: int,
) -> tuple[float, float]:
    counts = Counter(str(row.get("doc_id") or "") for row in results)
    crowding = float(max(counts.values(), default=0))
    shas = [row.get("canonical_sha256") for row in results if row.get("canonical_sha256")]
    duplicate_rate = (len(shas) - len(set(shas))) / max(1, expected_count)
    return crowding, duplicate_rate
