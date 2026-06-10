from graph_layout_rag.harvest.relevance import is_layout_relevant


def test_sugiyama_title_accepted():
    assert is_layout_relevant(
        "Methods for visual understanding of hierarchical system structures (Sugiyama)"
    )


def test_genomics_title_rejected():
    assert not is_layout_relevant(
        "Microbiome analysis of gut bacteria in cancer patients",
        "We sequenced the microbiome and genome of clinical cohorts.",
    )


def test_layout_keyword_required():
    assert not is_layout_relevant("Additive logistic regression: a statistical view")
