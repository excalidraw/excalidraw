"""Relevance filter for graph drawing / layout literature.

Uses a small scoring model rather than a flat keyword-OR test. The old
``LAYOUT_KEYWORDS`` set passed any text containing a single generic word
(``graph``, ``network``, ``tree``, ``layout``, ``architecture``), which let in
the OpenAlex long tail (root architecture of boreal trees, neural networks,
wind-turbine dynamics, etc.). The scoring model requires either a
drawing/algorithm-specific *strong* term, or several generic *weak* terms that
co-occur with a visualization-context word.
"""

from __future__ import annotations

# High-signal, hand-curated harvest sources. Items from these are always kept by
# the relevance gates (verify downgrade, prune) regardless of score — they are
# foundational seeds whose titles/abstracts may be terse.
CURATED_SOURCES = frozenset(
    {
        "graphviz.org",
        "handbook",
        "book",
        "topic-seed",
        "curated",
        "elk-bibliography",
        "research-thread",
        "kiel",
        "saarland",
        "monash",
        "ubc",
        "nsf-par",
        "springer",
        "wiley",
        "mermaid",
        "elk",
        "ogdf",
        "dagre",
        "yifanhu",
    }
)

# Strong, drawing/algorithm-specific terms. Any single one proves relevance.
STRONG_LAYOUT_TERMS = frozenset(
    {
        "graph drawing",
        "graph layout",
        "graph visualization",
        "graph visualisation",
        "node-link",
        "node link diagram",
        "sugiyama",
        "layered graph",
        "layered drawing",
        "layered layout",
        "layer assignment",
        "layer-assignment",
        "graph layering",
        "crossing minimization",
        "crossing minimisation",
        "crossing reduction",
        "crossing number",
        "force-directed",
        "force directed",
        "spring embedder",
        "spring-embedder",
        "stress majorization",
        "stress majorisation",
        "stress model",
        "kamada-kawai",
        "kamada kawai",
        "fruchterman",
        "orthogonal drawing",
        "orthogonal layout",
        "orthogonal graph",
        "edge routing",
        "connector routing",
        "edge bundling",
        "bend minimization",
        "bend minimisation",
        "coordinate assignment",
        "brandes köpf",
        "brandes-köpf",
        "brandes and köpf",
        "planar embedding",
        "planar drawing",
        "upward drawing",
        "upward planar",
        "level planar",
        "treemap",
        "tree drawing",
        "tidy tree",
        "tidier drawing",
        "metro map",
        "metro-map",
        "graphviz",
        "neato",
        "sfdp",
        "twopi",
        "dynagraph",
        "mermaid",
        "dagre",
        "cytoscape",
        "gephi",
        "eclipse layout kernel",
        "kieler",
        "elkjs",
        "network simplex",
        "symbolic layout",
        "layout compaction",
        "one-dimensional compaction",
        "two-dimensional compaction",
        "floorplan",
        "floorplanning",
        "sequence-pair",
        "sequence pair",
        "b*-tree",
        "slicing tree",
        "overlap removal",
        "node overlap",
        "mental map",
        "separation constraint",
        "vpsc",
        "ipsep-cola",
        "dig-cola",
        "topology-shape-metrics",
        "topology shape metrics",
        "coffman-graham",
        "coffman graham",
        "sankey",
        "circular layout",
        "radial layout",
        "hierarchical layout",
        "hierarchical drawing",
        "compound graph",
        "compound digraph",
        "clustered graph",
        "dag layout",
        "drawing directed graphs",
        "drawing of graphs",
        "drawing graphs",
    }
)

# Generic terms. Only count toward relevance when a drawing-context term is also
# present (see DRAWING_CONTEXT_TERMS), so e.g. "neural network" alone scores 0.
WEAK_LAYOUT_TERMS = frozenset(
    {
        "graph",
        "digraph",
        "network",
        "tree",
        "node",
        "vertex",
        "vertices",
        "edge",
        "diagram",
        "directed",
        "undirected",
        "cluster",
        "clustering",
        "hierarchical",
        "hierarchy",
        "topology",
        "layout",
        "drawing",
        "drawn",
        "layer",
        "layered",
        "planar",
        "embedding",
        "coordinates",
        "rank",
        "routing",
        "compaction",
        "packing",
        "overlap",
        "compound",
        "nested",
        "hypergraph",
        "dag",
    }
)

# A weak hit only counts when one of these visualization-context words appears.
DRAWING_CONTEXT_TERMS = frozenset(
    {
        "draw",
        "drawing",
        "drawn",
        "layout",
        "visual",
        "visualization",
        "visualisation",
        "diagram",
        "node-link",
        "aesthetic",
        "readability",
        "placement",
        "render",
        "graph drawing",
    }
)

OFF_TOPIC_KEYWORDS = frozenset(
    {
        # biomedical / life sciences
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
        "proteomics",
        "chromosome",
        "hi-c",
        "sequencing",
        "phylogen",
        "ecology",
        "agriculture",
        "crop",
        "livestock",
        "boreal",
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
        "pharmacokinetic",
        "drug discovery",
        "drug-likeness",
        "medicinal",
        "medicinal chemistry",
        "microarray",
        "metabol",
        "dendritic",
        "dendrite",
        "synaptic",
        "spiking",
        "spiking neuron",
        # physics / materials / energy
        "quantum",
        "holographic",
        "metamaterial",
        "turbine",
        "wind energy",
        "floating wind",
        "parametron",
        "adiabatic",
        "photovoltaic",
        "plasma",
        "astrophys",
        "cosmolog",
        "seismic",
        "geophysic",
        # other off-topic CS / misc
        "machine learning algorithms real-world",
        "statistical computing",
        "bibliometric mapping",
        "vosviewer",
        "autoregressive time series",
        "variance-based structural",
        "vehicular network",
        "controller area network",
    }
)


def _haystack(title: str, abstract: str | None) -> str:
    return f"{title} {abstract or ''}".lower()


def _has_strong(hay: str) -> bool:
    return any(term in hay for term in STRONG_LAYOUT_TERMS)


def layout_relevance_score(title: str, abstract: str | None = None) -> int:
    """Score how graph-layout related a title/abstract is.

    +3 per strong term, +1 per weak term *only if* a drawing-context term is
    present, and a hard -100 if any off-topic keyword appears.
    """
    hay = _haystack(title, abstract)
    if any(k in hay for k in OFF_TOPIC_KEYWORDS):
        return -100
    score = 3 * sum(1 for term in STRONG_LAYOUT_TERMS if term in hay)
    if any(ctx in hay for ctx in DRAWING_CONTEXT_TERMS):
        score += sum(1 for term in WEAK_LAYOUT_TERMS if term in hay)
    return score


def is_pipeline_relevant(title: str, abstract: str | None = None) -> bool:
    """True when title/abstract matches a pipeline-layout category keyword."""
    # Lazy import to avoid a circular import (catalog -> classify -> relevance).
    from graph_layout_rag.catalog.taxonomy import categories_from_keywords

    return bool(categories_from_keywords(_haystack(title, abstract)))


def is_layout_relevant(
    title: str,
    abstract: str | None = None,
    *,
    strict: bool = False,
) -> bool:
    """Return True if title/abstract looks graph-layout related.

    - normal: score >= 3 (≈ at least one strong term, or several weak-in-context)
    - strict: at least one strong term present (and not off-topic).
    """
    hay = _haystack(title, abstract)
    score = layout_relevance_score(title, abstract)
    if strict:
        return score >= 3 and _has_strong(hay)
    return score >= 3
