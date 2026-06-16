from __future__ import annotations

from dataclasses import dataclass, field

from rag_literature_rag.manifest import ManifestItem

_DISCOVERY_SOURCES = {"openalex", "dblp", "semantic-scholar", "crossref", "arxiv"}


@dataclass
class IngestDocument:
    item: ManifestItem
    aliases: list[ManifestItem] = field(default_factory=list)

    @property
    def alias_doc_ids(self) -> list[str]:
        return sorted({item.id for item in self.aliases})

    @property
    def alias_source_urls(self) -> list[str]:
        return sorted({item.url for item in self.aliases if item.url})

    @property
    def alias_dois(self) -> list[str]:
        return sorted({item.doi for item in self.aliases if item.doi})


def _metadata_richness(item: ManifestItem) -> int:
    return (
        len(item.tags) * 3
        + len(item.authors) * 2
        + bool(item.abstract) * 3
        + bool(item.doi) * 2
        + bool(item.title)
        + bool(item.year)
    )


def canonical_sort_key(item: ManifestItem) -> tuple[int, int, str]:
    trusted = 0 if item.source.lower() not in _DISCOVERY_SOURCES else 1
    return (trusted, -_metadata_richness(item), item.id)


def _merge_canonical(canonical: ManifestItem, aliases: list[ManifestItem]) -> ManifestItem:
    all_items = [canonical, *aliases]
    richest = min(all_items, key=canonical_sort_key)
    return canonical.model_copy(
        update={
            "title": richest.title or canonical.title,
            "authors": sorted({author for item in all_items for author in item.authors}),
            "tags": sorted({tag for item in all_items for tag in item.tags}),
            "doi": canonical.doi or next((item.doi for item in all_items if item.doi), None),
            "abstract": canonical.abstract or next((item.abstract for item in all_items if item.abstract), None),
        }
    )


def canonical_ingest_projection(items: list[ManifestItem]) -> list[IngestDocument]:
    """Return a duplicate-safe ingestion view without mutating the manifest."""
    pdf_groups: dict[str, list[ManifestItem]] = {}
    pdf_without_sha: list[ManifestItem] = []
    metadata: list[ManifestItem] = []
    for item in items:
        if item.status == "ok" and item.localPath:
            if item.sha256:
                pdf_groups.setdefault(item.sha256, []).append(item)
            else:
                pdf_without_sha.append(item)
        elif item.status == "metadata_only":
            metadata.append(item)

    docs: list[IngestDocument] = []
    indexed_dois: dict[str, IngestDocument] = {}
    for sha in sorted(pdf_groups):
        group = sorted(pdf_groups[sha], key=canonical_sort_key)
        canonical, aliases = group[0], group[1:]
        doc = IngestDocument(_merge_canonical(canonical, aliases), aliases)
        docs.append(doc)
        for item in group:
            if item.doi:
                indexed_dois[item.doi.lower()] = doc
    for item in sorted(pdf_without_sha, key=lambda value: value.id):
        doc = IngestDocument(item)
        docs.append(doc)
        if item.doi:
            indexed_dois[item.doi.lower()] = doc
    for item in sorted(metadata, key=lambda value: value.id):
        alias_of = indexed_dois.get(item.doi.lower()) if item.doi else None
        if alias_of:
            alias_of.aliases.append(item)
            alias_of.item = _merge_canonical(alias_of.item, alias_of.aliases)
        else:
            docs.append(IngestDocument(item))
    return docs
