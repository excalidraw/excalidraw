from __future__ import annotations

import os

try:
    from openai import APIConnectionError, AuthenticationError, RateLimitError
except ImportError:  # pragma: no cover
    AuthenticationError = RateLimitError = APIConnectionError = ()  # type: ignore[misc, assignment]

PLACEHOLDER_KEYS = frozenset(
    {
        "",
        "sk-your-key-here",
        "sk-your-key",
        "your-api-key-here",
        "your-key-here",
    }
)


def valid_openai_key(key: str | None = None) -> bool:
    value = (key if key is not None else os.getenv("OPENAI_API_KEY")) or ""
    stripped = value.strip()
    if not stripped:
        return False
    if stripped.lower() in PLACEHOLDER_KEYS:
        return False
    return stripped.startswith("sk-")


def is_quota_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "insufficient_quota" in msg or "exceeded your current quota" in msg


def is_rate_limit_error(exc: BaseException) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    msg = str(exc).lower()
    return "rate_limit" in msg or "429" in msg


def is_auth_error(exc: BaseException) -> bool:
    if isinstance(exc, AuthenticationError):
        return True
    msg = str(exc).lower()
    return (
        "401" in msg
        or "403" in msg
        or "invalid_api_key" in msg
        or "incorrect api key" in msg
        or "authentication" in msg
    )


def is_connection_error(exc: BaseException) -> bool:
    if isinstance(exc, APIConnectionError):
        return True
    msg = str(exc).lower()
    return "connection" in msg or "timeout" in msg


def is_openai_fatal_error(exc: BaseException) -> bool:
    return (
        is_auth_error(exc)
        or is_rate_limit_error(exc)
        or is_connection_error(exc)
        or is_quota_error(exc)
    )
