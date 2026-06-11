from __future__ import annotations

import logging
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from rag_common.config import EmbedConfig, EmbedStats

log = logging.getLogger("rag_common.local")

LOCAL_BATCH_SIZE = 32


@lru_cache(maxsize=4)
def _get_model(model_name: str) -> SentenceTransformer:
    log.info("loading local embed model %s", model_name)
    return SentenceTransformer(model_name)


def embed_local_texts(
    texts: list[str],
    *,
    config: EmbedConfig,
    stats: EmbedStats | None = None,
) -> list[list[float]]:
    if not texts:
        return []

    model = _get_model(config.model)
    log.info("local embedding %d texts model=%s dims=%d", len(texts), config.model, config.dimensions)

    vectors = model.encode(
        texts,
        batch_size=LOCAL_BATCH_SIZE,
        show_progress_bar=len(texts) > 200,
        normalize_embeddings=True,
    )
    if stats is not None:
        stats.add(tokens=len(texts), requests=1)

    return [v.tolist() for v in vectors]
