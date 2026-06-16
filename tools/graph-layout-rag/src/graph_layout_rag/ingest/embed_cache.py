"""Disk cache for chunk embedding vectors.

Key: sha256 of (embed backend, model, dims, profile, title, embedded text) →
one vector as JSON. Cache hits skip the Gemini/OpenAI embedding API entirely so
that --force / --rebuild runs (embed-model unchanged) and re-ingests after adding
papers pay no re-embedding cost for chunks whose text + embed config are identical.

The key is content-addressed on the *exact* text that gets embedded (post
contextual augmentation) plus the title (Gemini Embedding 2 embeds the title
separately) and the full embed config — so a chunking change, a profile change,
or an embed-model change all naturally produce fresh keys.

Cache lives at data/embed_cache/ (gitignored, like the rest of data/). It trades
disk for API cost: a 3072-dim vector is ~60 KB of JSON per chunk. Files are written
atomically; concurrent writers for the same key are safe (last writer wins, and all
produce identical content for the same key).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path

from graph_layout_rag.paths import PKG_ROOT

log = logging.getLogger(__name__)

_CACHE_VERSION = 1
_CACHE_DIR = PKG_ROOT / "data" / "embed_cache"


def cache_key(
    *,
    backend: str,
    model: str,
    dims: int,
    profile: str | None,
    title: str | None,
    text: str,
) -> str:
    """Stable content-addressed key for one embedded chunk under one embed config."""
    raw = f"v{_CACHE_VERSION}:{backend}:{model}:{dims}:{profile or ''}:{title or ''}\x00{text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    # Two-level shard to avoid huge flat directories.
    return _CACHE_DIR / key[:2] / f"{key}.json"


def get_many(keys: list[str], *, dims: int) -> list[list[float] | None]:
    """Return cached vectors aligned to ``keys``; None for each miss.

    Entries whose stored dimensionality does not match ``dims`` are treated as
    misses and removed (stale config).
    """
    out: list[list[float] | None] = []
    for key in keys:
        out.append(_get_one(key, dims=dims))
    return out


def _get_one(key: str, *, dims: int) -> list[float] | None:
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        vector = data["vector"]
        if data.get("dims") != dims or len(vector) != dims:
            path.unlink(missing_ok=True)
            return None
        return vector
    except Exception as exc:
        log.debug("embed_cache: corrupt entry %s — %s", path.name, exc)
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        return None


def put_many(keys: list[str], vectors: list[list[float]]) -> None:
    """Write vectors to cache, aligned to ``keys``."""
    for key, vector in zip(keys, vectors):
        _put_one(key, vector)


def _put_one(key: str, vector: list[float]) -> None:
    path = _cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"v": _CACHE_VERSION, "dims": len(vector), "vector": vector})
    tmp = path.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


def cache_stats() -> dict[str, int]:
    """Count cache entries on disk."""
    if not _CACHE_DIR.exists():
        return {"entries": 0, "size_mb": 0}
    entries = sum(1 for _ in _CACHE_DIR.rglob("*.json"))
    size = sum(f.stat().st_size for f in _CACHE_DIR.rglob("*.json"))
    return {"entries": entries, "size_mb": round(size / 1024 / 1024)}
