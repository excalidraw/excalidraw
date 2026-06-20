from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path

from rag_common.config import EmbedConfig

from rag_literature_rag.paths import PKG_ROOT

_CACHE_VERSION = 1
_CACHE_DIR = PKG_ROOT / "data" / "embed_cache"


@dataclass
class EmbedCacheStats:
    hits: int = 0
    misses: int = 0


def _key(config: EmbedConfig, *, title: str | None, text: str) -> str:
    raw = json.dumps(
        {
            "v": _CACHE_VERSION,
            "backend": config.backend,
            "model": config.model,
            "dims": config.dimensions,
            "quant": config.quant or "",
            "title": title or "",
            "text": text,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def _path(key: str) -> Path:
    return _CACHE_DIR / key[:2] / f"{key}.json"


def get(config: EmbedConfig, *, title: str | None, text: str) -> list[float] | None:
    path = _path(_key(config, title=title, text=text))
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        vector = data.get("vector")
        if not isinstance(vector, list) or len(vector) != config.dimensions:
            return None
        return [float(v) for v in vector]
    except Exception:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        return None


def put(config: EmbedConfig, *, title: str | None, text: str, vector: list[float]) -> None:
    path = _path(_key(config, title=title, text=text))
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        {
            "v": _CACHE_VERSION,
            "backend": config.backend,
            "model": config.model,
            "dims": config.dimensions,
            "quant": config.quant or "",
            "title": title or "",
            "vector": vector,
        },
        separators=(",", ":"),
    )
    tmp = path.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


def cache_stats() -> dict[str, int]:
    if not _CACHE_DIR.exists():
        return {"entries": 0, "size_mb": 0}
    files = list(_CACHE_DIR.rglob("*.json"))
    size = sum(path.stat().st_size for path in files)
    return {"entries": len(files), "size_mb": round(size / 1024 / 1024)}
