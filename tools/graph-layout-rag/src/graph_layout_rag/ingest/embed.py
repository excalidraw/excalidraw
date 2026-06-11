"""Graph layout RAG embedding — delegates to rag_common with GRAPH_RAG_ prefix."""

from __future__ import annotations

from rag_common.config import EmbedConfig, EmbedStats
from rag_common.embed import embed_query, embed_texts, finalize_embed_config
from rag_common.openai_embed import resolve_workers
from rag_common.resolve import resolve_embed_config

ENV_PREFIX = "GRAPH_RAG_"


def embed_config_from_env() -> EmbedConfig:
    return resolve_embed_config(ENV_PREFIX)


def prepare_embed_config() -> EmbedConfig:
    return finalize_embed_config(embed_config_from_env(), prefix=ENV_PREFIX)


EmbedConfig.from_env = staticmethod(embed_config_from_env)  # type: ignore[attr-defined]

__all__ = [
    "EmbedConfig",
    "EmbedStats",
    "ENV_PREFIX",
    "embed_config_from_env",
    "embed_query",
    "embed_texts",
    "finalize_embed_config",
    "prepare_embed_config",
    "resolve_embed_config",
    "resolve_workers",
]
