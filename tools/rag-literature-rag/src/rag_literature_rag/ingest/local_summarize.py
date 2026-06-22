from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

from rag_common.local_llm import DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL

_THINKING_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def resolve_ollama_host(*, env_prefix: str = "") -> str:
    for key in (
        f"{env_prefix}OLLAMA_HOST" if env_prefix else "",
        "RAG_OLLAMA_HOST",
    ):
        if key and os.getenv(key, "").strip():
            return os.getenv(key, "").strip().rstrip("/")
    return DEFAULT_OLLAMA_HOST.rstrip("/")


def resolve_ollama_model(*, env_prefix: str = "", default: str | None = None) -> str:
    for key in (
        f"{env_prefix}OLLAMA_MODEL" if env_prefix else "",
        "RAG_OLLAMA_MODEL",
    ):
        if key and os.getenv(key, "").strip():
            return os.getenv(key, "").strip()
    return default or DEFAULT_OLLAMA_MODEL


def generate_ollama(
    prompt: str,
    *,
    model: str,
    host: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.1,
    timeout: int = 180,
) -> str:
    resolved_host = (host or DEFAULT_OLLAMA_HOST).rstrip("/")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    request = urllib.request.Request(
        f"{resolved_host}/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama unavailable at {resolved_host}: {exc}") from exc

    choices = data.get("choices") or []
    if choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    raise RuntimeError(f"Empty Ollama response from {model}")


def unload_ollama_model(model: str, *, host: str | None = None) -> None:
    """Best-effort release of Ollama GPU memory before local embedding starts."""
    resolved_host = (host or DEFAULT_OLLAMA_HOST).rstrip("/")
    payload = {
        "model": model,
        "prompt": "",
        "stream": False,
        "keep_alive": 0,
    }
    request = urllib.request.Request(
        f"{resolved_host}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30):
            return
    except Exception:
        return


def clean_summary(text: str) -> str:
    text = _THINKING_RE.sub("", text).strip()
    text = re.sub(r"^```(?:text)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    return re.sub(r"\s+\n", "\n", text).strip()


def validate_summary(text: str, *, min_words: int) -> None:
    words = re.findall(r"\b[\w.-]+\b", text)
    if len(words) < min_words:
        raise RuntimeError(
            f"Summary generation returned only {len(words)} word(s); "
            "not caching a likely incomplete response"
        )


def bounded_source(source: str, *, max_chars: int) -> str:
    if len(source) <= max_chars:
        return source
    head = max_chars // 2
    tail = max_chars - head
    return source[:head] + "\n\n[...middle omitted for prompt budget...]\n\n" + source[-tail:]
