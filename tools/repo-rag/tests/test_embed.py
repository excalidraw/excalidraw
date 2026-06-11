from unittest.mock import MagicMock, patch

from repo_rag.ingest.embed import (
    BATCH_SIZE,
    EmbedConfig,
    EmbedStats,
    embed_texts,
    truncate_to_token_limit,
)


def test_truncate_to_token_limit():
    long_text = "word " * 20_000
    truncated = truncate_to_token_limit(long_text, limit=100)
    assert len(truncated) < len(long_text)


@patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"})
@patch("repo_rag.ingest.embed.OpenAI")
def test_embed_texts_batches(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=[0.1, 0.2]), MagicMock(embedding=[0.3, 0.4])]
    mock_response.usage = MagicMock(total_tokens=42)
    mock_client.embeddings.create.return_value = mock_response

    stats = EmbedStats()
    vectors = embed_texts(
        ["hello", "world"],
        config=EmbedConfig(model="text-embedding-3-large", dimensions=3072),
        stats=stats,
        workers=1,
    )
    assert len(vectors) == 2
    assert stats.tokens == 42
    mock_client.embeddings.create.assert_called_once()


@patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"})
@patch("repo_rag.ingest.embed.OpenAI")
def test_parallel_embed_preserves_order(mock_openai_cls):
    import threading

    lock = threading.Lock()
    offset = [0]

    def create(**kwargs):
        batch = kwargs["input"]
        with lock:
            start = offset[0]
            offset[0] += len(batch)
        response = MagicMock()
        response.data = [MagicMock(embedding=[float(start + i)]) for i in range(len(batch))]
        response.usage = MagicMock(total_tokens=len(batch))
        return response

    mock_client = MagicMock()
    mock_client.embeddings.create.side_effect = create
    mock_openai_cls.return_value = mock_client

    n = BATCH_SIZE * 2 + 10
    texts = [f"text-{i}" for i in range(n)]
    vectors = embed_texts(texts, workers=4)
    assert len(vectors) == n
    assert vectors[0] == [0.0]
    assert vectors[1] == [1.0]
    assert vectors[-1] == [float(n - 1)]
