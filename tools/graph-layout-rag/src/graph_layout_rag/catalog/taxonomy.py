"""Pipeline-layout taxonomy for PDF catalog classification."""

from __future__ import annotations

PIPELINE_CATEGORIES: tuple[str, ...] = (
    "layer-assignment",
    "crossing",
    "compound",
    "constraints",
    "coordinate-assignment",
    "routing",
    "compaction",
    "packing",
    "overlap",
)

UNCATEGORIZED = "uncategorized"

# Manifest harvest tags → pipeline categories (many-to-many).
TAG_TO_CATEGORIES: dict[str, list[str]] = {
    # layer-assignment
    "layer-assignment": ["layer-assignment"],
    "layered": ["layer-assignment"],
    "sugiyama": ["layer-assignment"],
    "hierarchical": ["layer-assignment"],
    "dagre": ["layer-assignment"],
    "minimum-width": ["layer-assignment"],
    "coffman-graham": ["layer-assignment"],
    "wrapping": ["layer-assignment"],
    "rank": ["layer-assignment"],
    "dot": ["layer-assignment"],
    "elk-kieler": ["layer-assignment"],
    "elk": ["layer-assignment"],
    # crossing
    "crossing": ["crossing"],
    "sifting": ["crossing"],
    # compound
    "compound": ["compound"],
    "grouped": ["compound"],
    "clustering": ["compound"],
    "nested": ["compound"],
    # constraints
    "constraints": ["constraints"],
    "elastic": ["constraints"],
    "vpsc": ["constraints"],
    "ports": ["constraints", "routing"],
    # coordinate-assignment
    "coordinate-assignment": ["coordinate-assignment"],
    # routing
    "routing": ["routing"],
    "channel-routing": ["routing"],
    # compaction
    "compaction": ["compaction"],
    "compact": ["compaction"],
    "scanline": ["compaction"],
    # packing
    "packing": ["packing"],
    "left-edge": ["packing"],
    "strip-packing": ["packing"],
    "floorplanning": ["packing"],
    "sequence-pair": ["packing"],
    "b-star-tree": ["packing"],
    # overlap
    "overlap": ["overlap"],
    "mental-map": ["overlap"],
    "clutter": ["overlap"],
}

# Title/abstract phrase lists per pipeline category (keyword fallback).
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "layer-assignment": [
        "layer assignment",
        "graph layering",
        "layered drawing",
        "layered graph",
        "minimum width layering",
        "minimum-width layering",
        "node promotion",
        "rank assignment",
        "network simplex",
        "coffman graham",
        "coffman-graham",
        "as-late-as-possible",
        "alap scheduling",
        "layer reassignment",
        "sugiyama",
        "hierarchical layout",
        "hierarchical drawing",
        "global ranking",
        "dummy node",
        "dag layout",
    ],
    "crossing": [
        "crossing minimization",
        "crossing reduction",
        "edge crossing",
        "two-layer crossing",
        "k-layer crossing",
        "sifting",
        "straightline crossing",
        "crossing number",
    ],
    "compound": [
        "compound graph",
        "compound digraph",
        "compound directed",
        "nested graph",
        "cluster border",
        "clustered graph",
        "grouped network",
        "hierarchical cluster",
    ],
    "constraints": [
        "separation constraint",
        "vpsc",
        "variable placement",
        "ipsep-cola",
        "dig-cola",
        "constrained layout",
        "port constraint",
        "containment constraint",
        "quadratic program",
    ],
    "coordinate-assignment": [
        "coordinate assignment",
        "horizontal coordinate",
        "vertical coordinate",
        "brandes köpf",
        "brandes-köpf",
        "brandes and köpf",
        "x coordinate assignment",
        "node positioning within layer",
    ],
    "routing": [
        "edge routing",
        "orthogonal routing",
        "connector routing",
        "port routing",
        "orthogonal connector",
        "wire routing",
        "channel assignment",
        "track assignment",
    ],
    "compaction": [
        "compaction",
        "one-dimensional compaction",
        "two-dimensional compaction",
        "symbolic layout compaction",
        "constraint graph compaction",
        "scanline compaction",
        "shadow propagation",
    ],
    "packing": [
        "strip packing",
        "skyline heuristic",
        "rectangular packing",
        "left edge algorithm",
        "left-edge algorithm",
        "bottom-left",
        "sequence-pair",
        "b*-tree",
        "b-star tree",
        "floorplan packing",
    ],
    "overlap": [
        "overlap removal",
        "node overlap",
        "mental map",
        "layout adjustment",
        "cluster busting",
        "clutter reduction",
    ],
}


def categories_from_tags(tags: list[str]) -> set[str]:
    out: set[str] = set()
    for tag in tags:
        out.update(TAG_TO_CATEGORIES.get(tag, []))
    return out


def categories_from_keywords(text: str) -> set[str]:
    hay = text.lower()
    out: set[str] = set()
    for category, phrases in CATEGORY_KEYWORDS.items():
        if any(phrase in hay for phrase in phrases):
            out.add(category)
    return out
