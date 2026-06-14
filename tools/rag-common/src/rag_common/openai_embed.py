from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed

import tiktoken
from openai import OpenAI

from rag_common.config import EmbedConfig, EmbedStats
from rag_common.env import is_auth_error, is_openai_fatal_error, is_quota_error, is_rate_limit_error, valid_openai_key

log = logging.getLogger("rag_common.openai")

MAX_INPUT_TOKENS = 8191
BATCH_SIZE = 64
MAX_RETRIES = 8
PROGRESS_WINDOW_SECONDS = 60.0


class OpenAIEmbedError(Exception):
    """OpenAI embedding failed after retries."""


class OpenAIFatalError(OpenAIEmbedError):
    """Auth or rate-limit failure — caller may fall back to local."""


@dataclass
class _Progress:
    total_batches: int
    total_texts: int
    estimated_tokens: int
    started: float = field(default_factory=time.monotonic)
    completed_batches: int = 0
    completed_texts: int = 0
    completed_tokens: int = 0
    active: int = 0
    peak_active: int = 0
    recent: list[tuple[float, int]] = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def start_batch(self) -> int:
        with self.lock:
            self.active += 1
            self.peak_active = max(self.peak_active, self.active)
            return self.active

    def finish_batch(self, texts: int, tokens: int) -> dict[str, float | int]:
        now = time.monotonic()
        with self.lock:
            self.active -= 1
            self.completed_batches += 1
            self.completed_texts += texts
            self.completed_tokens += tokens
            self.recent.append((now, tokens))
            cutoff = now - PROGRESS_WINDOW_SECONDS
            self.recent = [(ts, count) for ts, count in self.recent if ts >= cutoff]
            elapsed = max(now - self.started, 0.001)
            recent_span = max(now - self.recent[0][0], 1.0) if self.recent else elapsed
            cumulative_tpm = self.completed_tokens / elapsed * 60
            rolling_tpm = sum(count for _, count in self.recent) / recent_span * 60
            remaining = max(self.estimated_tokens - self.completed_tokens, 0)
            eta = remaining / (cumulative_tpm / 60) if cumulative_tpm else 0
            return {
                "completed_batches": self.completed_batches,
                "completed_texts": self.completed_texts,
                "completed_tokens": self.completed_tokens,
                "active": self.active,
                "peak_active": self.peak_active,
                "elapsed": elapsed,
                "cumulative_tpm": cumulative_tpm,
                "rolling_tpm": rolling_tpm,
                "eta": eta,
            }


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
    progress: _Progress | None = None,
) -> list[list[float]]:
    for attempt in range(MAX_RETRIES):
        active = progress.start_batch() if progress is not None else 1
        started = time.monotonic()
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
            elapsed = max(time.monotonic() - started, 0.001)
            log.info(
                "openai embed batch %d/%d size=%d tokens=%d latency_s=%.2f batch_tpm=%.0f active_at_start=%d",
                batch_num,
                total_batches,
                len(batch),
                batch_tokens,
                elapsed,
                batch_tokens / elapsed * 60,
                active,
            )
            if progress is not None:
                snapshot = progress.finish_batch(len(batch), batch_tokens)
                log.info(
                    "openai progress batches=%d/%d texts=%d/%d tokens=%d/%d "
                    "elapsed_s=%.1f cumulative_tpm=%.0f rolling_tpm=%.0f active=%d peak_active=%d eta_s=%.1f",
                    snapshot["completed_batches"],
                    progress.total_batches,
                    snapshot["completed_texts"],
                    progress.total_texts,
                    snapshot["completed_tokens"],
                    progress.estimated_tokens,
                    snapshot["elapsed"],
                    snapshot["cumulative_tpm"],
                    snapshot["rolling_tpm"],
                    snapshot["active"],
                    snapshot["peak_active"],
                    snapshot["eta"],
                )
            return [item.embedding for item in response.data]
        except Exception as exc:
            if progress is not None:
                with progress.lock:
                    progress.active -= 1
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
    estimated_tokens = sum(count_tokens(text) for text in prepared)
    batches = [prepared[i : i + BATCH_SIZE] for i in range(0, len(prepared), BATCH_SIZE)]
    total_batches = len(batches)
    n_workers = resolve_workers(workers, prefix=prefix)

    log.info(
        "openai embedding start texts=%d estimated_tokens=%d batches=%d batch_size=%d "
        "workers=%d model=%s dims=%d",
        len(prepared),
        estimated_tokens,
        total_batches,
        BATCH_SIZE,
        min(n_workers, total_batches),
        config.model,
        config.dimensions,
    )
    progress = _Progress(total_batches, len(prepared), estimated_tokens)

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
                    progress=progress,
                )
            )
        elapsed = max(time.monotonic() - progress.started, 0.001)
        log.info(
            "openai embedding done texts=%d tokens=%d requests=%d elapsed_s=%.1f average_tpm=%.0f peak_active=%d",
            len(vectors),
            progress.completed_tokens,
            progress.completed_batches,
            elapsed,
            progress.completed_tokens / elapsed * 60,
            progress.peak_active,
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
            progress=progress,
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

    vectors = [v for batch in batch_vectors if batch for v in batch]
    elapsed = max(time.monotonic() - progress.started, 0.001)
    log.info(
        "openai embedding done texts=%d tokens=%d requests=%d elapsed_s=%.1f average_tpm=%.0f peak_active=%d",
        len(vectors),
        progress.completed_tokens,
        progress.completed_batches,
        elapsed,
        progress.completed_tokens / elapsed * 60,
        progress.peak_active,
    )
    return vectors
