from __future__ import annotations

import gc
import logging
import os
import platform
import time
from typing import TYPE_CHECKING

from sentence_transformers import SentenceTransformer

from rag_common.config import (
    LOCAL_MODEL_DIMS,
    EmbedConfig,
    EmbedStats,
    LocalEmbedMode,
    use_cuda_bnb_4bit,
    use_mlx_q4_embed,
)

if TYPE_CHECKING:
    pass

log = logging.getLogger("rag_common.local")

LOCAL_BATCH_SIZE = 16
# Log + yield progress for long runs (non-TTY pipes hide tqdm updates).
LOCAL_PROGRESS_CHUNKS = 256
# Cap texts per encode() call on MPS to avoid unified-memory OOM on long chunks.
MPS_ENCODE_CHUNK = 24
MPS_BATCH_SIZE = 4
MAX_EMBED_CHARS = 3000

_model_cache: dict[tuple[str, str, bool], SentenceTransformer] = {}


def _mps_encode_chunk() -> int:
    return int(os.getenv("RAG_MPS_ENCODE_CHUNK", str(MPS_ENCODE_CHUNK)))


def _mps_batch_size() -> int:
    return int(os.getenv("RAG_MPS_BATCH_SIZE", str(MPS_BATCH_SIZE)))


def _cuda_batch_size() -> int:
    return int(os.getenv("RAG_CUDA_BATCH_SIZE", str(LOCAL_BATCH_SIZE)))


def _release_mps_memory() -> None:
    """PyTorch MPS can leak unified memory across encode() calls; flush between chunks."""
    try:
        import torch

        if torch.backends.mps.is_available():
            gc.collect()
            torch.mps.empty_cache()
    except Exception:
        pass


def _model_family(model_name: str) -> str:
    lower = model_name.lower()
    if "qwen" in lower and "embedding" in lower:
        return "qwen3"
    if "nomic-embed" in lower:
        return "nomic"
    if "bge-m3" in lower or "bge-m" in lower:
        return "bge-m3"
    if "bge" in lower:
        return "bge"
    return "generic"


def _prepare_texts(texts: list[str], *, model_name: str, mode: LocalEmbedMode) -> list[str]:
    if _model_family(model_name) == "nomic":
        prefix = "search_query: " if mode == "query" else "search_document: "
        return [prefix + t for t in texts]
    return texts


def _base_model_kwargs(model_name: str) -> dict:
    if _model_family(model_name) == "qwen3" and platform.system() == "Darwin":
        return {"attn_implementation": "eager"}
    return {}


def resolve_local_embed_device(model_name: str) -> str | None:
    """Pick device for local encode from RAG_LOCAL_EMBED_DEVICE or sensible defaults."""
    raw = os.getenv("RAG_LOCAL_EMBED_DEVICE", "auto").strip().lower()
    if raw == "cpu":
        return "cpu"
    if raw == "mps":
        return "mps"
    if raw == "cuda":
        return "cuda"
    if raw not in ("", "auto"):
        log.warning("unknown RAG_LOCAL_EMBED_DEVICE=%r; using auto", raw)

    if _model_family(model_name) == "qwen3" and platform.system() == "Darwin":
        try:
            import torch

            if torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass

    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return None


def _local_batch_size(device: str | None) -> int:
    if device == "mps":
        return _mps_batch_size()
    if device == "cuda":
        return _cuda_batch_size()
    return LOCAL_BATCH_SIZE


def _bnb_4bit_model_kwargs() -> dict | None:
    try:
        import torch
        from transformers import BitsAndBytesConfig
    except ImportError as exc:
        log.warning("bitsandbytes 4-bit requested but import failed (%s); using FP16", exc)
        return None

    return {
        "quantization_config": BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        ),
        "device_map": {"": 0},
    }


def _load_sentence_transformer(
    model_name: str,
    *,
    device: str | None,
    bnb_4bit: bool,
) -> SentenceTransformer:
    mk = _base_model_kwargs(model_name)
    if bnb_4bit:
        bnb_kwargs = _bnb_4bit_model_kwargs()
        if bnb_kwargs is not None:
            try:
                log.info("loading local embed model %s (CUDA 4-bit)", model_name)
                return SentenceTransformer(model_name, model_kwargs={**mk, **bnb_kwargs})
            except Exception as exc:
                log.warning("4-bit load failed for %s (%s); falling back to FP16", model_name, exc)

    log.info(
        "loading local embed model %s device=%s",
        model_name,
        device or "default",
    )
    if mk:
        return SentenceTransformer(model_name, model_kwargs=mk, device=device)
    return SentenceTransformer(model_name, device=device)


def _get_model_for_config(config: EmbedConfig) -> SentenceTransformer:
    device = resolve_local_embed_device(config.model)
    bnb_4bit = use_cuda_bnb_4bit(config) and device == "cuda"
    key = (config.model, device or "", bnb_4bit)
    cached = _model_cache.get(key)
    if cached is not None:
        return cached
    model = _load_sentence_transformer(config.model, device=device, bnb_4bit=bnb_4bit)
    _model_cache[key] = model
    return model


def embed_local_texts(
    texts: list[str],
    *,
    config: EmbedConfig,
    stats: EmbedStats | None = None,
    mode: LocalEmbedMode = "document",
) -> list[list[float]]:
    if not texts:
        return []

    if use_mlx_q4_embed(config.model, config):
        try:
            from rag_common.mlx_embed import embed_mlx_q4_texts

            return embed_mlx_q4_texts(texts, config=config, stats=stats, mode=mode)
        except ImportError as exc:
            log.warning(
                "RAG_LOCAL_EMBED_QUANT=%s but mlx-embeddings is not installed (%s); "
                "falling back to sentence-transformers",
                os.getenv("RAG_LOCAL_EMBED_QUANT"),
                exc,
            )

    model = _get_model_for_config(config)
    prepared = [
        t[:MAX_EMBED_CHARS] if len(t) > MAX_EMBED_CHARS else t
        for t in _prepare_texts(texts, model_name=config.model, mode=mode)
    ]
    family = _model_family(config.model)

    device = resolve_local_embed_device(config.model)
    batch_size = _local_batch_size(device)
    encode_chunk = _mps_encode_chunk() if device == "mps" else LOCAL_PROGRESS_CHUNKS

    log.info(
        "local embedding %d texts model=%s dims=%d mode=%s device=%s batch=%d",
        len(texts),
        config.model,
        config.dimensions,
        mode,
        device or "default",
        batch_size,
    )

    encode_kwargs: dict = {
        "batch_size": batch_size,
        "show_progress_bar": False,
        "normalize_embeddings": True,
    }
    if device and not use_cuda_bnb_4bit(config):
        encode_kwargs["device"] = device
    if family == "qwen3" and mode == "query":
        encode_kwargs["prompt_name"] = "query"
    if family == "qwen3":
        native = LOCAL_MODEL_DIMS.get(config.model, config.dimensions)
        if 0 < config.dimensions < native:
            encode_kwargs["truncate_dim"] = config.dimensions

    all_vectors: list[list[float]] = []
    total = len(prepared)
    t0 = time.monotonic()
    t_step = t0
    for start in range(0, total, encode_chunk):
        end = min(total, start + encode_chunk)
        chunk_vecs = model.encode(prepared[start:end], **encode_kwargs)
        all_vectors.extend(v.tolist() for v in chunk_vecs)
        if device == "mps":
            _release_mps_memory()
        now = time.monotonic()
        elapsed = now - t0
        rate = end / elapsed if elapsed else 0.0
        eta = (total - end) / rate if rate else 0.0
        log.info(
            "embed progress: %d/%d texts (%.1f%%, +%.1fs, total %.1fs, %.2f texts/s, eta %.1fs)",
            end,
            total,
            end / total * 100,
            now - t_step,
            elapsed,
            rate,
            eta,
        )
        t_step = now

    if total <= encode_chunk:
        if stats is not None:
            stats.add(tokens=len(texts), requests=1)
        return all_vectors

    if stats is not None:
        stats.add(tokens=len(texts), requests=max(1, (total + encode_chunk - 1) // encode_chunk))

    return all_vectors
