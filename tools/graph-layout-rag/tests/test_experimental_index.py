from graph_layout_rag.eval.encode_device import fastembed_kwargs, resolve_encode_device
from graph_layout_rag.eval.experimental_index import (
    DEFAULT_MODELS,
    _clean_payload,
    _sparse_backend,
)
from graph_layout_rag.eval.splade_v3_encoder import PYTORCH_SPARSE_MODELS, is_pytorch_sparse_model


def test_experimental_models_are_pinned():
    assert DEFAULT_MODELS["splade"] == "prithivida/Splade_PP_en_v1"
    assert DEFAULT_MODELS["colbert"] == "answerdotai/answerai-colbert-small-v1"


def test_clean_payload_converts_nan_to_none():
    payload = _clean_payload({"year": float("nan"), "title": "x"})
    assert payload == {"year": None, "title": "x"}


def test_pytorch_sparse_model_detection():
    assert is_pytorch_sparse_model("naver/splade-v3")
    assert is_pytorch_sparse_model("naver/splade-v3-distilbert")
    assert not is_pytorch_sparse_model("prithivida/Splade_PP_en_v1")
    assert _sparse_backend("naver/splade-v3") == "pytorch_sparse"
    assert _sparse_backend("prithivida/Splade_PP_en_v1") == "fastembed"


def test_resolve_encode_device_defaults_cpu_without_cuda(monkeypatch):
    monkeypatch.delenv("GRAPH_RAG_FASTEMBED_CUDA", raising=False)
    monkeypatch.setenv("GRAPH_RAG_ENCODE_DEVICE", "cpu")
    assert resolve_encode_device() == "cpu"
    assert fastembed_kwargs("cpu") == {}


def test_pytorch_sparse_models_include_v3_variants():
    assert "naver/splade-v3" in PYTORCH_SPARSE_MODELS
    assert "naver/splade-v3-distilbert" in PYTORCH_SPARSE_MODELS
