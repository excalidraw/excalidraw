from __future__ import annotations

import os
import platform
import threading
from dataclasses import dataclass, field
from typing import Literal

# MLX 4-bit checkpoints for Qwen3 embedding models (Apple Silicon via mlx-embeddings).
QWEN3_MLX_Q4_MODELS: dict[str, str] = {
    "Qwen/Qwen3-Embedding-0.6B": "mlx-community/Qwen3-Embedding-0.6B-4bit-DWQ",
    "Qwen/Qwen3-Embedding-4B": "majentik/Qwen3-Embedding-4B-MLX-4bit",
    "Qwen/Qwen3-Embedding-8B": "mlx-community/Qwen3-Embedding-8B-4bit-DWQ",
}


def local_embed_quant(config: EmbedConfig | None = None) -> str | None:
    """Quantization mode: profile quant first, then RAG_LOCAL_EMBED_QUANT env."""
    if config is not None and config.quant:
        raw = config.quant.strip().lower()
    else:
        raw = os.getenv("RAG_LOCAL_EMBED_QUANT", "").strip().lower()
    if raw in ("", "none", "fp16", "bf16", "off", "false", "0"):
        return None
    return raw


def mlx_q4_model_id(base_model: str) -> str | None:
    return QWEN3_MLX_Q4_MODELS.get(base_model)


def use_mlx_q4_embed(model_name: str, config: EmbedConfig | None = None) -> bool:
    quant = local_embed_quant(config)
    if quant not in ("4bit", "q4", "mlx"):
        return False
    if platform.system() != "Darwin":
        return False
    if "qwen" not in model_name.lower() or "embedding" not in model_name.lower():
        return False
    return mlx_q4_model_id(model_name) is not None


def use_cuda_bnb_4bit(config: EmbedConfig | None = None) -> bool:
    """True when profile/env requests 4-bit quant on a CUDA host (bitsandbytes path)."""
    quant = local_embed_quant(config)
    if quant not in ("4bit", "q4"):
        return False
    if platform.system() == "Darwin":
        return False
    try:
        import torch

        return bool(torch.cuda.is_available())
    except ImportError:
        return False

EmbedBackend = Literal["openai", "local", "gemini"]
LocalEmbedMode = Literal["query", "document"]

OPENAI_DEFAULT_MODEL = "text-embedding-3-large"
OPENAI_DEFAULT_DIMS = 3072
GEMINI_DEFAULT_MODEL = "gemini-embedding-001"
GEMINI_DEFAULT_DIMS = 768
LOCAL_DEFAULT_MODEL = "Qwen/Qwen3-Embedding-0.6B"
LOCAL_DEFAULT_DIMS = 1024

OPENAI_EMBED_COST_PER_MILLION = 0.13
GEMINI_EMBED_COST_PER_MILLION = 0.008

LOCAL_MODEL_DIMS: dict[str, int] = {
    "all-MiniLM-L6-v2": 384,
    "Qwen/Qwen3-Embedding-0.6B": 1024,
    "Qwen/Qwen3-Embedding-4B": 2560,
    "Qwen/Qwen3-Embedding-8B": 4096,
    "BAAI/bge-m3": 1024,
    "BAAI/bge-large-en-v1.5": 1024,
    "nomic-ai/nomic-embed-text-v1.5": 768,
    "nomic-ai/nomic-embed-text-v2-moe": 768,
}


def local_model_dimensions(model_name: str) -> int:
    for key in ("RAG_LOCAL_EMBED_DIMS", "GRAPH_RAG_LOCAL_EMBED_DIMS", "REPO_RAG_LOCAL_EMBED_DIMS"):
        value = os.getenv(key)
        if value:
            return int(value)
    return LOCAL_MODEL_DIMS.get(model_name, LOCAL_DEFAULT_DIMS)


@dataclass(frozen=True)
class EmbedConfig:
    backend: EmbedBackend
    model: str
    dimensions: int
    profile: str | None = None
    quant: str | None = None

    @property
    def is_openai(self) -> bool:
        return self.backend == "openai"

    @property
    def is_remote(self) -> bool:
        return self.backend in ("openai", "gemini")


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


def local_config(*, model: str | None = None, profile: str | None = None) -> EmbedConfig:
    name = model or os.getenv("RAG_LOCAL_EMBED_MODEL", LOCAL_DEFAULT_MODEL)
    quant = os.getenv("RAG_LOCAL_EMBED_QUANT", "").strip().lower() or None
    if quant in ("", "none", "off", "false", "0"):
        quant = None
    return EmbedConfig(
        backend="local",
        model=name,
        dimensions=local_model_dimensions(name),
        profile=profile,
        quant=quant,
    )


def gemini_config(
    *,
    model: str | None = None,
    dimensions: int | None = None,
    profile: str | None = None,
) -> EmbedConfig:
    return EmbedConfig(
        backend="gemini",
        model=model or os.getenv("RAG_GEMINI_EMBED_MODEL", GEMINI_DEFAULT_MODEL),
        dimensions=dimensions
        or int(os.getenv("RAG_GEMINI_EMBED_DIMS", str(GEMINI_DEFAULT_DIMS))),
        profile=profile,
    )


def embed_cost_per_million(backend: EmbedBackend) -> float:
    if backend == "gemini":
        return float(os.getenv("GEMINI_EMBED_COST_PER_MILLION", str(GEMINI_EMBED_COST_PER_MILLION)))
    if backend == "openai":
        return float(os.getenv("OPENAI_EMBED_COST_PER_MILLION", str(OPENAI_EMBED_COST_PER_MILLION)))
    return 0.0
