from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from rag_literature_rag.paths import MANIFEST_PATH

ManifestStatus = Literal["ok", "metadata_only", "failed"]
DocumentKind = Literal["paper", "implementation"]


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
    externalIds: dict[str, str] = Field(default_factory=dict)
    discoverySources: list[str] = Field(default_factory=list)
    sourceUrls: list[str] = Field(default_factory=list)
    abstractSource: str | None = None
    documentKind: DocumentKind = "paper"


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


def merge_items(existing: ManifestItem, incoming: ManifestItem) -> ManifestItem:
    """Merge provider records without losing a stronger previously discovered field."""
    status_rank = {"failed": 0, "metadata_only": 1, "ok": 2}
    preferred = incoming if status_rank[incoming.status] >= status_rank[existing.status] else existing
    fallback = existing if preferred is incoming else incoming
    merged = preferred.model_copy(deep=True)

    for field in (
        "title",
        "authors",
        "year",
        "url",
        "localPath",
        "contentType",
        "sha256",
        "doi",
        "abstract",
        "abstractSource",
    ):
        if not getattr(merged, field):
            setattr(merged, field, getattr(fallback, field))

    merged.tags = sorted(set(existing.tags) | set(incoming.tags))
    merged.discoverySources = sorted(
        set(existing.discoverySources)
        | set(incoming.discoverySources)
        | {existing.source, incoming.source}
    )
    merged.sourceUrls = sorted(
        set(existing.sourceUrls)
        | set(incoming.sourceUrls)
        | {u for u in (existing.url, incoming.url) if u}
    )
    merged.externalIds = {**existing.externalIds, **incoming.externalIds}
    if merged.doi:
        merged.externalIds.setdefault("DOI", merged.doi)
    return merged


def upsert_item(manifest: Manifest, item: ManifestItem) -> None:
    for idx, existing in enumerate(manifest.items):
        same_doi = bool(
            existing.doi
            and item.doi
            and existing.doi.lower().removeprefix("https://doi.org/")
            == item.doi.lower().removeprefix("https://doi.org/")
        )
        if existing.id == item.id or same_doi:
            merged = merge_items(existing, item)
            merged.id = existing.id
            manifest.items[idx] = merged
            return
    manifest.items.append(item)


def manifest_by_id(manifest: Manifest) -> dict[str, ManifestItem]:
    return {item.id: item for item in manifest.items}


def relative_local_path(abs_path: Path) -> str:
    from rag_literature_rag.paths import PKG_ROOT

    return str(abs_path.relative_to(PKG_ROOT))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
