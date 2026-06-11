from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field
from typing import Literal

EmbedBackend = Literal["openai", "local"]

OPENAI_DEFAULT_MODEL = "text-embedding-3-large"
OPENAI_DEFAULT_DIMS = 3072
LOCAL_DEFAULT_MODEL = "all-MiniLM-L6-v2"
LOCAL_DEFAULT_DIMS = 384


@dataclass(frozen=True)
class EmbedConfig:
    backend: EmbedBackend
    model: str
    dimensions: int

    @property
    def is_openai(self) -> bool:
        return self.backend == "openai"


@dataclass
class EmbedStats:
    tokens: int = 0
    requests: int = 0
    effective_config: EmbedConfig | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    def add(self, *, tokens: int, requests: int = 1) -> None:
        with self._lock:
            self.tokens += tokens
            self.requests += requests

    def set_effective_config(self, config: EmbedConfig) -> None:
        with self._lock:
            self.effective_config = config


def openai_config(*, model: str | None = None, dimensions: int | None = None) -> EmbedConfig:
    return EmbedConfig(
        backend="openai",
        model=model or os.getenv("RAG_OPENAI_EMBED_MODEL", OPENAI_DEFAULT_MODEL),
        dimensions=dimensions or int(os.getenv("RAG_OPENAI_EMBED_DIMS", str(OPENAI_DEFAULT_DIMS))),
    )


def local_config(*, model: str | None = None) -> EmbedConfig:
    name = model or os.getenv("RAG_LOCAL_EMBED_MODEL", LOCAL_DEFAULT_MODEL)
    return EmbedConfig(backend="local", model=name, dimensions=LOCAL_DEFAULT_DIMS)
