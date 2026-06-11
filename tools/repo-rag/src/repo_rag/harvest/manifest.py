from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from repo_rag.paths import MANIFEST_PATH


class FileEntry(BaseModel):
    path: str
    sha256: str
    source_type: str
    package: str
    is_test: bool = False
    tags: list[str] = Field(default_factory=list)


class RepoManifest(BaseModel):
    version: int = 1
    files: list[FileEntry] = Field(default_factory=list)


def load_manifest() -> RepoManifest:
    if not MANIFEST_PATH.exists():
        return RepoManifest()
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return RepoManifest.model_validate(data)


def save_manifest(manifest: RepoManifest) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest.model_dump(), indent=2) + "\n",
        encoding="utf-8",
    )
