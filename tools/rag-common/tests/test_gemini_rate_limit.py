from unittest.mock import patch

import pytest

from rag_common.gemini_rate_limit import (
    GeminiRateLimiter,
    estimate_tokens,
    get_rate_limiter,
    reset_rate_limiter,
)


@pytest.fixture(autouse=True)
def _reset_limiter():
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


def test_estimate_tokens():
    assert estimate_tokens("one two three") == 3
    assert estimate_tokens("") == 1


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
