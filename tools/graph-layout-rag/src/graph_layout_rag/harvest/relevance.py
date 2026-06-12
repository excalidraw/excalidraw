"""Relevance filter for graph drawing / layout literature."""

from __future__ import annotations

from graph_layout_rag.catalog.taxonomy import categories_from_keywords

LAYOUT_KEYWORDS = frozenset(
    {
        "graph",
        "layout",
        "drawing",
        "drawn",
        "layer",
        "layered",
        "layering",
        "crossing",
        "sugiyama",
        "orthogonal",
        "planar",
        "node",
        "edge",
        "vertices",
        "visualization",
        "visualisation",
        "diagram",
        "hierarchical",
        "dag",
        "directed",
        "undirected",
        "force-directed",
        "stress",
        "majorization",
        "compound",
        "cluster",
        "grouped",
        "port",
        "routing",
        "elk",
        "kieler",
        "dagre",
        "dot",
        "neato",
        "uml",
        "network",
        "topology",
        "embedding",
        "coordinates",
        "rank",
        "assignment",
        "bundling",
        "sankey",
        "metro",
        "tree",
        "radial",
        "hypergraph",
        "confluence",
        "aesthetic",
        "geometric",
        "compaction",
        "packing",
        "vpsc",
        "overlap",
    }
)

OFF_TOPIC_KEYWORDS = frozenset(
    {
        "genome",
        "genomic",
        "microbiome",
        "microbiota",
        "rna",
        "dna",
        "protein",
        "cancer",
        "tumor",
        "tumour",
        "oncology",
        "clinical trial",
        "patient",
        "hospital",
        "covid",
        "sars-cov",
        "vaccine",
        "epidemiology",
        "pathogen",
        "bacteria",
        "fungal",
        "metagenom",
        "transcriptom",
        "proteom",
        "chromosome",
        "hi-c",
        "sequencing",
        "phylogen",
        "ecology",
        "agriculture",
        "crop",
        "livestock",
        "neurodegener",
        "alzheimer",
        "parkinson",
        "psychiatric",
        "depression",
        "schizophrenia",
        "cardiovascular",
        "diabetes",
        "obesity",
        "pharmacolog",
        "drug discovery",
        "machine learning algorithms real-world",
        "statistical computing",
        "pharmacokinetic",
        "bibliometric mapping",
        "vosviewer",
        "autoregressive time series",
        "variance-based structural",
        "drug-likeness",
        "medicinal chemistry",
        "microarray",
        "proteomics",
    }
)


def _haystack(title: str, abstract: str | None) -> str:
    return f"{title} {abstract or ''}".lower()


def is_pipeline_relevant(title: str, abstract: str | None = None) -> bool:
    """True when title/abstract matches a pipeline-layout category keyword."""
    return bool(categories_from_keywords(_haystack(title, abstract)))


def is_layout_relevant(
    title: str,
    abstract: str | None = None,
    *,
    strict: bool = False,
) -> bool:
    """Return True if title/abstract looks graph-layout related."""
    hay = _haystack(title, abstract)
    if any(k in hay for k in OFF_TOPIC_KEYWORDS):
        return False
    hits = sum(1 for k in LAYOUT_KEYWORDS if k in hay)
    if strict:
        return hits >= 2
    return hits >= 1
