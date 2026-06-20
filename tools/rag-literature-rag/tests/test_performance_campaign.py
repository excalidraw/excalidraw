from rag_literature_rag.eval import performance_campaign as pc


def test_campaign_plan_payload_locks_gate_and_matrix():
    payload = pc.campaign_plan_payload(
        baseline_profile="cuda-qwen0.6b-1024",
        candidate_profiles=("cuda-qwen0.6b-longrag-v1",),
        passes=3,
        strategies=("dense", "hybrid"),
        stages=("health", "baseline"),
    )

    assert payload["baseline_profile"] == "cuda-qwen0.6b-1024"
    assert payload["passes"] == 3
    assert payload["promotion_gate"]["hole_at_10_required"] == 0.0
    assert payload["promotion_gate"]["default_profile_promotion_allowed"] is False
    assert payload["matrix"] == [
        {"stage": "baseline-current", "profile": "cuda-qwen0.6b-1024"},
        {"stage": "repair-only", "profile": "cuda-qwen0.6b-1024"},
        {"stage": "repair+cuda-qwen0.6b-longrag-v1", "profile": "cuda-qwen0.6b-longrag-v1"},
    ]


def test_summarize_benchmark_reports_repaired_and_unrelated_slices():
    payload = {
        "embed_profile": "profile",
        "tracks_tested": ["catalog"],
        "strategies_tested": ["hybrid"],
        "results": [
            {
                "track": "catalog",
                "strategy": "hybrid",
                "ndcg@10": 0.7,
                "mrr": 0.8,
                "recall@10": 0.9,
                "hit_rate@10": 1.0,
                "latency_ms_p95": 123,
                "failures": [],
                "cases": [
                    {
                        "id": "repair-case",
                        "relevant_doc_ids": ["doc-a"],
                        "ndcg@10": 1.0,
                        "mrr": 1.0,
                        "recall@10": 1.0,
                        "hit_rate@10": 1.0,
                    },
                    {
                        "id": "unrelated-case",
                        "relevant_doc_ids": ["doc-z"],
                        "ndcg@10": 0.4,
                        "mrr": 0.6,
                        "recall@10": 0.8,
                        "hit_rate@10": 1.0,
                    },
                ],
            }
        ],
    }

    summary = pc.summarize_benchmark(payload, repaired_doc_ids={"doc-a"})
    row = summary["rows"][0]

    assert row["repaired_doc_slice"]["cases"] == 1
    assert row["repaired_doc_slice"]["ndcg@10"] == 1.0
    assert row["excluding_repaired_doc_slice"]["cases"] == 1
    assert row["excluding_repaired_doc_slice"]["ndcg@10"] == 0.4
