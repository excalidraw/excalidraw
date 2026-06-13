"""Adaptive token-per-minute pacing for Gemini / Vertex embed_content."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections import deque
from pathlib import Path

log = logging.getLogger("rag_common.gemini")

WINDOW_SEC = 60.0
DEFAULT_TOKENS_PER_MIN = 2_000_000
DEFAULT_HEADROOM = 0.95
DEFAULT_MIN_INTERVAL_MS = 5
_MIN_BUDGET = 1_000

_limiter: GeminiRateLimiter | None = None
_limiter_lock = threading.Lock()


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4, len(text.split()))


def _tokens_per_min_cap() -> int:
    raw = os.getenv("RAG_GEMINI_TOKENS_PER_MIN", str(DEFAULT_TOKENS_PER_MIN)).strip()
    try:
        return max(_MIN_BUDGET, int(raw))
    except ValueError:
        return DEFAULT_TOKENS_PER_MIN


def _headroom() -> float:
    raw = os.getenv("RAG_GEMINI_RATE_HEADROOM", str(DEFAULT_HEADROOM)).strip()
    try:
        return min(1.0, max(0.1, float(raw)))
    except ValueError:
        return DEFAULT_HEADROOM


def _min_interval_sec() -> float:
    raw = os.getenv("RAG_GEMINI_MIN_INTERVAL_MS", str(DEFAULT_MIN_INTERVAL_MS)).strip()
    try:
        return max(0.0, int(raw) / 1000.0)
    except ValueError:
        return DEFAULT_MIN_INTERVAL_MS / 1000.0


def _state_path() -> Path:
    override = os.getenv("RAG_GEMINI_RATE_STATE_PATH", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".cache" / "rag-common" / "gemini_rate_state.json"


def _load_persisted_budget(path: Path) -> float | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        budget = float(data.get("budget", 0))
        if budget >= _MIN_BUDGET:
            return budget
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        pass
    return None


def _save_budget(path: Path, budget: float) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"budget": budget, "updated_at": time.time()}, indent=2) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        log.debug("could not persist gemini rate state: %s", exc)


class GeminiRateLimiter:
    """Sliding-window TPM limiter with AIMD tuning on 429."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._window: deque[tuple[float, int]] = deque()
        self._cap = _tokens_per_min_cap()
        self._state_path = _state_path()
        persisted = _load_persisted_budget(self._state_path)
        self._budget = persisted if persisted is not None else self._cap * _headroom()
        self._budget = min(self._budget, self._cap)
        self._last_request_at = 0.0
        self._rate_limit_count = 0

    def _prune(self, now: float) -> None:
        cutoff = now - WINDOW_SEC
        while self._window and self._window[0][0] <= cutoff:
            self._window.popleft()

    def _window_tokens(self) -> int:
        return sum(tokens for _, tokens in self._window)

    def acquire(self, tokens: int) -> None:
        tokens = max(1, tokens)
        min_gap = _min_interval_sec()
        while True:
            with self._lock:
                now = time.time()
                self._prune(now)
                window_tokens = self._window_tokens()
                # A single request may exceed the adaptive budget. Admit it only into
                # an empty window so AIMD can recover without deadlocking the caller.
                if window_tokens + tokens <= self._budget or (
                    not self._window and tokens <= self._cap
                ):
                    since_last = now - self._last_request_at
                    if since_last < min_gap:
                        wait = min_gap - since_last
                    else:
                        self._window.append((now, tokens))
                        self._last_request_at = now
                        return
                else:
                    if self._window:
                        wait = max(0.05, self._window[0][0] + WINDOW_SEC - now)
                    else:
                        wait = 0.25
            time.sleep(wait)

    def note_success(self) -> None:
        with self._lock:
            self._cap = _tokens_per_min_cap()
            self._budget = min(self._cap, self._budget * 1.02)

    def note_rate_limit(self, *, retry_after: int | None = None) -> float:
        with self._lock:
            self._cap = _tokens_per_min_cap()
            self._budget = max(_MIN_BUDGET, self._budget * 0.5)
            self._rate_limit_count += 1
            _save_budget(self._state_path, self._budget)
            wait = float(max(60, retry_after or 0))
            log.info(
                "gemini rate limit: budget=%d tpm (cap=%d), sleeping %.0fs",
                int(self._budget),
                self._cap,
                wait,
            )
        return wait

    def snapshot(self) -> dict[str, int | float]:
        """Return thread-safe limiter telemetry for ingest status reporting."""
        with self._lock:
            now = time.time()
            self._prune(now)
            window_tokens = self._window_tokens()
            return {
                "cap_tokens_per_minute": self._cap,
                "budget_tokens_per_minute": int(self._budget),
                "window_tokens": window_tokens,
                "budget_utilization_percent": round(
                    (window_tokens / self._budget * 100) if self._budget else 0.0,
                    2,
                ),
                "cap_utilization_percent": round(
                    (window_tokens / self._cap * 100) if self._cap else 0.0,
                    2,
                ),
                "rate_limit_429_count": self._rate_limit_count,
            }


def get_rate_limiter() -> GeminiRateLimiter:
    global _limiter
    with _limiter_lock:
        if _limiter is None:
            _limiter = GeminiRateLimiter()
        return _limiter


def reset_rate_limiter() -> None:
    """Reset singleton (tests)."""
    global _limiter
    with _limiter_lock:
        _limiter = None
