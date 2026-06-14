from __future__ import annotations

import math

from repo_rag.eval import _is_relevant, _query_metrics


def test_is_relevant_path_contains():
    item = {"expect_path_contains": ["pipeline", "terraformTopology"]}
    assert _is_relevant({"file_path": "components/terraformTopology.ts"}, item)
    assert _is_relevant({"file_path": "a/pipeline/b.ts"}, item)
    assert not _is_relevant({"file_path": "components/binding.ts"}, item)


def test_is_relevant_source_type_and_combined():
    assert _is_relevant({"source_type": "handoff"}, {"expect_source_type": "handoff"})
    assert not _is_relevant({"source_type": "code"}, {"expect_source_type": "handoff"})
    # Both expectations must hold.
    item = {"expect_path_contains": ["pipeline"], "expect_source_type": "terraform"}
    assert _is_relevant({"file_path": "x/pipeline.ts", "source_type": "terraform"}, item)
    assert not _is_relevant({"file_path": "x/pipeline.ts", "source_type": "code"}, item)


def test_is_relevant_unjudged_is_false():
    assert not _is_relevant({"file_path": "anything.ts", "source_type": "code"}, {})


def test_query_metrics_first_position():
    item = {"expect_path_contains": ["good"]}
    results = [{"file_path": "good.ts"}, {"file_path": "bad.ts"}]
    m = _query_metrics(results, item, k=10)
    assert m["hit"] == 1.0
    assert m["rr"] == 1.0
    assert m["first_rank"] == 1
    assert m["ndcg"] == 1.0


def test_query_metrics_second_position():
    item = {"expect_path_contains": ["good"]}
    results = [{"file_path": "bad.ts"}, {"file_path": "good.ts"}]
    m = _query_metrics(results, item, k=10)
    assert m["rr"] == 0.5
    assert m["first_rank"] == 2
    # One relevant at rank 2: DCG = 1/log2(3), IDCG = 1/log2(2) = 1.
    assert math.isclose(m["ndcg"], 1.0 / math.log2(3), rel_tol=1e-3)


def test_query_metrics_no_hit():
    item = {"expect_path_contains": ["good"]}
    results = [{"file_path": "bad.ts"}, {"file_path": "worse.ts"}]
    m = _query_metrics(results, item, k=10)
    assert m == {"hit": 0.0, "rr": 0.0, "ndcg": 0.0, "first_rank": 0}


def test_query_metrics_cutoff_excludes_late_hit():
    item = {"expect_path_contains": ["good"]}
    results = [{"file_path": "bad.ts"}, {"file_path": "good.ts"}]
    m = _query_metrics(results, item, k=1)
    assert m["hit"] == 0.0
