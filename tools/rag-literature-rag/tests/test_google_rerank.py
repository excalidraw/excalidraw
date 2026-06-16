from unittest.mock import Mock, patch

from rag_literature_rag.eval.google_rerank import rerank_google


def test_google_rerank_requires_cost_opt_in():
    with patch.dict("os.environ", {}, clear=True):
        try:
            rerank_google("q", [{"id": "a", "text": "x"}], top=1, model="m")
        except RuntimeError as exc:
            assert "allow-cloud-cost" in str(exc)
        else:
            raise AssertionError("expected cost opt-in failure")


def test_google_rerank_orders_api_records(tmp_path):
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"records": [{"id": "b"}, {"id": "a"}]}
    rows = [{"id": "a", "text": "a"}, {"id": "b", "text": "b"}]
    env = {
        "RAG_LIT_ALLOW_CLOUD_COST": "true",
        "RAG_LIT_GOOGLE_RANKING_CACHE": str(tmp_path / "cache.json"),
        "GOOGLE_CLOUD_PROJECT": "project",
    }
    with patch.dict("os.environ", env, clear=True), patch(
        "rag_literature_rag.eval.google_rerank._access_token",
        return_value="token",
    ), patch("rag_literature_rag.eval.google_rerank.httpx.post", return_value=response):
        out = rerank_google("q", rows, top=2, model="m")
    assert [row["id"] for row in out] == ["b", "a"]
