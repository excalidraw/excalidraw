from unittest.mock import MagicMock, patch

from repo_rag.ingest.embed import ENV_PREFIX, EmbedConfig, embed_config_from_env, embed_texts


@patch.dict("os.environ", {"RAG_EMBED_BACKEND": "local"}, clear=True)
@patch("rag_common.local_embed.SentenceTransformer")
def test_repo_rag_embed_local(mock_st_cls):
    mock_model = MagicMock()
    mock_st_cls.return_value = mock_model
    import numpy as np

    mock_model.encode.return_value = np.array([[0.1, 0.2]])

    cfg = embed_config_from_env()
    vectors = embed_texts(["hello"], config=cfg, prefix=ENV_PREFIX, allow_fallback=False)
    assert len(vectors) == 1
