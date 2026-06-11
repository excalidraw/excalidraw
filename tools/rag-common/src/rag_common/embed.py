from __future__ import annotations

import logging

from rag_common.config import EmbedConfig, EmbedStats, local_config
from rag_common.local_embed import embed_local_texts
from rag_common.openai_embed import OpenAIFatalError, embed_openai_texts, probe_openai, resolve_workers
from rag_common.resolve import resolve_embed_config

log = logging.getLogger("rag_common.embed")

__all__ = [
    "EmbedConfig",
    "EmbedStats",
    "embed_query",
    "embed_texts",
    "finalize_embed_config",
    "probe_openai",
    "resolve_embed_config",
    "resolve_workers",
]


def finalize_embed_config(cfg: EmbedConfig, *, prefix: str = "") -> EmbedConfig:
    """Probe OpenAI when configured; fall back to local on fatal errors."""
    if cfg.backend == "local":
        return cfg
    try:
        probe_openai(cfg)
        return cfg
    except OpenAIFatalError as exc:
        local_cfg = local_config()
        log.warning(
            "OpenAI unavailable (%s); using local embeddings for this run (model=%s)",
            exc,
            local_cfg.model,
        )
        return local_cfg


def embed_texts(
    texts: list[str],
    *,
    config: EmbedConfig | None = None,
    stats: EmbedStats | None = None,
    workers: int | None = None,
    prefix: str = "",
    allow_fallback: bool = True,
    probe: bool = True,
) -> list[list[float]]:
    if not texts:
        return []

    cfg = config or resolve_embed_config(prefix)

    if cfg.backend == "local":
        if stats is not None:
            stats.set_effective_config(cfg)
        return embed_local_texts(texts, config=cfg, stats=stats)

    try:
        vectors = embed_openai_texts(
            texts,
            config=cfg,
            stats=stats,
            workers=workers,
            prefix=prefix,
            probe=probe,
        )
        if stats is not None:
            stats.set_effective_config(cfg)
        return vectors
    except OpenAIFatalError as exc:
        if not allow_fallback:
            raise
        local_cfg = local_config()
        log.warning(
            "OpenAI embed unavailable (%s); falling back to local model=%s dims=%d",
            exc,
            local_cfg.model,
            local_cfg.dimensions,
        )
        if stats is not None:
            stats.set_effective_config(local_cfg)
        return embed_local_texts(texts, config=local_cfg, stats=stats)


def embed_query(
    text: str,
    *,
    config: EmbedConfig | None = None,
    prefix: str = "",
    allow_fallback: bool = True,
) -> list[float]:
    return embed_texts(
        [text],
        config=config,
        prefix=prefix,
        allow_fallback=allow_fallback,
        workers=1,
        probe=True,
    )[0]
