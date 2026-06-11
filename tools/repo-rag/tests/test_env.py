import os

from repo_rag.env import load_env_file


def test_load_env_file_sets_unset_vars(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OPENAI_API_KEY=sk-from-file\nREPO_RAG_EMBED_DIMS=1024\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("REPO_RAG_EMBED_DIMS", raising=False)

    assert load_env_file(env_file) is True
    assert os.environ["OPENAI_API_KEY"] == "sk-from-file"
    assert os.environ["REPO_RAG_EMBED_DIMS"] == "1024"


def test_load_env_file_does_not_override_existing(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("OPENAI_API_KEY=sk-from-file\n", encoding="utf-8")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-shell")

    load_env_file(env_file)
    assert os.environ["OPENAI_API_KEY"] == "sk-from-shell"


def test_load_env_file_falls_back_to_example(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    env_example = tmp_path / ".env.example"
    env_example.write_text("OPENAI_API_KEY=sk-from-example\n", encoding="utf-8")
    from repo_rag import env as env_module

    monkeypatch.setattr(env_module, "ENV_PATH", tmp_path / ".env")
    monkeypatch.setattr(env_module, "ENV_EXAMPLE_PATH", env_example)
    assert env_module.load_env_file() is True
    assert os.environ["OPENAI_API_KEY"] == "sk-from-example"
