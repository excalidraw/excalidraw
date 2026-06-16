"""Classify manifest items into pipeline-layout categories."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from rag_literature_rag.catalog.taxonomy import (
    PIPELINE_CATEGORIES,
    UNCATEGORIZED,
    categories_from_keywords,
    categories_from_tags,
)
from rag_literature_rag.harvest.relevance import is_layout_relevant
from rag_literature_rag.manifest import ManifestItem, load_manifest
from rag_literature_rag.paths import PDF_DIR


@dataclass
class CatalogEntry:
    doc_id: str
    title: str
    year: int | None
    source: str
    status: str
    local_path: str | None
    categories: list[str]
    methods: list[str]
    has_pdf: bool
    tags: list[str]
    off_topic: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def classify_item(item: ManifestItem) -> tuple[list[str], list[str]]:
    """Return (categories, methods) for one manifest item."""
    tag_cats = categories_from_tags(item.tags)
    hay = f"{item.title} {item.abstract or ''}"
    keyword_cats = categories_from_keywords(hay)

    ordered: list[str] = []
    methods: list[str] = []
    for cat in PIPELINE_CATEGORIES:
        if cat in tag_cats or cat in keyword_cats:
            ordered.append(cat)
            methods.append("tag" if cat in tag_cats else "keyword")
    return ordered, methods


def _has_pdf_on_disk(item: ManifestItem) -> bool:
    if item.localPath:
        stem = Path(item.localPath).name
        return (PDF_DIR / stem).is_file()
    return (PDF_DIR / f"{item.id}.pdf").is_file()


def _orphan_entries(existing_ids: set[str]) -> list[CatalogEntry]:
    if not PDF_DIR.is_dir():
        return []
    entries: list[CatalogEntry] = []
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        if pdf.stem in existing_ids:
            continue
        entries.append(
            CatalogEntry(
                doc_id=pdf.stem,
                title=pdf.stem,
                year=None,
                source="orphan",
                status="orphan",
                local_path=f"data/raw/pdf/{pdf.name}",
                categories=[],
                methods=[],
                has_pdf=True,
                tags=[],
                off_topic=False,
            )
        )
    return entries


def build_catalog(
    *,
    status: str | None = "ok",
    include_orphans: bool = False,
    flag_off_topic: bool = False,
) -> list[CatalogEntry]:
    manifest = load_manifest()
    entries: list[CatalogEntry] = []
    seen_ids: set[str] = set()

    for item in manifest.items:
        if status and item.status != status:
            continue
        if status == "ok" and not item.localPath and not _has_pdf_on_disk(item):
            continue

        categories, methods = classify_item(item)
        hay = f"{item.title} {item.abstract or ''}"
        off_topic = flag_off_topic and not is_layout_relevant(item.title, item.abstract)

        entries.append(
            CatalogEntry(
                doc_id=item.id,
                title=item.title,
                year=item.year,
                source=item.source,
                status=item.status,
                local_path=item.localPath,
                categories=categories,
                methods=methods,
                has_pdf=_has_pdf_on_disk(item),
                tags=list(item.tags),
                off_topic=off_topic,
            )
        )
        seen_ids.add(item.id)

    if include_orphans:
        entries.extend(_orphan_entries(seen_ids))

    return entries


def summarize_catalog(entries: list[CatalogEntry]) -> dict:
    by_category: dict[str, dict[str, int]] = {
        cat: {"total": 0, "tag": 0, "keyword": 0} for cat in PIPELINE_CATEGORIES
    }
    uncategorized = 0
    by_source: dict[str, int] = {}
    off_topic = 0

    for entry in entries:
        by_source[entry.source] = by_source.get(entry.source, 0) + 1
        if entry.off_topic:
            off_topic += 1
        if not entry.categories:
            uncategorized += 1
            continue
        for cat, method in zip(entry.categories, entry.methods, strict=True):
            by_category[cat]["total"] += 1
            by_category[cat][method] += 1

    return {
        "total": len(entries),
        "by_category": by_category,
        "uncategorized": uncategorized,
        "by_source": dict(sorted(by_source.items(), key=lambda x: -x[1])),
        "off_topic": off_topic,
    }
