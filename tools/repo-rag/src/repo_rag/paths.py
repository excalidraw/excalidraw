from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from rag_common.profiles import resolve_profile_name as _resolve_profile_name_env

PKG_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PKG_ROOT.parent.parent
ENV_PATH = PKG_ROOT / ".env"
ENV_EXAMPLE_PATH = PKG_ROOT / ".env.example"

_data_override = os.getenv("REPO_RAG_DATA_DIR")
DATA_DIR = Path(_data_override).expanduser().resolve() if _data_override else PKG_ROOT / "data"
DEFAULT_LOG_FILE = DATA_DIR / "repo-rag.log"
MANIFEST_PATH = DATA_DIR / "manifest.json"
GRAPH_DB_PATH = DATA_DIR / "graph.sqlite"
CHUNKS_TABLE = "chunks"
EVAL_QUERIES_PATH = PKG_ROOT / "eval" / "queries.json"

# Deprecated flat layout (legacy fallback when data/indexes/ is empty).
LANCE_DIR = DATA_DIR / "lancedb"
BM25_DIR = DATA_DIR / "bm25"
INGEST_STATE_PATH = DATA_DIR / "ingest_state.json"

EMBED_COST_PER_MILLION_TOKENS = 0.13

_PROFILE_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class ProfileIndexPaths:
    profile: str
    root: Path
    lance_dir: Path
    ingest_state: Path
    bm25_dir: Path


def indexes_root() -> Path:
    raw = os.getenv("REPO_RAG_INDEXES_DIR", "").strip()
    if raw:
        path = Path(raw)
        return path if path.is_absolute() else PKG_ROOT / path
    return DATA_DIR / "indexes"


def sanitize_profile_name(name: str) -> str:
    cleaned = _PROFILE_SAFE.sub("-", name.strip()).strip("-")
    if not cleaned:
        raise ValueError(f"Invalid embed profile name: {name!r}")
    return cleaned


def resolve_profile_name(explicit: str | None = None) -> str:
    name = _resolve_profile_name_env(prefix="REPO_RAG_", profile=explicit)
    if not name or name == "default":
        return "default"
    return sanitize_profile_name(name)


def _legacy_flat_paths(profile: str) -> ProfileIndexPaths:
    return ProfileIndexPaths(
        profile=profile,
        root=DATA_DIR,
        lance_dir=LANCE_DIR,
        ingest_state=INGEST_STATE_PATH,
        bm25_dir=BM25_DIR,
    )


def _indexes_dir_populated() -> bool:
    root = indexes_root()
    if not root.is_dir():
        return False
    return any(child.is_dir() for child in root.iterdir())


def profile_index_paths(profile: str | None = None) -> ProfileIndexPaths:
    slug = sanitize_profile_name(profile) if profile else resolve_profile_name()
    root = indexes_root() / slug
    per_profile = ProfileIndexPaths(
        profile=slug,
        root=root,
        lance_dir=root / "lancedb",
        ingest_state=root / "ingest_state.json",
        bm25_dir=root / "bm25",
    )
    if per_profile.lance_dir.is_dir() or per_profile.ingest_state.is_file():
        return per_profile
    # New explicit profiles use per-profile dirs when no legacy match.
    if LANCE_DIR.is_dir() and INGEST_STATE_PATH.is_file():
        try:
            stored = json.loads(INGEST_STATE_PATH.read_text(encoding="utf-8"))
            stored_profile = stored.get("embed_profile")
            if stored_profile and sanitize_profile_name(str(stored_profile)) == slug:
                return _legacy_flat_paths(slug)
        except (json.JSONDecodeError, OSError):
            pass
    if slug != "default" and not (indexes_root() / slug).exists():
        return per_profile
    if LANCE_DIR.is_dir() and not _indexes_dir_populated():
        legacy_profile = slug
        if INGEST_STATE_PATH.is_file():
            try:
                stored = json.loads(INGEST_STATE_PATH.read_text(encoding="utf-8"))
                legacy_profile = str(stored.get("embed_profile") or slug)
            except (json.JSONDecodeError, OSError):
                pass
        return _legacy_flat_paths(legacy_profile)
    return per_profile


def list_profile_indexes() -> list[ProfileIndexPaths]:
    out: list[ProfileIndexPaths] = []
    root = indexes_root()
    if root.is_dir():
        for child in sorted(root.iterdir()):
            if not child.is_dir():
                continue
            paths = ProfileIndexPaths(
                profile=child.name,
                root=child,
                lance_dir=child / "lancedb",
                ingest_state=child / "ingest_state.json",
                bm25_dir=child / "bm25",
            )
            if paths.lance_dir.is_dir() or paths.ingest_state.is_file():
                out.append(paths)
    if LANCE_DIR.is_dir() and not out:
        out.append(_legacy_flat_paths("legacy"))
    return out
