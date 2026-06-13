"""MLX 4-bit Qwen3 embeddings on Apple Silicon (via mlx-embeddings)."""

from __future__ import annotations

import logging
import math
import os
import time
from functools import lru_cache

from rag_common.config import EmbedConfig, EmbedStats, LocalEmbedMode, mlx_q4_model_id

log = logging.getLogger("rag_common.local")

DEFAULT_QUERY_INSTRUCT = (
    "Given a web search query, retrieve relevant passages that answer the query"
)
MLX_ENCODE_CHUNK = 32
MLX_BATCH_SIZE = 8
MAX_EMBED_CHARS = 3000


def _mlx_encode_chunk() -> int:
    return int(os.getenv("RAG_MLX_ENCODE_CHUNK", str(MLX_ENCODE_CHUNK)))


def _mlx_batch_size() -> int:
    return int(os.getenv("RAG_MLX_BATCH_SIZE", str(MLX_BATCH_SIZE)))


def _query_instruct() -> str:
    return os.getenv("RAG_QWEN3_QUERY_INSTRUCT", DEFAULT_QUERY_INSTRUCT)


def _format_qwen3_text(text: str, *, mode: LocalEmbedMode) -> str:
    if mode == "query":
        return f"Instruct: {_query_instruct()}\nQuery:{text}"
    return text


@lru_cache(maxsize=4)
def _get_mlx_model(mlx_model_id: str):
    from mlx_embeddings import load

    log.info("loading MLX 4-bit embed model %s", mlx_model_id)
    model, tokenizer = load(mlx_model_id)
    if hasattr(tokenizer, "padding_side"):
        tokenizer.padding_side = "left"
    return model, tokenizer


def _encode_batch(
    model,
    tokenizer,
    texts: list[str],
    *,
    batch_size: int,
) -> list[list[float]]:
    import mlx.core as mx

    all_rows: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        inputs = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=8192,
            return_tensors="mlx",
        )
        outputs = model(inputs["input_ids"], attention_mask=inputs["attention_mask"])
        mx.eval(outputs.text_embeds)
        all_rows.extend(outputs.text_embeds.tolist())
    return all_rows


def embed_mlx_q4_texts(
    texts: list[str],
    *,
    config: EmbedConfig,
    stats: EmbedStats | None = None,
    mode: LocalEmbedMode = "document",
) -> list[list[float]]:
    if not texts:
        return []

    mlx_model_id = mlx_q4_model_id(config.model)
    if mlx_model_id is None:
        raise RuntimeError(f"No MLX 4-bit mapping for model {config.model}")

    model, tokenizer = _get_mlx_model(mlx_model_id)
    prepared = [
        t[:MAX_EMBED_CHARS] if len(t) > MAX_EMBED_CHARS else t
        for t in (_format_qwen3_text(text, mode=mode) for text in texts)
    ]

    encode_chunk = _mlx_encode_chunk()
    batch_size = _mlx_batch_size()
    log.info(
        "MLX 4-bit embedding %d texts base=%s mlx=%s dims=%d mode=%s",
        len(texts),
        config.model,
        mlx_model_id,
        config.dimensions,
        mode,
    )

    all_vectors: list[list[float]] = []
    total = len(prepared)
    t0 = time.monotonic()
    t_step = t0
    requests = 0
    for start in range(0, total, encode_chunk):
        end = min(total, start + encode_chunk)
        chunk_vecs = _encode_batch(
            model,
            tokenizer,
            prepared[start:end],
            batch_size=batch_size,
        )
        all_vectors.extend(_truncate_and_normalize_row(v, config.dimensions) for v in chunk_vecs)
        requests += max(1, math.ceil((end - start) / batch_size))
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

    if stats is not None:
        stats.add(tokens=len(texts), requests=requests)
    return all_vectors


def _truncate_and_normalize_row(vector: list[float], dims: int) -> list[float]:
    if dims <= 0 or len(vector) <= dims:
        return vector
    row = vector[:dims]
    norm = math.sqrt(sum(x * x for x in row)) or 1e-12
    return [x / norm for x in row]
