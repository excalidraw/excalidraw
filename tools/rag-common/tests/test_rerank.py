from unittest.mock import patch

from rag_common.rerank import rerank, rerank_enabled


def _rows():
    return [
        {"id": "a", "text": "stress majorization neato layout"},
        {"id": "b", "text": "network simplex rank assignment"},
        {"id": "c", "text": "force directed spring embedder"},
    ]


def test_rerank_enabled_env():
    with patch.dict("os.environ", {"RAG_RERANK_ENABLED": "true"}, clear=True):
        assert rerank_enabled()
    with patch.dict("os.environ", {}, clear=True):
        assert not rerank_enabled()


def test_rerank_disabled_is_passthrough_slice():
    rows = _rows()
    out = rerank("ranking", rows, top=2, enabled=False)
    assert [r["id"] for r in out] == ["a", "b"]
    assert all("rerank_score" not in r for r in out)


def test_rerank_single_candidate_noop():
    rows = _rows()[:1]
    out = rerank("ranking", rows, top=5, enabled=True)
    assert [r["id"] for r in out] == ["a"]


def test_rerank_model_load_failure_degrades():
    rows = _rows()
    with patch("rag_common.rerank._get_cross_encoder", side_effect=RuntimeError("no model")):
        out = rerank("ranking", rows, top=2, enabled=True)
    assert [r["id"] for r in out] == ["a", "b"]


def test_rerank_orders_by_cross_encoder_score():
    rows = _rows()

    class _FakeModel:
        def predict(self, pairs):
            # Score so that "c" > "a" > "b" regardless of input order.
            order = {"force": 0.9, "stress": 0.5, "network": 0.1}
            out = []
            for _q, text in pairs:
                out.append(next((v for k, v in order.items() if k in text), 0.0))
            return out

    with patch("rag_common.rerank._get_cross_encoder", return_value=_FakeModel()):
        out = rerank("graph layout", rows, top=2, enabled=True)
    assert [r["id"] for r in out] == ["c", "a"]
    assert out[0]["rerank_score"] == 0.9
