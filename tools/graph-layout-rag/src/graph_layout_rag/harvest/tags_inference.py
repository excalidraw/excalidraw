"""Infer harvest tags from title/abstract using pipeline taxonomy."""

from __future__ import annotations

from graph_layout_rag.catalog.taxonomy import categories_from_keywords, categories_from_tags


def infer_harvest_tags(
    title: str,
    abstract: str | None = None,
    *,
    existing: list[str] | None = None,
) -> list[str]:
    tags = set(existing or []) | {"bibliography", "graph-drawing"}
    hay = f"{title} {abstract or ''}"
    tags.update(categories_from_keywords(hay))
    if existing:
        for cat in categories_from_tags(existing):
            tags.add(cat)
    return sorted(tags)
