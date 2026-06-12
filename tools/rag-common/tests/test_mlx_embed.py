from unittest.mock import MagicMock, patch

import pytest

from rag_common.config import EmbedConfig, local_embed_quant, mlx_q4_model_id, use_mlx_q4_embed
from rag_common.local_embed import embed_local_texts


@patch.dict(
    "os.environ",
    {
        "RAG_EMBED_BACKEND": "local",
        "RAG_LOCAL_EMBED_MODEL": "Qwen/Qwen3-Embedding-4B",
        "RAG_LOCAL_EMBED_QUANT": "4bit",
    },
    clear=True,
)
@patch("rag_common.mlx_embed.embed_mlx_q4_texts", return_value=[[0.1, 0.2]])
def test_local_embed_routes_to_mlx_q4(mock_mlx_embed):
    from rag_common.config import local_config

    cfg = local_config()
    vectors = embed_local_texts(["hello"], config=cfg)
    assert vectors == [[0.1, 0.2]]
    mock_mlx_embed.assert_called_once()


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_QUANT": "4bit"}, clear=True)
def test_use_mlx_q4_requires_darwin():
    with patch("rag_common.config.platform.system", return_value="Linux"):
        assert use_mlx_q4_embed("Qwen/Qwen3-Embedding-4B") is False


@patch.dict("os.environ", {}, clear=True)
def test_profile_quant_overrides_env():
    cfg = EmbedConfig(
        backend="local",
        model="Qwen/Qwen3-Embedding-4B",
        dimensions=1024,
        profile="mlx-qwen4b",
        quant="4bit",
    )
    assert local_embed_quant(cfg) == "4bit"
    with patch("rag_common.config.platform.system", return_value="Darwin"):
        assert use_mlx_q4_embed(cfg.model, cfg) is True


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_QUANT": "4bit"}, clear=True)
def test_mlx_q4_model_mapping():
    with patch("rag_common.config.platform.system", return_value="Darwin"):
        assert use_mlx_q4_embed("Qwen/Qwen3-Embedding-4B") is True
    assert mlx_q4_model_id("Qwen/Qwen3-Embedding-4B") == "majentik/Qwen3-Embedding-4B-MLX-4bit"


@patch.dict("os.environ", {"RAG_LOCAL_EMBED_QUANT": "off"}, clear=True)
def test_quant_off_uses_sentence_transformers():
    with patch("rag_common.config.platform.system", return_value="Darwin"):
        assert use_mlx_q4_embed("Qwen/Qwen3-Embedding-4B") is False
