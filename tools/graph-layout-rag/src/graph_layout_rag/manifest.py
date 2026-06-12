from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from graph_layout_rag.paths import MANIFEST_PATH

ManifestStatus = Literal["ok", "metadata_only", "failed"]


class ManifestItem(BaseModel):
    id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    source: str
    url: str
    localPath: str | None = None
    contentType: str | None = None
    status: ManifestStatus
    tags: list[str] = Field(default_factory=list)
    sha256: str | None = None
    doi: str | None = None
    abstract: str | None = None


class Manifest(BaseModel):
    version: int = 1
    updatedAt: str = ""
    items: list[ManifestItem] = Field(default_factory=list)


def slug_id(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:80]


def load_manifest() -> Manifest:
    if not MANIFEST_PATH.exists():
        return Manifest(updatedAt=_now_iso())
    raw = MANIFEST_PATH.read_text(encoding="utf-8")
    return Manifest.model_validate(json.loads(raw))


def save_manifest(manifest: Manifest) -> None:
    manifest.updatedAt = _now_iso()
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST_PATH.with_suffix(".json.tmp")
    tmp.write_text(
        f"{manifest.model_dump_json(indent=2)}\n",
        encoding="utf-8",
    )
    os.replace(tmp, MANIFEST_PATH)


def upsert_item(manifest: Manifest, item: ManifestItem) -> None:
    for idx, existing in enumerate(manifest.items):
        if existing.id == item.id:
            manifest.items[idx] = item
            return
    manifest.items.append(item)


def manifest_by_id(manifest: Manifest) -> dict[str, ManifestItem]:
    return {item.id: item for item in manifest.items}


def relative_local_path(abs_path: Path) -> str:
    from graph_layout_rag.paths import PKG_ROOT

    return str(abs_path.relative_to(PKG_ROOT))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
