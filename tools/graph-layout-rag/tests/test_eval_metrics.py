from graph_layout_rag.eval.metrics import aggregate_metrics, case_metrics, per_category_metrics


def test_case_metrics_binary_ndcg():
    results = [
        {"doc_id": "a"},
        {"doc_id": "a"},
        {"doc_id": "b"},
    ]
    metrics = case_metrics(results, {"a", "b"})
    assert metrics["hit_rate@5"] == 1.0
    assert metrics["recall@5"] == 1.0
    assert metrics["mrr"] == 1.0
    assert metrics["map@10"] <= 1.0
    assert metrics["ndcg@10"] <= 1.0


def test_case_metrics_miss():
    results = [{"doc_id": "x"}, {"doc_id": "y"}]
    metrics = case_metrics(results, {"a"})
    assert metrics["hit_rate@10"] == 0.0
    assert metrics["recall@10"] == 0.0
    assert metrics["mrr"] == 0.0


def test_case_metrics_distinguishes_hit_rate_from_true_recall():
    metrics = case_metrics([{"doc_id": "a"}], {"a", "b"})
    assert metrics["hit_rate@5"] == 1.0
    assert metrics["recall@5"] == 0.5


def test_aggregate_and_category_metrics():
    rows = [
        {"category": "compound", "mrr": 1.0, "map@10": 1.0, "ndcg@10": 1.0, "hit_rate@5": 1.0, "hit_rate@10": 1.0, "hit_rate@20": 1.0, "recall@5": 1.0, "recall@10": 1.0, "recall@20": 1.0},
        {"category": "compound", "mrr": 0.5, "map@10": 0.5, "ndcg@10": 0.5, "hit_rate@5": 1.0, "hit_rate@10": 1.0, "hit_rate@20": 1.0, "recall@5": 1.0, "recall@10": 1.0, "recall@20": 1.0},
        {"category": "routing", "mrr": 0.0, "map@10": 0.0, "ndcg@10": 0.0, "hit_rate@5": 0.0, "hit_rate@10": 0.0, "hit_rate@20": 0.0, "recall@5": 0.0, "recall@10": 0.0, "recall@20": 0.0},
    ]
    agg = aggregate_metrics(rows)
    assert agg["mrr"] == 0.5
    by_cat = per_category_metrics(rows)
    assert by_cat["compound"]["mrr"] == 0.75
    assert by_cat["routing"]["mrr"] == 0.0
