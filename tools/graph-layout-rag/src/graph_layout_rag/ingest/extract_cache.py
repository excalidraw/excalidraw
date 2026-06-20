"""Disk cache for PDF extraction results.

Key: (pdf_sha256, backend, chunking_fingerprint) → list[TextChunk] as JSON.
Cache hits skip Docling/MuPDF entirely so re-ingests with a new embed profile
or after adding new papers pay no re-extraction cost.

Cache lives at data/extract_cache/ (one file per unique PDF content+backend).
Files are written atomically; concurrent writers for the same key are safe —
last writer wins, and all produce identical content for the same key.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import os
from pathlib import Path

from graph_layout_rag.ingest.chunk import TextChunk, chunking_fingerprint
from graph_layout_rag.paths import PKG_ROOT

log = logging.getLogger(__name__)

_CACHE_VERSION = 1
_CACHE_DIR = PKG_ROOT / "data" / "extract_cache"

def _cache_key(sha256: str, backend: str, chunk_profile: str | None = None) -> str:
    fingerprint = json.dumps(
        chunking_fingerprint(chunk_profile),
        sort_keys=True,
        separators=(",", ":"),
    )
    raw = f"v{_CACHE_VERSION}:{backend}:{fingerprint}:{sha256}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_path(key: str) -> Path:
    # Two-level shard to avoid huge flat directories
    return _CACHE_DIR / key[:2] / f"{key}.json"


def get(sha256: str, backend: str, chunk_profile: str | None = None) -> list[TextChunk] | None:
    """Return cached chunks or None on miss."""
    if not sha256:
        return None
    path = _cache_path(_cache_key(sha256, backend, chunk_profile))
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [TextChunk(**c) for c in data["chunks"]]
    except Exception as exc:
        log.debug("extract_cache: corrupt entry %s — %s", path.name, exc)
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        return None


def put(
    sha256: str,
    backend: str,
    chunks: list[TextChunk],
    chunk_profile: str | None = None,
) -> None:
    """Write chunks to cache. No-op if sha256 is empty."""
    if not sha256:
        return
    path = _cache_path(_cache_key(sha256, backend, chunk_profile))
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        {
            "v": _CACHE_VERSION,
            "sha256": sha256,
            "backend": backend,
            "chunking_fingerprint": chunking_fingerprint(chunk_profile),
            "chunks": [dataclasses.asdict(c) for c in chunks],
        },
        ensure_ascii=False,
    )
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
