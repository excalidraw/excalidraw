from __future__ import annotations

import os
from pathlib import Path

from rag_common.env import valid_openai_key
from graph_layout_rag.paths import ENV_EXAMPLE_PATH, ENV_PATH, REPO_RAG_ENV_PATH


def _load_env_path(env_path: Path) -> None:
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        if key not in os.environ:
            os.environ[key] = value


def load_env_file(path: Path | None = None) -> bool:
    """Load KEY=VALUE pairs from .env, sibling repo-rag/.env, then .env.example."""
    if path is not None:
        if not path.is_file():
            return False
        _load_env_path(path)
        return True

    if ENV_PATH.is_file():
        _load_env_path(ENV_PATH)
        if valid_openai_key():
            return True

    if REPO_RAG_ENV_PATH.is_file():
        _load_env_path(REPO_RAG_ENV_PATH)
        if valid_openai_key():
            return True

    if ENV_EXAMPLE_PATH.is_file():
        _load_env_path(ENV_EXAMPLE_PATH)
        return True

    return False
