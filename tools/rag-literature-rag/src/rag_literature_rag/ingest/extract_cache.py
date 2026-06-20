"""Disk caches for PDF extraction results.

Key: (pdf_sha256, backend, chunking_fingerprint) → list[TextChunk] as JSON.
Cache hits skip Docling/MuPDF entirely so re-ingests with a new embed profile
or after adding new papers pay no re-extraction cost.

The chunk cache is profile-specific because chunk boundaries can change. The
page cache sits below it and is keyed only by PDF content + extraction backend
options, so future chunking experiments can reuse expensive Docling output and
only redo chunking/embedding.

Caches live at data/extract_cache/ (one file per unique PDF content+backend).
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

from rag_literature_rag.ingest.chunk import ParentChildChunks, TextChunk, chunking_fingerprint
from rag_literature_rag.ingest.extract import PageText
from rag_literature_rag.paths import PKG_ROOT

log = logging.getLogger(__name__)

_CACHE_VERSION = 1
_PAGE_CACHE_VERSION = 1
_CACHE_DIR = PKG_ROOT / "data" / "extract_cache"
_PAGE_CACHE_DIR = _CACHE_DIR / "pages"

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


def _page_cache_key(
    sha256: str,
    backend: str,
    *,
    clean: bool = True,
    options: dict[str, object] | None = None,
) -> str:
    option_fingerprint = json.dumps(
        options or {},
        sort_keys=True,
        separators=(",", ":"),
    )
    raw = f"pages-v{_PAGE_CACHE_VERSION}:{backend}:clean={int(clean)}:{option_fingerprint}:{sha256}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _page_cache_path(key: str) -> Path:
    return _PAGE_CACHE_DIR / key[:2] / f"{key}.json"


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


def get_bundle(
    sha256: str,
    backend: str,
    chunk_profile: str | None = None,
) -> ParentChildChunks | None:
    """Return cached children and optional parents for dual-profile extraction."""
    if not sha256:
        return None
    path = _cache_path(_cache_key(sha256, backend, chunk_profile))
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        children = [TextChunk(**c) for c in data["chunks"]]
        parents = [TextChunk(**c) for c in data.get("parents", [])]
        return ParentChildChunks(children=children, parents=parents)
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


def put_bundle(
    sha256: str,
    backend: str,
    bundle: ParentChildChunks,
    chunk_profile: str | None = None,
) -> None:
    """Write child and parent chunks to cache. No-op if sha256 is empty."""
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
            "chunks": [dataclasses.asdict(c) for c in bundle.children],
            "parents": [dataclasses.asdict(c) for c in bundle.parents],
        },
        ensure_ascii=False,
    )
    tmp = path.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


def get_pages(
    sha256: str,
    backend: str,
    *,
    clean: bool = True,
    options: dict[str, object] | None = None,
) -> list[PageText] | None:
    """Return cached extracted pages or None on miss."""
    if not sha256:
        return None
    path = _page_cache_path(
        _page_cache_key(sha256, backend, clean=clean, options=options)
    )
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [PageText(page=int(row["page"]), text=str(row["text"])) for row in data["pages"]]
    except Exception as exc:
        log.debug("extract_cache: corrupt page entry %s — %s", path.name, exc)
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        return None


def put_pages(
    sha256: str,
    backend: str,
    pages: list[PageText],
    *,
    clean: bool = True,
    options: dict[str, object] | None = None,
) -> None:
    """Write extracted pages to cache. No-op for empty results."""
    if not sha256 or not pages:
        return
    path = _page_cache_path(
        _page_cache_key(sha256, backend, clean=clean, options=options)
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        {
            "v": _PAGE_CACHE_VERSION,
            "sha256": sha256,
            "backend": backend,
            "clean": clean,
            "options": options or {},
            "pages": [dataclasses.asdict(page) for page in pages],
        },
        ensure_ascii=False,
    )
    tmp = path.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


def cache_stats() -> dict[str, int]:
    """Count cache entries on disk."""
    if not _CACHE_DIR.exists():
        return {
            "entries": 0,
            "page_entries": 0,
            "chunk_entries": 0,
            "size_mb": 0,
        }
    files = list(_CACHE_DIR.rglob("*.json"))
    page_entries = sum(1 for path in files if _PAGE_CACHE_DIR in path.parents)
    entries = len(files)
    size = sum(f.stat().st_size for f in files)
    return {
        "entries": entries,
        "page_entries": page_entries,
        "chunk_entries": entries - page_entries,
        "size_mb": round(size / 1024 / 1024),
    }


def invalidate(
    sha256: str,
    backend: str,
    *,
    chunk_profiles: list[str | None] | tuple[str | None, ...] = (None,),
    clean: bool = True,
    options: dict[str, object] | None = None,
) -> dict[str, int | list[str]]:
    """Remove page/chunk cache entries for one PDF/backend pair.

    The repair path uses this before re-ingesting fallback docs so a stale
    metadata-or-empty extraction cache cannot mask a local extractor recovery.
    """
    removed: list[str] = []
    if not sha256:
        return {"removed": 0, "paths": removed}

    page_path = _page_cache_path(
        _page_cache_key(sha256, backend, clean=clean, options=options)
    )
    for path in [page_path, *[_cache_path(_cache_key(sha256, backend, profile)) for profile in chunk_profiles]]:
        try:
            if path.exists():
                path.unlink()
                removed.append(str(path))
        except OSError as exc:
            log.warning("extract_cache: failed to invalidate %s — %s", path, exc)
    return {"removed": len(removed), "paths": removed}
