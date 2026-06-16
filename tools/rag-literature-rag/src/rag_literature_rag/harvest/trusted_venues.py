"""Trusted NLP/IR venue harvest via OpenAlex source filters."""

from __future__ import annotations

from rag_literature_rag.harvest.openalex import harvest_openalex
from rag_literature_rag.manifest import ManifestItem


# ACL Anthology, SIGIR proceedings — discovered via OpenAlex broad + crossref ISSN.
def harvest_trusted_venues(
    *,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
    **kwargs,
) -> list[ManifestItem]:
    items = harvest_openalex(
        max_works=120,
        max_per_topic=20,
        dry_run=dry_run,
        use_topic_queries=False,
        oa_only=True,
        workers=workers,
        existing_ids=existing_ids,
        pipeline_only=False,
    )
    for item in items:
        if "trusted-venue" not in item.tags:
            item.tags = sorted({*item.tags, "trusted-venue"})
        item.source = item.source or "trusted-venue"
    return items
