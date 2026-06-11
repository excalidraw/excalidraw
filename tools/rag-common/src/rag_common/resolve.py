from __future__ import annotations

import logging
import os

from rag_common.config import EmbedConfig, local_config, openai_config
from rag_common.env import valid_openai_key

log = logging.getLogger("rag_common.resolve")


def _backend_mode(prefix: str) -> str:
    for key in (f"{prefix}EMBED_BACKEND", "RAG_EMBED_BACKEND"):
        value = os.getenv(key)
        if value:
            return value.strip().lower()
    return "auto"


def resolve_embed_config(prefix: str = "") -> EmbedConfig:
    """Resolve embedding backend: auto (OpenAI first, else local), openai, or local."""
    mode = _backend_mode(prefix)

    if mode == "local":
        cfg = local_config()
        log.info("embed backend=local model=%s dims=%d", cfg.model, cfg.dimensions)
        return cfg

    if mode == "openai":
        if not valid_openai_key():
            raise RuntimeError(
                "RAG_EMBED_BACKEND=openai but OPENAI_API_KEY is missing or a placeholder."
            )
        cfg = openai_config(
            model=os.getenv(f"{prefix}EMBED_MODEL"),
            dimensions=int(os.getenv(f"{prefix}EMBED_DIMS", "0")) or None,
        )
        log.info("embed backend=openai model=%s dims=%d", cfg.model, cfg.dimensions)
        return cfg

    if mode != "auto":
        raise RuntimeError(f"Unknown embed backend mode: {mode!r} (use auto, openai, or local)")

    if valid_openai_key():
        cfg = openai_config(
            model=os.getenv(f"{prefix}EMBED_MODEL"),
            dimensions=int(os.getenv(f"{prefix}EMBED_DIMS", "0")) or None,
        )
        log.info("embed backend=auto -> openai model=%s dims=%d", cfg.model, cfg.dimensions)
        return cfg

    cfg = local_config()
    log.info(
        "embed backend=auto -> local (no valid OPENAI_API_KEY) model=%s dims=%d",
        cfg.model,
        cfg.dimensions,
    )
    return cfg
