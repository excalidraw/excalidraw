"""Bibliography from The Eclipse Layout Kernel (arXiv:2311.00533)."""

from __future__ import annotations

from graph_layout_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import ManifestItem, slug_id

# DOIs extracted from ELK paper references (Domrös et al., arXiv:2311.00533)
ELK_REFERENCE_DOIS = [
    "10.1007/3-540-45848-4_3",
    "10.1007/BF00288685",
    "10.5220/0010833800003124",
    "10.5220/0010186400380049",
    "10.5220/0011656700003417",
    "10.1109/INFVIS.2005.1532130",
    "10.1007/978-3-642-00219-9_37",
    "10.1016/0020-0190(93)90079-O",
    "10.1016/j.infsof.2016.07.007",
    "10.1007/978-3-540-31843-9_19",
    "10.1093/bioinformatics/btv557",
    "10.1007/978-3-642-16145-2_14",
    "10.1002/spe.4380211102",
    "10.1007/978-3-540-31843-9_25",
    "10.1002/spe.33003011003",
    "10.1145/2594291.2594310",
    "10.1007/978-3-031-19756-7_5",
    "10.1016/0167-6423(87)90036-0",
    "10.1007/978-3-319-50106-2_17",
    "10.1007/978-3-319-50106-2_16",
    "10.1007/978-3-319-91376-6_10",
    "10.1145/2976767.2976805",
    "10.1007/978-3-319-27261-0_12",
    "10.1007/978-3-319-42333-3_16",
    "10.1007/BFb0021828",
    "10.1109/VLHCC.2013.6645246",
    "10.21941/kcss/2019/4",
    "10.1109/VLHCC.2014.6883019",
    "10.1109/VLHCC.2016.7739657",
    "10.1007/978-3-319-42333-3_17",
    "10.1016/j.jvlc.2013.11.005",
    "10.1007/978-3-319-91376-6_10",
    "10.1007/978-3-642-11805-0_14",
    "10.1007/978-3-642-00219-9_25",
    "10.1007/978-3-642-55946-3",
    "10.1007/978-3-319-42333-3_2",
    "10.1109/TSMC.1981.4308636",
    "10.1002/spe.4380211102",
    "10.1007/978-3-642-11805-0_19",
    "10.1016/j.comgeo.2022.101886",
    "10.1016/j.dam.2005.05.023",
    "10.1145/1064546.1180618",
    "10.5220/0011803000003417",
    "10.1007/978-3-319-91376-6_10",
    "10.1007/978-3-642-11805-0_2",
    "10.1007/978-3-319-42333-3_16",
    "10.1007/978-3-319-91376-6_10",
    "10.1007/978-3-319-42333-3_17",
    "10.1007/978-3-642-11805-0_14",
    "10.1007/978-3-319-42333-3_2",
]

# Titles without DOI in ELK refs — metadata stubs
ELK_METADATA_ONLY = [
    {
        "id": "elk-ref-ogdf-poster",
        "title": "The Open Graph Drawing Framework (OGDF)",
        "authors": ["Chimani", "Gutwenger", "Jünger", "Mutzel"],
        "year": 2007,
        "tags": ["elk-bibliography", "compound"],
        "abstract": "OGDF open graph drawing framework; cited by ELK paper.",
    },
    {
        "id": "elk-ref-eades-heuristic",
        "title": "A Heuristic for Graph Drawing",
        "authors": ["Eades"],
        "year": 1984,
        "tags": ["elk-bibliography", "force-directed"],
        "abstract": "Classic force-directed heuristic; ELK bibliography ref 11.",
    },
]

TAG_KEYWORDS: dict[str, list[str]] = {
    "layer": ["layer-assignment", "layered"],
    "layering": ["layer-assignment", "layered"],
    "compound": ["compound", "grouped"],
    "port": ["ports", "constraints"],
    "constraint": ["constraints"],
    "separation": ["constraints", "elastic"],
    "crossing": ["crossing"],
    "sugiyama": ["sugiyama", "layered"],
    "wrap": ["wrapping", "layered"],
    "compact": ["compaction", "layered"],
    "stress": ["stress", "force-directed"],
    "force": ["force-directed"],
    "coordinate": ["coordinate-assignment"],
    "horizontal": ["coordinate-assignment"],
    "hypergraph": ["layered"],
    "order": ["sugiyama"],
    "label": ["labeling"],
    "edge": ["routing"],
    "routing": ["routing"],
    "tree": ["tree"],
    "radial": ["radial"],
}


def infer_elk_tags(title: str) -> list[str]:
    hay = title.lower()
    tags = {"elk-bibliography", "elk"}
    for keyword, values in TAG_KEYWORDS.items():
        if keyword in hay:
            tags.update(values)
    return sorted(tags)


def _resolve_elk_doi(doi: str, *, dry_run: bool) -> ManifestItem:
    item = resolve_doi_with_fallbacks(
        doi,
        source="elk-bibliography",
        tags=["elk-bibliography", "elk"],
        dry_run=dry_run,
    )
    item.tags = sorted(set([*item.tags, *infer_elk_tags(item.title)]))
    item.id = slug_id(f"elk-{doi}")
    return item


def harvest_elk_references(*, dry_run: bool = False, workers: int | None = None) -> list[ManifestItem]:
    seen_dois: list[str] = []
    seen: set[str] = set()
    for doi in ELK_REFERENCE_DOIS:
        if doi not in seen:
            seen.add(doi)
            seen_dois.append(doi)

    results: list[ManifestItem] = parallel_map(
        lambda doi: _resolve_elk_doi(doi, dry_run=dry_run),
        seen_dois,
        workers=workers,
    )

    for spec in ELK_METADATA_ONLY:
        results.append(
            ManifestItem(
                id=spec["id"],
                title=spec["title"],
                authors=spec.get("authors", []),
                year=spec.get("year"),
                source="elk-bibliography",
                url=f"https://arxiv.org/abs/2311.00533",
                contentType="text/metadata",
                status="metadata_only",
                tags=[*spec.get("tags", []), "elk"],
                abstract=spec.get("abstract"),
            )
        )

    return results
