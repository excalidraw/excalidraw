from unittest.mock import patch

import pytest

from rag_common.gemini_rate_limit import (
    GeminiRateLimiter,
    estimate_tokens,
    get_rate_limiter,
    reset_rate_limiter,
)


@pytest.fixture(autouse=True)
def _reset_limiter(tmp_path, monkeypatch):
    monkeypatch.setenv("RAG_GEMINI_RATE_STATE_PATH", str(tmp_path / "rate-state.json"))
    reset_rate_limiter()
    yield
    reset_rate_limiter()


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "1000",
        "RAG_GEMINI_RATE_HEADROOM": "1.0",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_acquire_records_tokens_in_window():
    limiter = GeminiRateLimiter()
    limiter.acquire(600)
    assert limiter._window_tokens() == 600  # noqa: SLF001
    assert len(limiter._window) == 1  # noqa: SLF001


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "10000",
        "RAG_GEMINI_RATE_HEADROOM": "1.0",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_note_rate_limit_lowers_budget():
    limiter = GeminiRateLimiter()
    before = limiter._budget  # noqa: SLF001
    wait = limiter.note_rate_limit()
    assert wait >= 60
    assert limiter._budget < before  # noqa: SLF001
    assert limiter.snapshot()["rate_limit_429_count"] == 1


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "2000000",
        "RAG_GEMINI_RATE_HEADROOM": "1.0",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_concurrent_rate_limit_burst_only_reduces_once():
    limiter = GeminiRateLimiter()
    limiter.note_rate_limit()
    first = limiter._budget  # noqa: SLF001
    limiter.note_rate_limit()
    assert first == 1000000
    assert limiter._budget == first  # noqa: SLF001


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "10000",
        "RAG_GEMINI_RATE_HEADROOM": "0.5",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_note_success_raises_budget():
    limiter = GeminiRateLimiter()
    start = limiter._budget  # noqa: SLF001
    limiter.note_success()
    assert limiter._budget > start  # noqa: SLF001


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "10000",
        "RAG_GEMINI_RATE_HEADROOM": "0.5",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_snapshot_reports_budget_and_window_utilization():
    limiter = GeminiRateLimiter()
    limiter.acquire(1000)
    snapshot = limiter.snapshot()
    assert snapshot["cap_tokens_per_minute"] == 10000
    assert snapshot["budget_tokens_per_minute"] == 5000
    assert snapshot["window_tokens"] == 1000
    assert snapshot["budget_utilization_percent"] == 20.0


def test_estimate_tokens():
    assert estimate_tokens("one two three") == 3
    assert estimate_tokens("") == 1
    assert estimate_tokens("x" * 100) == 25
    assert estimate_tokens(" ".join(["x"] * 30)) == 30


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "5000",
        "RAG_GEMINI_RATE_HEADROOM": "0.2",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_oversized_request_progresses_when_window_empty():
    limiter = GeminiRateLimiter()
    assert limiter._budget == 1000  # noqa: SLF001
    limiter.acquire(4000)
    assert limiter._window_tokens() == 4000  # noqa: SLF001


@patch.dict(
    "os.environ",
    {
        "RAG_GEMINI_TOKENS_PER_MIN": "5000",
        "RAG_GEMINI_RATE_HEADROOM": "1.0",
        "RAG_GEMINI_MIN_INTERVAL_MS": "0",
    },
    clear=False,
)
def test_get_rate_limiter_singleton():
    a = get_rate_limiter()
    b = get_rate_limiter()
    assert a is b
