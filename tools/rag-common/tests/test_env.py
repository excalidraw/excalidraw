from unittest.mock import patch

from rag_common.env import valid_gemini_auth, valid_gemini_key, valid_openai_key, valid_vertex_gemini_auth


def test_valid_openai_key_rejects_placeholder():
    assert not valid_openai_key("sk-your-key-here")
    assert not valid_openai_key("")
    assert valid_openai_key("sk-proj-real-key-here")


def test_valid_gemini_key():
    assert valid_gemini_key("real-key")
    assert not valid_gemini_key("")


@patch.dict(
    "os.environ",
    {
        "GOOGLE_GENAI_USE_VERTEXAI": "true",
        "GOOGLE_CLOUD_PROJECT": "my-project",
    },
    clear=True,
)
def test_valid_vertex_gemini_auth():
    assert valid_vertex_gemini_auth()
    assert valid_gemini_auth()


@patch.dict("os.environ", {}, clear=True)
def test_valid_gemini_auth_requires_key_or_vertex():
    assert not valid_gemini_auth()


@patch.dict(
    "os.environ",
    {
        "GOOGLE_GENAI_USE_VERTEXAI": "true",
        "GOOGLE_CLOUD_PROJECT": "my-project",
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account.json",
    },
    clear=True,
)
def test_valid_vertex_ignores_placeholder_creds_path():
    assert valid_vertex_gemini_auth()
