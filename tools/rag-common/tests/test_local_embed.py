from unittest.mock import MagicMock, patch

import pytest

from rag_common.config import EmbedConfig, use_cuda_bnb_4bit
from rag_common.local_embed import (
    _cuda_batch_size,
    resolve_local_embed_device,
)


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_DEVICE": "cuda"}, clear=True)
def test_resolve_device_explicit_cuda():
    assert resolve_local_embed_device("Qwen/Qwen3-Embedding-0.6B") == "cuda"


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_DEVICE": "cpu"}, clear=True)
def test_resolve_device_explicit_cpu():
    assert resolve_local_embed_device("Qwen/Qwen3-Embedding-0.6B") == "cpu"


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_DEVICE": "auto"}, clear=True)
@patch("rag_common.local_embed.platform.system", return_value="Linux")
def test_resolve_device_auto_cuda_on_linux(_mock_system):
    fake_torch = MagicMock()
    fake_torch.cuda.is_available.return_value = True
    with patch.dict("sys.modules", {"torch": fake_torch}):
        assert resolve_local_embed_device("Qwen/Qwen3-Embedding-0.6B") == "cuda"


@patch.dict("os.environ", {"RAG_CUDA_BATCH_SIZE": "16"}, clear=True)
def test_cuda_batch_size():
    assert _cuda_batch_size() == 16


@patch.dict("os.environ", {}, clear=True)
@patch("rag_common.config.platform.system", return_value="Linux")
def test_use_cuda_bnb_4bit_when_cuda_available(_mock_system):
    fake_torch = MagicMock()
    fake_torch.cuda.is_available.return_value = True
    with patch.dict("sys.modules", {"torch": fake_torch}):
        cfg = EmbedConfig(
            backend="local",
            model="Qwen/Qwen3-Embedding-0.6B",
            dimensions=1024,
            quant="4bit",
        )
        assert use_cuda_bnb_4bit(cfg) is True


@patch.dict("os.environ", {}, clear=True)
@patch("rag_common.config.platform.system", return_value="Darwin")
def test_use_cuda_bnb_4bit_false_on_darwin(_mock_system):
    cfg = EmbedConfig(
        backend="local",
        model="Qwen/Qwen3-Embedding-0.6B",
        dimensions=1024,
        quant="4bit",
    )
    assert use_cuda_bnb_4bit(cfg) is False


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_DEVICE": "cuda", "RAG_CUDA_BATCH_SIZE": "16"}, clear=True)
@patch("rag_common.local_embed.use_cuda_bnb_4bit", return_value=False)
@patch("rag_common.local_embed._get_model_for_config")
def test_embed_local_uses_cuda_batch(mock_get_model, _mock_bnb):
    import numpy as np

    from rag_common.local_embed import embed_local_texts

    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([[0.1, 0.2, 0.3]])
    mock_get_model.return_value = mock_model

    cfg = EmbedConfig(
        backend="local",
        model="Qwen/Qwen3-Embedding-0.6B",
        dimensions=1024,
        profile="cuda-qwen0.6b-1024",
    )
    vectors = embed_local_texts(["hello"], config=cfg)
    assert len(vectors) == 1
    mock_model.encode.assert_called_once()
    call_kwargs = mock_model.encode.call_args.kwargs
    assert call_kwargs["batch_size"] == 16
    assert call_kwargs["device"] == "cuda"
