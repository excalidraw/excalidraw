from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path
from typing import Any

import httpx

from graph_layout_rag.paths import DATA_DIR

DEFAULT_CACHE_PATH = DATA_DIR / "eval" / "google_ranking_cache.json"
DEFAULT_MAX_RANKING_UNITS = 500
_lock = threading.Lock()
_units_used = 0


def _cache_path() -> Path:
    raw = os.getenv("GRAPH_RAG_GOOGLE_RANKING_CACHE", "").strip()
    return Path(raw) if raw else DEFAULT_CACHE_PATH


def _load_cache() -> dict[str, list[str]]:
    path = _cache_path()
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: dict[str, list[str]]) -> None:
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cache, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _cache_key(model: str, query: str, rows: list[dict[str, Any]]) -> str:
    payload = {
        "model": model,
        "query": query,
        "records": [
            {
                "id": row.get("id"),
                "title": row.get("title"),
                "text": (row.get("text") or "")[:2000],
            }
            for row in rows
        ],
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def _access_token() -> str:
    import google.auth
    from google.auth.transport.requests import Request

    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(Request())
    return str(credentials.token)


def _consume_unit() -> None:
    global _units_used
    limit = int(
        os.getenv("GRAPH_RAG_MAX_CLOUD_RANKING_UNITS", str(DEFAULT_MAX_RANKING_UNITS))
    )
    with _lock:
        if _units_used >= limit:
            raise RuntimeError(f"Google Ranking API unit cap reached ({limit})")
        _units_used += 1


def rerank_google(
    query: str,
    rows: list[dict[str, Any]],
    *,
    top: int,
    model: str,
) -> list[dict[str, Any]]:
    if os.getenv("GRAPH_RAG_ALLOW_CLOUD_COST", "").lower() not in ("1", "true", "yes"):
        raise RuntimeError("Google Ranking API requires --allow-cloud-cost")
    if not rows:
        return []

    key = _cache_key(model, query, rows)
    cache = _load_cache()
    ranked_ids = cache.get(key)
    if ranked_ids is None:
        _consume_unit()
        project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
        if not project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for Google Ranking API")
        url = (
            "https://discoveryengine.googleapis.com/v1/"
            f"projects/{project}/locations/global/rankingConfigs/default_ranking_config:rank"
        )
        records = [
            {
                "id": str(row.get("id") or idx),
                "title": str(row.get("title") or ""),
                "content": (row.get("text") or "")[:2000],
            }
            for idx, row in enumerate(rows)
        ]
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {_access_token()}"},
            json={"model": model, "query": query, "records": records, "topN": min(top, len(records))},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        ranked_ids = [str(record["id"]) for record in payload.get("records", [])]
        cache[key] = ranked_ids
        _save_cache(cache)

    by_id = {str(row.get("id")): row for row in rows}
    return [
        {**by_id[row_id], "rerank_provider": "google", "rerank_model": model}
        for row_id in ranked_ids[:top]
        if row_id in by_id
    ]
