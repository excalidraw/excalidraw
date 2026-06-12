from __future__ import annotations

import os
from pathlib import Path

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
        "your-gcp-project-id",
        "your-actual-project-id",
    }
)

PLACEHOLDER_CREDENTIAL_PATHS = frozenset(
    {
        "/absolute/path/to/service-account.json",
        "/path/to/service-account.json",
    }
)


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def valid_gemini_key(key: str | None = None) -> bool:
    if key is not None:
        value = key
    else:
        value = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    stripped = value.strip()
    if not stripped:
        return False
    if stripped.lower() in PLACEHOLDER_KEYS:
        return False
    return True


def valid_vertex_gemini_auth() -> bool:
    """Vertex AI path for Gemini embeddings (ADC / service account)."""
    if not _truthy_env("GOOGLE_GENAI_USE_VERTEXAI"):
        return False
    project = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or ""
    ).strip()
    if not project or project.lower() in PLACEHOLDER_KEYS:
        return False
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if creds_path:
        if creds_path in PLACEHOLDER_CREDENTIAL_PATHS:
            creds_path = ""
        else:
            path = Path(creds_path).expanduser()
            if not path.is_file():
                # Unset or placeholder path — fall back to gcloud ADC
                if "your" in creds_path.lower() or "path/to" in creds_path.lower():
                    creds_path = ""
                else:
                    return False
            elif path.name in PLACEHOLDER_KEYS:
                creds_path = ""
    # No key file required when using gcloud application-default login
    return True


def valid_gemini_auth() -> bool:
    """AI Studio API key or Vertex AI with project configured."""
    return valid_gemini_key() or valid_vertex_gemini_auth()


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
