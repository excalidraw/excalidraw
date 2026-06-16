from rag_literature_rag.harvest.openalex import (
    TOPIC_QUERIES,
    _search_openalex,
    _topic_supported,
    _work_to_item,
)
from rag_literature_rag.harvest.providers import OutcomeKind, RequestOutcome


def test_search_openalex_paginates_with_cursor():
    page1 = {
        "results": [{"id": "W1", "display_name": "Dense passage retrieval for open domain QA"}],
        "meta": {"next_cursor": "cursor-2"},
    }
    page2 = {
        "results": [{"id": "W2", "display_name": "Retrieval augmented generation survey"}],
        "meta": {"next_cursor": None},
    }

    calls = []

    def fake_request(method, url, **kwargs):
        calls.append(kwargs)
        payload = page1 if len(calls) == 1 else page2
        return RequestOutcome(OutcomeKind.SUCCESS, data=payload, status_code=200)

    from rag_literature_rag.harvest import openalex

    original = openalex.OPENALEX.request_openalex
    openalex.OPENALEX.request_openalex = fake_request
    try:
        results = _search_openalex("dense passage retrieval", per_page=1, max_results=3, oa_only=True)
    finally:
        openalex.OPENALEX.request_openalex = original

    assert len(results) == 2
    assert len(calls) == 2
    second_params = calls[1]["params"]
    assert second_params["cursor"] == "cursor-2"


def test_topic_not_stamped_on_unrelated_work():
    work = {
        "id": "https://openalex.org/W42",
        "display_name": "Gradient-based learning applied to document recognition",
    }
    item = _work_to_item(work, topic="graphrag")
    assert "graphrag" not in item.tags
    assert set(item.tags) >= {"openalex"}


def test_topic_kept_when_work_supports_it():
    work = {
        "id": "https://openalex.org/W7",
        "display_name": "GraphRAG community detection hierarchical summary",
    }
    item = _work_to_item(work, topic="graphrag")
    assert "graphrag" in item.tags


def test_topic_supported_for_rag_keywords():
    assert _topic_supported("agentic", "Agentic retrieval augmented generation loop", None)
    assert not _topic_supported("agentic", "A study of protein folding kinetics", None)
    assert _topic_supported("hybrid-retrieval", "Hybrid dense sparse retrieval reciprocal rank fusion", None)


def test_topic_query_keys_match_taxonomy():
    from rag_literature_rag.catalog.taxonomy import RAG_CATEGORIES

    for key in TOPIC_QUERIES:
        assert key in RAG_CATEGORIES, key
