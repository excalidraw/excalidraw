from __future__ import annotations

import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import tiktoken
from openai import OpenAI

from rag_common.config import EmbedConfig, EmbedStats
from rag_common.env import is_auth_error, is_openai_fatal_error, is_quota_error, is_rate_limit_error, valid_openai_key

log = logging.getLogger("rag_common.openai")

MAX_INPUT_TOKENS = 8191
BATCH_SIZE = 64
MAX_RETRIES = 8


class OpenAIEmbedError(Exception):
    """OpenAI embedding failed after retries."""


class OpenAIFatalError(OpenAIEmbedError):
    """Auth or rate-limit failure — caller may fall back to local."""


def _encoding():
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_encoding().encode(text, disallowed_special=()))


def truncate_to_token_limit(text: str, limit: int = MAX_INPUT_TOKENS) -> str:
    tokens = _encoding().encode(text, disallowed_special=())
    if len(tokens) <= limit:
        return text
    return _encoding().decode(tokens[:limit])


def resolve_workers(workers: int | None = None, *, prefix: str = "") -> int:
    if workers is not None:
        return max(1, workers)
    for key in (f"{prefix}WORKERS", "RAG_EMBED_WORKERS"):
        env = os.getenv(key)
        if env:
            return max(1, int(env))
    cpu = os.cpu_count() or 4
    return max(2, min(8, cpu))


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
            batch_tokens = response.usage.total_tokens if response.usage else sum(
                count_tokens(t) for t in batch
            )
            if stats is not None:
                stats.add(tokens=batch_tokens, requests=1)
            log.info(
                "openai embed batch %d/%d size=%d tokens=%d",
                batch_num,
                total_batches,
                len(batch),
                batch_tokens,
            )
            return [item.embedding for item in response.data]
        except Exception as exc:
            if is_quota_error(exc) or is_auth_error(exc):
                raise OpenAIFatalError(str(exc)) from exc
            if attempt == MAX_RETRIES - 1:
                if is_openai_fatal_error(exc):
                    raise OpenAIFatalError(str(exc)) from exc
                raise OpenAIEmbedError(str(exc)) from exc
            wait = 2**attempt
            if is_openai_fatal_error(exc):
                wait = max(wait, 15)
            log.warning(
                "openai embed batch %d/%d attempt %d failed (%s), retry in %ds",
                batch_num,
                total_batches,
                attempt + 1,
                exc,
                wait,
            )
            time.sleep(wait)
    return []


def probe_openai(cfg: EmbedConfig, *, stats: EmbedStats | None = None) -> None:
    if not valid_openai_key():
        raise OpenAIFatalError("OPENAI_API_KEY missing or placeholder")
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    _embed_batch(
        client,
        ["rag health check"],
        batch_num=1,
        total_batches=1,
        cfg=cfg,
        stats=stats,
    )


def embed_openai_texts(
    texts: list[str],
    *,
    config: EmbedConfig,
    stats: EmbedStats | None = None,
    workers: int | None = None,
    prefix: str = "",
    probe: bool = True,
) -> list[list[float]]:
    if not texts:
        return []

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIFatalError("OPENAI_API_KEY missing")

    if probe:
        probe_openai(config, stats=stats)

    prepared = [truncate_to_token_limit(t) for t in texts]
    batches = [prepared[i : i + BATCH_SIZE] for i in range(0, len(prepared), BATCH_SIZE)]
    total_batches = len(batches)
    n_workers = resolve_workers(workers, prefix=prefix)

    log.info(
        "openai embedding %d texts in %d batch(es) workers=%d model=%s dims=%d",
        len(prepared),
        total_batches,
        min(n_workers, total_batches),
        config.model,
        config.dimensions,
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
                    cfg=config,
                    stats=stats,
                )
            )
        return vectors

    batch_vectors: list[list[list[float]] | None] = [None] * total_batches
    lock = threading.Lock()

    def _run(batch_num: int, batch: list[str]) -> tuple[int, list[list[float]]]:
        with lock:
            client = OpenAI(api_key=api_key)
        vecs = _embed_batch(
            client,
            batch,
            batch_num=batch_num,
            total_batches=total_batches,
            cfg=config,
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
