from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np

from graph_layout_rag.eval.encode_device import resolve_encode_device

# Models not shipped in fastembed; encoded via sentence-transformers SparseEncoder.
PYTORCH_SPARSE_MODELS: frozenset[str] = frozenset(
    {
        "naver/splade-v3",
        "naver/splade-v3-distilbert",
        "naver/splade-v3-lexical",
        "naver/splade-v3-doc",
    }
)


def is_pytorch_sparse_model(model_name: str) -> bool:
    return model_name in PYTORCH_SPARSE_MODELS or model_name.startswith("naver/splade-v3")


@dataclass(frozen=True)
class SparseEmbedding:
    indices: np.ndarray
    values: np.ndarray


class SpladeV3Encoder:
    """PyTorch SPLADE-v3 encoder (sentence-transformers SparseEncoder)."""

    def __init__(self, model_name: str, *, device: str | None = None) -> None:
        try:
            from sentence_transformers import SparseEncoder
        except ImportError as exc:
            raise ImportError(
                "PyTorch SPLADE models require sentence-transformers. "
                "Run: uv sync --extra retrieval-experiments-gpu"
            ) from exc
        import torch

        resolved = device or resolve_encode_device()
        if resolved == "cuda" and not torch.cuda.is_available():
            resolved = "cpu"
        self.model_name = model_name
        self.device = resolved
        self._model = SparseEncoder(model_name, device=resolved)

    def embed(self, texts: list[str], *, batch_size: int) -> Iterator[SparseEmbedding]:
        embeddings = self._model.encode_document(
            texts,
            batch_size=batch_size,
            convert_to_tensor=False,
            convert_to_sparse_tensor=True,
            show_progress_bar=False,
        )
        for tensor in embeddings:
            yield _sparse_from_tensor(tensor)

    def query_embed(self, query: str) -> SparseEmbedding:
        embeddings = self._model.encode_query(
            [query],
            batch_size=1,
            convert_to_tensor=False,
            convert_to_sparse_tensor=True,
            show_progress_bar=False,
        )
        return _sparse_from_tensor(embeddings[0])


def _sparse_from_tensor(tensor) -> SparseEmbedding:
    import torch

    if not isinstance(tensor, torch.Tensor):
        raise TypeError(f"expected sparse torch.Tensor, got {type(tensor)!r}")
    coalesced = tensor.coalesce()
    if coalesced.dim() == 1:
        indices = coalesced.indices()[0]
    else:
        indices = coalesced.indices()[1]
    return SparseEmbedding(
        indices=indices.cpu().numpy().astype(np.int64),
        values=coalesced.values().cpu().numpy().astype(np.float32),
    )
