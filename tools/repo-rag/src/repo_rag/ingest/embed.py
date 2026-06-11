from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

import tiktoken
from openai import OpenAI

from repo_rag.logging_config import get_logger

log = get_logger("embed")

DEFAULT_MODEL = "text-embedding-3-large"
DEFAULT_DIMS = 3072
MAX_INPUT_TOKENS = 8191
BATCH_SIZE = 64
MAX_RETRIES = 5
DEFAULT_WORKERS = 8


@dataclass
class EmbedConfig:
    model: str
    dimensions: int

    @classmethod
    def from_env(cls) -> EmbedConfig:
        model = os.getenv("REPO_RAG_EMBED_MODEL", DEFAULT_MODEL)
        dims = int(os.getenv("REPO_RAG_EMBED_DIMS", str(DEFAULT_DIMS)))
        return cls(model=model, dimensions=dims)


@dataclass
class EmbedStats:
    tokens: int = 0
    requests: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    def add(self, *, tokens: int, requests: int = 1) -> None:
        with self._lock:
            self.tokens += tokens
            self.requests += requests


def resolve_workers(workers: int | None = None) -> int:
    if workers is not None:
        return max(1, workers)
    env = os.getenv("REPO_RAG_WORKERS")
    if env:
        return max(1, int(env))
    cpu = os.cpu_count() or 4
    return max(4, min(16, cpu * 2))


def _encoding():
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_encoding().encode(text))


def truncate_to_token_limit(text: str, limit: int = MAX_INPUT_TOKENS) -> str:
    tokens = _encoding().encode(text)
    if len(tokens) <= limit:
        return text
    return _encoding().decode(tokens[:limit])


def _embed_batch(
    client: OpenAI,
    batch: list[str],
    *,
    batch_num: int,
    total_batches: int,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
) -> list[list[float]]:
    for attempt in range(MAX_RETRIES):
        try:
            response = client.embeddings.create(
                input=batch,
                model=cfg.model,
                dimensions=cfg.dimensions,
            )
            batch_tokens = 0
            if response.usage:
                batch_tokens = response.usage.total_tokens
            else:
                batch_tokens = sum(count_tokens(t) for t in batch)
            if stats is not None:
                stats.add(tokens=batch_tokens, requests=1)
            log.info(
                "embed batch %d/%d size=%d tokens=%d total_tokens=%d",
                batch_num,
                total_batches,
                len(batch),
                batch_tokens,
                stats.tokens if stats else batch_tokens,
            )
            return [item.embedding for item in response.data]
        except Exception as exc:
            if attempt == MAX_RETRIES - 1:
                log.error(
                    "embed batch %d/%d failed after %d attempts: %s",
                    batch_num,
                    total_batches,
                    MAX_RETRIES,
                    exc,
                )
                raise
            wait = 2**attempt
            log.warning(
                "embed batch %d/%d attempt %d failed (%s), retry in %ds",
                batch_num,
                total_batches,
                attempt + 1,
                exc,
                wait,
            )
            time.sleep(wait)
    return []


def embed_texts(
    texts: list[str],
    *,
    config: EmbedConfig | None = None,
    stats: EmbedStats | None = None,
    workers: int | None = None,
) -> list[list[float]]:
    if not texts:
        return []

    cfg = config or EmbedConfig.from_env()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for embedding.")

    prepared = [truncate_to_token_limit(t) for t in texts]
    batches = [prepared[i : i + BATCH_SIZE] for i in range(0, len(prepared), BATCH_SIZE)]
    total_batches = len(batches)
    n_workers = resolve_workers(workers)

    log.info(
        "embedding %d texts in %d batch(es) workers=%d model=%s dims=%d",
        len(prepared),
        total_batches,
        min(n_workers, total_batches),
        cfg.model,
        cfg.dimensions,
    )

    if total_batches == 1 or n_workers == 1:
        client = OpenAI(api_key=api_key)
        vectors: list[list[float]] = []
        for batch_num, batch in enumerate(batches, start=1):
            vectors.extend(
                _embed_batch(
                    client,
                    batch,
                    batch_num=batch_num,
                    total_batches=total_batches,
                    cfg=cfg,
                    stats=stats,
                )
            )
        return vectors

    batch_vectors: list[list[list[float]] | None] = [None] * total_batches

    def _run(batch_num: int, batch: list[str]) -> tuple[int, list[list[float]]]:
        client = OpenAI(api_key=api_key)
        vecs = _embed_batch(
            client,
            batch,
            batch_num=batch_num,
            total_batches=total_batches,
            cfg=cfg,
            stats=stats,
        )
        return batch_num - 1, vecs

    with ThreadPoolExecutor(max_workers=min(n_workers, total_batches)) as pool:
        futures = [
            pool.submit(_run, batch_num, batch)
            for batch_num, batch in enumerate(batches, start=1)
        ]
        for future in as_completed(futures):
            idx, vecs = future.result()
            batch_vectors[idx] = vecs

    return [v for batch in batch_vectors if batch for v in batch]


def embed_query(text: str, *, config: EmbedConfig | None = None) -> list[float]:
    return embed_texts([text], config=config, workers=1)[0]
