from rag_literature_rag.harvest.relevance import (
    is_layout_relevant,
    is_off_topic,
    is_pipeline_relevant,
    layout_relevance_score,
)


def test_rag_paper_passes_strict():
    assert is_layout_relevant(
        "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection",
        "Retrieval-augmented generation with reflection tokens.",
        strict=True,
    )


def test_graph_drawing_rejected():
    assert not is_layout_relevant(
        "A Technique for Drawing Directed Graphs",
        "Layered graph drawing and Sugiyama method.",
        strict=True,
    )


def test_pipeline_category_from_keywords():
    assert is_pipeline_relevant(
        "GraphRAG: community summaries over knowledge graphs for RAG",
        None,
    )


def test_off_topic_medical():
    assert is_off_topic("Clinical trial of oncology drug", "Patient cohort study")


def test_dpr_scores_high():
    score = layout_relevance_score(
        "Dense Passage Retrieval for Open-Domain Question Answering",
        "We introduce dense passage retrieval for open-domain QA.",
    )
    assert score >= 3
