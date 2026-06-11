from rag_common.env import valid_openai_key


def test_valid_openai_key_rejects_placeholder():
    assert not valid_openai_key("sk-your-key-here")
    assert not valid_openai_key("")
    assert valid_openai_key("sk-proj-real-key-here")
