from unittest.mock import MagicMock, patch

import pytest
from openai import AuthenticationError

from rag_common.config import EmbedConfig, local_config, openai_config
from rag_common.embed import embed_texts, finalize_embed_config, resolve_embed_config
from rag_common.openai_embed import OpenAIFatalError, truncate_to_token_limit


def test_truncate_disallowed_special_tokens():
    text = "section about <|endofprompt|> markers"
    assert truncate_to_token_limit(text, limit=100) == text


@patch.dict("os.environ", {}, clear=True)
def test_auto_no_key_uses_local():
    cfg = resolve_embed_config()
    assert cfg.backend == "local"
    assert cfg.dimensions == 384


@patch.dict("os.environ", {"RAG_EMBED_BACKEND": "local"}, clear=True)
def test_explicit_local():
    cfg = resolve_embed_config()
    assert cfg.backend == "local"


@patch.dict("os.environ", {"RAG_EMBED_BACKEND": "openai"}, clear=True)
def test_explicit_openai_requires_key():
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        resolve_embed_config()


@patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key", "RAG_EMBED_BACKEND": "auto"}, clear=True)
@patch("rag_common.openai_embed.OpenAI")
def test_finalize_probe_auth_failure_falls_back(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.embeddings.create.side_effect = AuthenticationError(
        "bad key",
        response=MagicMock(status_code=401),
        body={"error": {"message": "Incorrect API key"}},
    )
    cfg = finalize_embed_config(openai_config())
    assert cfg.backend == "local"


@patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=True)
@patch("rag_common.openai_embed.OpenAI")
def test_embed_openai_success(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=[0.1] * 3072)]
    mock_response.usage = MagicMock(total_tokens=10)
    mock_client.embeddings.create.return_value = mock_response

    cfg = openai_config()
    vectors = embed_texts(
        ["hello"],
        config=cfg,
        allow_fallback=False,
        probe=False,
    )
    assert len(vectors) == 1
    assert len(vectors[0]) == 3072


@patch.dict("os.environ", {"RAG_EMBED_BACKEND": "local"}, clear=True)
@patch("rag_common.local_embed.SentenceTransformer")
def test_embed_local(mock_st_cls):
    mock_model = MagicMock()
    mock_st_cls.return_value = mock_model
    import numpy as np

    mock_model.encode.return_value = np.array([[0.1, 0.2, 0.3]])

    cfg = local_config()
    vectors = embed_texts(["hello"], config=cfg, allow_fallback=False)
    assert len(vectors) == 1
    assert len(vectors[0]) == 3


@patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=True)
@patch("rag_common.openai_embed.MAX_RETRIES", 1)
@patch("rag_common.embed.embed_local_texts", return_value=[[0.1, 0.2, 0.3, 0.4]])
@patch("rag_common.openai_embed.OpenAI")
def test_embed_openai_fatal_falls_back_to_local(mock_openai_cls, mock_local_embed):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.embeddings.create.side_effect = Exception("Error code: 429 rate_limit_exceeded")

    cfg = openai_config()
    vectors = embed_texts(["hello"], config=cfg, allow_fallback=True, probe=False)
    assert len(vectors) == 1
    mock_local_embed.assert_called_once()
