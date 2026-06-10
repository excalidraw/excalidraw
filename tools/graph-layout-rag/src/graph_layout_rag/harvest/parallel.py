"""Thread pool helpers for parallel harvest downloads."""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TypeVar

from graph_layout_rag.harvest.log import get_logger

T = TypeVar("T")
R = TypeVar("R")

# I/O-bound harvest: 32 is a good default; use 64 for PDF-heavy runs. Above ~64
# hits API 429s and per-domain rate limits with little gain.
DEFAULT_WORKERS = 32
MAX_WORKERS = 128
_workers: int = DEFAULT_WORKERS


def set_workers(workers: int) -> None:
    global _workers
    _workers = max(1, min(workers, MAX_WORKERS))


def get_workers() -> int:
    return _workers


def parallel_map(
    func: Callable[[T], R],
    items: list[T],
    *,
    workers: int | None = None,
    label: str | None = None,
) -> list[R]:
    if not items:
        return []
    n = workers if workers is not None else _workers
    log = get_logger()

    if n <= 1 or len(items) == 1:
        if label:
            log.info("%s: processing %d item(s) sequentially", label, len(items))
        return [func(x) for x in items]

    if label:
        log.info("%s: starting %d items with %d workers", label, len(items), n)

    results: list[R | None] = [None] * len(items)
    done = 0
    lock = threading.Lock()
    progress_every = max(1, len(items) // 20)

    with ThreadPoolExecutor(max_workers=n) as pool:
        futures = {pool.submit(func, item): idx for idx, item in enumerate(items)}
        for future in as_completed(futures):
            idx = futures[future]
            results[idx] = future.result()
            with lock:
                done += 1
                if label and (done % progress_every == 0 or done == len(items)):
                    log.info("%s: %d/%d done", label, done, len(items))

    return results  # type: ignore[return-value]
