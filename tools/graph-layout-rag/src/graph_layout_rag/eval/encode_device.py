from __future__ import annotations

import os
from typing import Any, Literal

EncodeDevice = Literal["auto", "cpu", "cuda"]

_FASTEMBED_PROVIDERS_ENV = "GRAPH_RAG_FASTEMBED_PROVIDERS"


def _cuda_provider_available() -> bool:
    try:
        import onnxruntime as ort
    except ImportError:
        return False
    return "CUDAExecutionProvider" in ort.get_available_providers()


def resolve_encode_device(device: EncodeDevice | None = None) -> Literal["cpu", "cuda"]:
    """Pick CPU or CUDA for fastembed / PyTorch sparse encoders."""
    if device is None:
        device = os.getenv("GRAPH_RAG_ENCODE_DEVICE", "auto")  # type: ignore[assignment]
    if device == "auto":
        return "cuda" if _cuda_provider_available() else "cpu"
    if device not in {"cpu", "cuda"}:
        raise ValueError(f"Unknown encode device {device!r}; expected auto, cpu, or cuda")
    if device == "cuda" and not _cuda_provider_available():
        raise RuntimeError(
            "CUDA encode requested but ONNX Runtime CUDAExecutionProvider is unavailable. "
            "Install retrieval-experiments-gpu (fastembed-gpu + onnxruntime-gpu) on the GPU host."
        )
    return device


def fastembed_kwargs(device: EncodeDevice | None = None) -> dict[str, Any]:
    """Keyword args for fastembed SparseTextEmbedding / LateInteractionTextEmbedding."""
    resolved = resolve_encode_device(device)
    if resolved == "cpu":
        return {}
    providers_raw = os.getenv(_FASTEMBED_PROVIDERS_ENV, "").strip()
    if providers_raw:
        providers = [p.strip() for p in providers_raw.split(",") if p.strip()]
        return {"providers": providers}
    return {"cuda": True}
