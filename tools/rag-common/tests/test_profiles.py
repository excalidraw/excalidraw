from pathlib import Path
from unittest.mock import patch

import pytest

from rag_common.config import EmbedConfig
from rag_common.profiles import get_profile, load_profiles, resolve_embed_profile_config


def test_load_builtin_profiles():
    profiles = load_profiles()
    assert "openai-large" in profiles
    assert "gemini" in profiles
    assert "gemini-2" in profiles
    assert "embedding-2" in profiles["gemini-2"].model
    assert profiles["gemini-2"].dimensions == 3072
    assert "mlx-qwen4b" in profiles
    spec = profiles["mlx-qwen4b"]
    assert spec.backend == "local"
    assert spec.quant == "4bit"
    assert spec.dimensions == 1024


def test_merge_extra_profiles(tmp_path: Path):
    override = tmp_path / "embed_profiles.toml"
    override.write_text(
        """
[profiles.custom-local]
backend = "local"
model = "Qwen/Qwen3-Embedding-0.6B"
dimensions = 512
quant = "4bit"

[profiles.openai-large]
backend = "openai"
model = "text-embedding-3-small"
dimensions = 1536
""",
        encoding="utf-8",
    )
    profiles = load_profiles(extra_paths=[override])
    assert profiles["custom-local"].dimensions == 512
    assert profiles["openai-large"].model == "text-embedding-3-small"


@patch.dict("os.environ", {}, clear=True)
def test_legacy_env_local_default():
    cfg = resolve_embed_profile_config()
    assert cfg.backend == "local"
    assert cfg.profile == "default"
    assert cfg.dimensions == 1024


@patch.dict("os.environ", {"RAG_EMBED_PROFILE": "gemini"}, clear=True)
def test_profile_env_resolution():
    cfg = resolve_embed_profile_config()
    assert cfg.backend == "gemini"
    assert cfg.profile == "gemini"
    assert cfg.model == "gemini-embedding-001"
    assert cfg.dimensions == 768


@patch.dict("os.environ", {"GRAPH_RAG_EMBED_PROFILE": "mlx-qwen4b"}, clear=True)
def test_prefix_profile_env():
    cfg = resolve_embed_profile_config(prefix="GRAPH_RAG_")
    assert cfg.profile == "mlx-qwen4b"
    assert cfg.quant == "4bit"


@patch.dict("os.environ", {}, clear=True)
def test_cli_profile_overrides_env():
    with patch.dict("os.environ", {"RAG_EMBED_PROFILE": "gemini"}, clear=False):
        cfg = resolve_embed_profile_config(profile="openai-large")
    assert cfg.profile == "openai-large"
    assert cfg.backend == "openai"


@patch.dict("os.environ", {"RAG_EMBED_BACKEND": "openai"}, clear=True)
def test_legacy_openai_requires_key():
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        resolve_embed_profile_config()


@patch.dict(
    "os.environ",
    {"RAG_EMBED_BACKEND": "local", "RAG_LOCAL_EMBED_QUANT": "4bit"},
    clear=True,
)
def test_legacy_local_quant():
    cfg = resolve_embed_profile_config()
    assert cfg.backend == "local"
    assert cfg.quant == "4bit"


def test_get_profile_unknown():
    with pytest.raises(KeyError, match="Unknown embed profile"):
        get_profile("does-not-exist")


def test_profile_to_embed_config():
    spec = get_profile("openai-large")
    cfg = spec.to_embed_config()
    assert isinstance(cfg, EmbedConfig)
    assert cfg.profile == "openai-large"
    assert cfg.backend == "openai"
