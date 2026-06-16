"""Graph layout RAG embedding — delegates to rag_common with RAG_LIT_ prefix."""

from __future__ import annotations

import os
from pathlib import Path

from rag_common.config import EmbedConfig, EmbedStats
from rag_common.embed import embed_query, embed_texts, finalize_embed_config
from rag_common.openai_embed import resolve_workers
from rag_common.profiles import list_profile_names, load_profiles
from rag_common.resolve import resolve_embed_config

from rag_literature_rag.paths import PKG_ROOT

ENV_PREFIX = "RAG_LIT_"
_EXTRA_PROFILES = [PKG_ROOT / "embed_profiles.toml"]


def embed_config_from_env(*, profile: str | None = None) -> EmbedConfig:
    return resolve_embed_config(ENV_PREFIX, profile=profile, extra_paths=_EXTRA_PROFILES)


def prepare_embed_config(*, profile: str | None = None) -> EmbedConfig:
    explicit = profile or os.getenv(f"{ENV_PREFIX}EMBED_PROFILE") or os.getenv("RAG_EMBED_PROFILE")
    return finalize_embed_config(
        embed_config_from_env(profile=profile),
        prefix=ENV_PREFIX,
        allow_fallback=not explicit,
    )


def list_embed_profiles() -> list[tuple[str, str, str, int, str | None]]:
    profiles = load_profiles(extra_paths=_EXTRA_PROFILES)
    rows: list[tuple[str, str, str, int, str | None]] = []
    for name in sorted(profiles):
        spec = profiles[name]
        rows.append((name, spec.backend, spec.model, spec.dimensions, spec.quant))
    return rows


EmbedConfig.from_env = staticmethod(embed_config_from_env)  # type: ignore[attr-defined]

__all__ = [
    "EmbedConfig",
    "EmbedStats",
    "ENV_PREFIX",
    "embed_config_from_env",
    "embed_query",
    "embed_texts",
    "finalize_embed_config",
    "list_embed_profiles",
    "list_profile_names",
    "load_profiles",
    "prepare_embed_config",
    "resolve_embed_config",
    "resolve_workers",
]
