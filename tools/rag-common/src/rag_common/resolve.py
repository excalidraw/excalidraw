from __future__ import annotations

import logging
from pathlib import Path

from rag_common.config import EmbedConfig
from rag_common.profiles import resolve_embed_profile_config

log = logging.getLogger("rag_common.resolve")


def resolve_embed_config(
    prefix: str = "",
    *,
    profile: str | None = None,
    extra_paths: list[Path] | None = None,
) -> EmbedConfig:
    """Resolve embedding config from profile name, env, or legacy backend vars."""
    return resolve_embed_profile_config(
        prefix=prefix,
        profile=profile,
        extra_paths=extra_paths,
    )
