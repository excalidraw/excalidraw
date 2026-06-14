from unittest.mock import MagicMock, patch

import pytest

from rag_common.config import gemini_config
from rag_common.gemini_embed import (
    GeminiEmbedError,
    GeminiFatalError,
    embed_gemini_texts,
    format_gemini2_text,
    is_gemini_embedding_2,
    probe_gemini,
)
from rag_common.gemini_rate_limit import reset_rate_limiter


@pytest.fixture(autouse=True)
def _reset_gemini_rate_limiter():
    reset_rate_limiter()
    yield
    reset_rate_limiter()


def test_is_gemini_embedding_2():
    assert is_gemini_embedding_2("gemini-embedding-2")
    assert is_gemini_embedding_2("gemini-embedding-2-preview")
    assert not is_gemini_embedding_2("gemini-embedding-001")


def test_missing_model_is_fatal_configuration_error():
    from rag_common.gemini_embed import _is_fatal

    assert _is_fatal(RuntimeError("404 NOT_FOUND Publisher Model gemini-embedding-2 was not found"))


def test_format_gemini2_text():
    assert format_gemini2_text("hello", mode="query") == "task: code retrieval | query: hello"
    assert (
        format_gemini2_text("body", mode="document", title="Paper")
        == "title: Paper | text: body"
    )


_RATE_ENV = {
    "RAG_GEMINI_TOKENS_PER_MIN": "1000000",
    "RAG_GEMINI_MIN_INTERVAL_MS": "0",
}


@patch.dict("os.environ", {"GEMINI_API_KEY": "test-key", **_RATE_ENV}, clear=True)
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


@patch.dict("os.environ", {"GOOGLE_API_KEY": "google-key", **_RATE_ENV}, clear=True)
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
        **_RATE_ENV,
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
        "GOOGLE_CLOUD_LOCATION": "us-central1",
        **_RATE_ENV,
    },
    clear=True,
)
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_embed_gemini_v2_concurrent_preserves_order(mock_client_fn, mock_types):
    """workers>1 fans out across threads but must return vectors in input order."""
    import threading

    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client

    barrier = threading.Barrier(4)

    def _embed_content(*, model, contents, config):
        # Encode the input index into the returned vector so we can verify ordering.
        idx = int(str(contents).split("idx=")[1].split(" ")[0])
        # Force interleaving: every worker waits until all are in-flight.
        try:
            barrier.wait(timeout=5)
        except threading.BrokenBarrierError:
            pass
        emb = MagicMock()
        emb.values = [float(idx)]
        resp = MagicMock()
        resp.embeddings = [emb]
        return resp

    mock_client.models.embed_content.side_effect = _embed_content

    cfg = gemini_config(model="gemini-embedding-2", dimensions=1, profile="gemini-2")
    texts = [f"idx={i} body" for i in range(4)]
    vectors = embed_gemini_texts(texts, config=cfg, probe=False, workers=4)

    assert [v[0] for v in vectors] == [0.0, 1.0, 2.0, 3.0]
    assert mock_client.models.embed_content.call_count == 4


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


@patch.dict("os.environ", {"GOOGLE_API_KEY": "google-key", **_RATE_ENV}, clear=True)
@patch("rag_common.gemini_embed.time.sleep")
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_rate_limit_retries_without_fatal(mock_client_fn, mock_types, mock_sleep):
    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client

    def _make_embedding(values):
        emb = MagicMock()
        emb.values = values
        return emb

    rate_exc = Exception(
        "429 RESOURCE_EXHAUSTED quota exceeded embed_content_input_tokens_per_minute"
    )
    ok_response = MagicMock()
    ok_response.embeddings = [_make_embedding([0.1, 0.2])]
    mock_client.models.embed_content.side_effect = [rate_exc, ok_response]

    cfg = gemini_config(dimensions=2, profile="gemini")
    vectors = embed_gemini_texts(["hello"], config=cfg, probe=False)
    assert len(vectors) == 1
    assert mock_client.models.embed_content.call_count == 2
    mock_sleep.assert_called()


@patch.dict("os.environ", {"GOOGLE_API_KEY": "google-key", **_RATE_ENV}, clear=True)
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_auth_error_raises_fatal(mock_client_fn, mock_types):
    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client
    mock_client.models.embed_content.side_effect = Exception("403 permission denied")

    cfg = gemini_config(dimensions=2, profile="gemini")
    with pytest.raises(GeminiFatalError):
        embed_gemini_texts(["hello"], config=cfg, probe=False)


@patch.dict("os.environ", {"GOOGLE_API_KEY": "google-key", **_RATE_ENV}, clear=True)
@patch("rag_common.gemini_embed.time.sleep")
@patch("rag_common.gemini_embed.MAX_RATE_LIMIT_RETRIES", 2)
@patch("rag_common.gemini_embed.genai_types")
@patch("rag_common.gemini_embed._client")
def test_rate_limit_exhaustion_raises_embed_error_not_fatal(
    mock_client_fn, mock_types, mock_sleep
):
    mock_types.EmbedContentConfig = MagicMock()
    mock_client = MagicMock()
    mock_client_fn.return_value = mock_client
    rate_exc = Exception("429 RESOURCE_EXHAUSTED")
    mock_client.models.embed_content.side_effect = rate_exc

    cfg = gemini_config(dimensions=2, profile="gemini")
    with pytest.raises(GeminiEmbedError, match="rate limit persisted"):
        embed_gemini_texts(["hello"], config=cfg, probe=False)
