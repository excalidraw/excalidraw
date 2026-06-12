from unittest.mock import MagicMock, patch

import pytest

from rag_common.config import gemini_config
from rag_common.gemini_embed import (
    GeminiFatalError,
    embed_gemini_texts,
    format_gemini2_text,
    is_gemini_embedding_2,
    probe_gemini,
)


def test_is_gemini_embedding_2():
    assert is_gemini_embedding_2("gemini-embedding-2")
    assert is_gemini_embedding_2("gemini-embedding-2-preview")
    assert not is_gemini_embedding_2("gemini-embedding-001")


def test_format_gemini2_text():
    assert format_gemini2_text("hello", mode="query") == "task: search result | query: hello"
    assert (
        format_gemini2_text("body", mode="document", title="Paper")
        == "title: Paper | text: body"
    )


@patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=True)
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_probe_gemini_v1(mock_client_fn, mock_types):
    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client
    embedding = MagicMock()
    embedding.values = [0.1, 0.2, 0.3]
    mock_response = MagicMock()
    mock_response.embeddings = [embedding]
    mock_client.models.embed_content.return_value = mock_response

    cfg = gemini_config(profile="gemini")
    probe_gemini(cfg)
    mock_client.models.embed_content.assert_called_once()


@patch.dict("os.environ", {}, clear=True)
def test_probe_gemini_missing_auth():
    cfg = gemini_config(profile="gemini")
    with pytest.raises(GeminiFatalError, match="Gemini auth missing"):
        probe_gemini(cfg)


@patch.dict("os.environ", {"GOOGLE_API_KEY": "google-key"}, clear=True)
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_embed_gemini_v1_batch(mock_client_fn, mock_types):
    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client

    def _make_embedding(values):
        emb = MagicMock()
        emb.values = values
        return emb

    mock_response = MagicMock()
    mock_response.embeddings = [_make_embedding([0.1, 0.2]), _make_embedding([0.3, 0.4])]
    mock_client.models.embed_content.return_value = mock_response

    cfg = gemini_config(dimensions=2, profile="gemini")
    vectors = embed_gemini_texts(["hello", "world"], config=cfg, probe=False)
    assert len(vectors) == 2
    assert mock_client.models.embed_content.call_count == 1


@patch.dict(
    "os.environ",
    {
        "GOOGLE_GENAI_USE_VERTEXAI": "true",
        "GOOGLE_CLOUD_PROJECT": "my-project",
        "GOOGLE_CLOUD_LOCATION": "us-central1",
    },
    clear=True,
)
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_embed_gemini_v2_per_chunk(mock_client_fn, mock_types):
    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client

    def _make_embedding(values):
        emb = MagicMock()
        emb.values = values
        return emb

    mock_response = MagicMock()
    mock_response.embeddings = [_make_embedding([0.1, 0.2])]
    mock_client.models.embed_content.return_value = mock_response

    cfg = gemini_config(model="gemini-embedding-2", dimensions=2, profile="gemini-2")
    vectors = embed_gemini_texts(
        ["body one", "body two"],
        config=cfg,
        probe=False,
        mode="document",
        titles=["Doc A", "Doc B"],
    )
    assert len(vectors) == 2
    assert mock_client.models.embed_content.call_count == 2
    first_call = mock_client.models.embed_content.call_args_list[0]
    assert "title: Doc A | text: body one" in str(first_call)


@patch.dict(
    "os.environ",
    {
        "GOOGLE_GENAI_USE_VERTEXAI": "true",
        "GOOGLE_CLOUD_PROJECT": "my-project",
        "GOOGLE_CLOUD_LOCATION": "europe-west1",
    },
    clear=True,
)
def test_vertex_env_helpers():
    from rag_common.gemini_embed import _use_vertex, _vertex_location, _vertex_project

    assert _use_vertex()
    assert _vertex_project() == "my-project"
    assert _vertex_location() == "europe-west1"
