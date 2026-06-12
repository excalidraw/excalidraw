from graph_layout_rag.harvest.relevance import is_layout_relevant, is_pipeline_relevant
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
