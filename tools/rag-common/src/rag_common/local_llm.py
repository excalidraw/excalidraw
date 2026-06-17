"""Pluggable text-generation backends for RAG query transforms and agents.

Supports Vertex/Gemini (default, backward compatible) and local Ollama via the
OpenAI-compatible ``/v1/chat/completions`` API.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Any

log = logging.getLogger("rag_common.local_llm")

DEFAULT_BACKEND = "gemini"
DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434"
DEFAULT_OLLAMA_MODEL = "gemma4:e4b"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def llm_backend() -> str:
    raw = os.getenv("RAG_LLM_BACKEND", DEFAULT_BACKEND).strip().lower()
    if raw in ("gemini", "ollama"):
        return raw
    return DEFAULT_BACKEND


def ollama_host() -> str:
    return (os.getenv("RAG_OLLAMA_HOST", DEFAULT_OLLAMA_HOST)).strip().rstrip("/")


def ollama_model() -> str:
    return (os.getenv("RAG_OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)).strip() or DEFAULT_OLLAMA_MODEL


def gemini_model() -> str:
    for key in (
        "GRAPH_RAG_AGENT_LLM_MODEL",
        "GRAPH_RAG_EVAL_LLM_MODEL",
        "RAG_LLM_MODEL",
    ):
        value = os.getenv(key, "").strip()
        if value:
            return value
    return DEFAULT_GEMINI_MODEL


def active_model() -> str:
    if llm_backend() == "ollama":
        return ollama_model()
    return gemini_model()


def model_slug(model: str | None = None) -> str:
    name = (model or active_model()).strip()
    slug = re.sub(r"[^\w.-]+", "_", name.lower())
    return slug.strip("_") or "default"


def transform_cache_filename(model: str | None = None) -> str:
    return f"transform_cache_{llm_backend()}_{model_slug(model)}.json"


def llm_metadata() -> dict[str, str]:
    return {"llm_backend": llm_backend(), "llm_model": active_model()}


def generate_text(
    prompt: str,
    *,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 512,
) -> str:
    if llm_backend() == "ollama":
        resolved = model or ollama_model()
        return _generate_ollama(
            prompt,
            model=resolved,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    resolved = model or gemini_model()
    return _generate_gemini(prompt, model=resolved)


def _generate_ollama(
    prompt: str,
    *,
    model: str,
    temperature: float,
    max_tokens: int,
) -> str:
    url = f"{ollama_host()}/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama unavailable at {ollama_host()}: {exc}") from exc

    text = _extract_chat_text(data)
    if not text:
        raise RuntimeError(f"Empty Ollama response from {model}")
    return text


def _extract_chat_text(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    message = data.get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()
    return ""


def _generate_gemini(prompt: str, *, model: str) -> str:
    try:
        from rag_common.gemini_embed import _client, llm_location
    except ImportError as exc:
        raise RuntimeError("Gemini client unavailable; install rag-common[gemini]") from exc

    client = _client(location=llm_location())
    response = client.models.generate_content(model=model, contents=prompt)
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError(f"Empty LLM response from {model}")
    return text
