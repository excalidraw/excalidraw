"""Thread pool helpers for parallel harvest downloads."""

from __future__ import annotations

import threading
from collections import deque
from collections.abc import Callable
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from typing import TypeVar

from graph_layout_rag.harvest.log import get_logger

T = TypeVar("T")
R = TypeVar("R")

# I/O-bound harvest: 32 is a good default; use 64 for PDF-heavy runs. Above ~64
# hits API 429s and per-domain rate limits with little gain.
DEFAULT_WORKERS = 32
MAX_WORKERS = 128
_workers: int = DEFAULT_WORKERS
_stop_event = threading.Event()


def set_workers(workers: int) -> None:
    global _workers
    _workers = max(1, min(workers, MAX_WORKERS))


def get_workers() -> int:
    return _workers


def request_stop() -> None:
    _stop_event.set()


def clear_stop() -> None:
    _stop_event.clear()


def stop_requested() -> bool:
    return _stop_event.is_set()


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
    progress_every = max(1, min(10, len(items) // 20))
    pending_items = deque(enumerate(items))
    in_flight: dict[Future[R], int] = {}
    max_in_flight = min(len(items), max(n, n * 2))

    with ThreadPoolExecutor(max_workers=n) as pool:
        def submit_available() -> None:
            while pending_items and len(in_flight) < max_in_flight and not stop_requested():
                idx, item = pending_items.popleft()
                in_flight[pool.submit(func, item)] = idx

        submit_available()
        while in_flight:
            completed, _ = wait(in_flight, return_when=FIRST_COMPLETED)
            for future in completed:
                idx = in_flight.pop(future)
                try:
                    results[idx] = future.result()
                except Exception as exc:
                    log.exception(
                        "%s: worker failed at index %d: %s",
                        label or "parallel_map",
                        idx,
                        exc,
                    )
                done += 1
                if label and (done % progress_every == 0 or done == len(items)):
                    log.info("%s: %d/%d done", label, done, len(items))
            submit_available()

        if stop_requested() and pending_items:
            log.warning(
                "%s: stop requested; skipped %d unsubmitted item(s)",
                label or "parallel_map",
                len(pending_items),
            )

    if stop_requested():
        return [result for result in results if result is not None]
    return results  # type: ignore[return-value]
