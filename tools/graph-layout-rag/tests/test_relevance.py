from graph_layout_rag.harvest.relevance import (
    is_layout_relevant,
    is_off_topic,
    is_pipeline_relevant,
    layout_relevance_score,
)
from graph_layout_rag.harvest.tags_inference import infer_harvest_tags


def test_strict_layout_requires_multiple_keywords():
    assert not is_layout_relevant("R: A Language and Environment for Statistical Computing", strict=True)
    assert is_layout_relevant(
        "Layered graph drawing with crossing minimization",
        strict=True,
    )


def test_pipeline_relevant_packing():
    assert is_pipeline_relevant(
        "Wire routing by optimizing channel assignment",
        "left edge algorithm for track assignment",
    )


def test_infer_harvest_tags_from_title():
    tags = infer_harvest_tags(
        "A skyline heuristic for the 2D rectangular strip packing problem",
        existing=["bibliography"],
    )
    assert "packing" in tags
    assert "bibliography" in tags


# --- canonical works should pass the strict gate ---

CANONICAL_TITLES = [
    "A Technique for Drawing Directed Graphs",
    "Graph Drawing by Force-directed Placement",
    "Fast and Simple Horizontal Coordinate Assignment",
    "Efficient, High-Quality Force-Directed Graph Drawing",
    "Graph Drawing by Stress Majorization",
    "The Eclipse Layout Kernel",
]


def test_canonical_titles_pass_strict():
    for title in CANONICAL_TITLES:
        assert is_layout_relevant(title, strict=True), title


def test_weak_title_passes_strict_with_abstract():
    # Sugiyama 1981: its title alone lacks a drawing-specific term, but the
    # abstract carries the layout context.
    assert is_layout_relevant(
        "Methods for Visual Understanding of Hierarchical System Structures",
        "An automatic method for hierarchical graph drawing of directed graphs "
        "by layered layout, reducing edge crossings.",
        strict=True,
    )


# --- real false positives observed in the OpenAlex long tail must be rejected ---

FALSE_POSITIVES = [
    "Coarse root architecture of three boreal tree species growing in mixed stands",
    "Dynamics Modeling and Loads Analysis of an Offshore Floating Wind Turbine",
    "Holographic quantum error-correcting codes: toy models for the bulk/boundary correspondence",
    "PGC-1a Deficiency Causes Multi-System Energy Metabolic Derangements",
    "Training Spiking Neural Networks Using Lessons From Deep Learning",
    "Uncovering Intrinsic Modular Organization of Spontaneous Brain Activity in Humans",
    "Vehicular Networking: A Survey and Tutorial on Requirements and Architectures",
]


def test_false_positives_rejected_strict():
    for title in FALSE_POSITIVES:
        assert not is_layout_relevant(title, strict=True), title


def test_generic_network_without_drawing_context_scores_low():
    # "neural network" / "deep learning" must not pass on weak terms alone
    assert not is_layout_relevant(
        "Gradient-based learning applied to document recognition", strict=True
    )
    assert layout_relevance_score("A deep neural network for image classification") <= 1


def test_off_topic_keyword_hard_rejects():
    assert layout_relevance_score("Graph drawing of protein interaction genome networks") == -100


# --- regression: off-topic keywords must match at a word boundary, not mid-word ---
# "rna" (RNA) is a substring of external/internal/journal/alternating/tournament;
# a plain substring test hard-killed core planar/upward graph-drawing papers.

OFF_TOPIC_SUBSTRING_FALSE_POSITIVES = [
    ("Orthogonal Drawing of Planar Graphs", "We fix the external face and route edges."),
    ("Upward Planar Drawing", "internal vertices are placed by layer; the external boundary"),
    ("Drawing non-layered tidy trees in linear time", None),
    ("Crossing minimization with an alternating layer sweep", None),
    ("Drawing tournaments and round-robin schedules as layered graphs", None),
]


def test_off_topic_substring_does_not_kill_layout_terms():
    for title, abstract in OFF_TOPIC_SUBSTRING_FALSE_POSITIVES:
        assert not is_off_topic(title, abstract), title
        assert layout_relevance_score(title, abstract) > 0, title


def test_off_topic_word_boundary_still_rejects_real_offtopic():
    # Standalone off-topic words and intended morphological variants still fire.
    for title in [
        "RNA secondary structure prediction",
        "Phylogenetic analysis of microbiome diversity",
        "Genome-wide association study in cancer patients",
    ]:
        assert is_off_topic(title), title
        assert layout_relevance_score(title) == -100, title
