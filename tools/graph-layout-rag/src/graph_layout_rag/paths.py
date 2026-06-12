from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from rag_common.profiles import resolve_profile_name as _resolve_profile_name_env

PKG_ROOT = Path(__file__).resolve().parents[2]
REPO_RAG_ROOT = PKG_ROOT.parent / "repo-rag"
ENV_PATH = PKG_ROOT / ".env"
ENV_EXAMPLE_PATH = PKG_ROOT / ".env.example"
REPO_RAG_ENV_PATH = REPO_RAG_ROOT / ".env"
DATA_DIR = PKG_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PDF_DIR = RAW_DIR / "pdf"
HTML_DIR = RAW_DIR / "html"
MANIFEST_PATH = DATA_DIR / "manifest.json"
HARVEST_DB_PATH = DATA_DIR / "harvest.db"
HARVEST_CHECKPOINT_PATH = DATA_DIR / "harvest_checkpoint.json"
HARVEST_LOG_PATH = DATA_DIR / "harvest.log"
INGEST_LOG_PATH = DATA_DIR / "ingest.log"
CHUNKS_TABLE = "chunks"

# Deprecated: single shared index (use profile_index_paths instead).
LANCE_DIR = DATA_DIR / "lancedb"
INGEST_STATE_PATH = DATA_DIR / "ingest_state.json"

_PROFILE_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class ProfileIndexPaths:
    profile: str
    root: Path
    lance_dir: Path
    ingest_state: Path


def indexes_root() -> Path:
    raw = os.getenv("GRAPH_RAG_INDEXES_DIR", "").strip()
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
    """Profile slug for index directory (from CLI, env, or 'default')."""
    name = _resolve_profile_name_env(prefix="GRAPH_RAG_", profile=explicit)
    if not name or name == "default":
        return "default"
    return sanitize_profile_name(name)


def profile_index_paths(profile: str | None = None) -> ProfileIndexPaths:
    slug = sanitize_profile_name(profile) if profile else resolve_profile_name()
    root = indexes_root() / slug
    return ProfileIndexPaths(
        profile=slug,
        root=root,
        lance_dir=root / "lancedb",
        ingest_state=root / "ingest_state.json",
    )


def list_profile_indexes() -> list[ProfileIndexPaths]:
    root = indexes_root()
    if not root.is_dir():
        return []
    out: list[ProfileIndexPaths] = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        paths = ProfileIndexPaths(
            profile=child.name,
            root=child,
            lance_dir=child / "lancedb",
            ingest_state=child / "ingest_state.json",
        )
        if paths.lance_dir.is_dir() or paths.ingest_state.is_file():
            out.append(paths)
    return out
