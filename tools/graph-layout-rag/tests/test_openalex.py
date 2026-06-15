from graph_layout_rag.harvest.openalex import _search_openalex, _topic_supported, _work_to_item
from graph_layout_rag.harvest.providers import OutcomeKind, RequestOutcome


def test_search_openalex_paginates_with_cursor():
    page1 = {
        "results": [{"id": "W1", "display_name": "Layered graph drawing layout"}],
        "meta": {"next_cursor": "cursor-2"},
    }
    page2 = {
        "results": [{"id": "W2", "display_name": "Sugiyama crossing minimization layered"}],
        "meta": {"next_cursor": None},
    }

    calls = []
    def fake_request(method, url, **kwargs):
        calls.append(kwargs)
        payload = page1 if len(calls) == 1 else page2
        return RequestOutcome(OutcomeKind.SUCCESS, data=payload, status_code=200)

    from graph_layout_rag.harvest import openalex
    original = openalex.OPENALEX.request_openalex
    openalex.OPENALEX.request_openalex = fake_request
    try:
        results = _search_openalex("layered graph", per_page=1, max_results=3, oa_only=True)
    finally:
        openalex.OPENALEX.request_openalex = original

    assert len(results) == 2
    assert len(calls) == 2
    second_params = calls[1]["params"]
    assert second_params["cursor"] == "cursor-2"


def test_topic_not_stamped_on_unrelated_work():
    # A work found by the "dagre" query but unrelated to layered graph drawing
    # must NOT inherit the "dagre" tag.
    work = {
        "id": "https://openalex.org/W42",
        "display_name": "Gradient-based learning applied to document recognition",
    }
    item = _work_to_item(work, topic="dagre")
    assert "dagre" not in item.tags
    assert "layer-assignment" not in item.tags
    assert set(item.tags) >= {"openalex", "graph-drawing"}


def test_topic_kept_when_work_supports_it():
    work = {
        "id": "https://openalex.org/W7",
        "display_name": "A dagre-style layered graph drawing with layer assignment",
    }
    item = _work_to_item(work, topic="dagre")
    assert "dagre" in item.tags
    assert "layer-assignment" in item.tags


def test_topic_supported_literal_and_category():
    assert _topic_supported("sankey", "A Sankey diagram flow layout", None)
    assert not _topic_supported("sankey", "A study of protein folding kinetics", None)
    # category-mapped topic supported via genuine keyword match
    assert _topic_supported("crossing", "Two-layer crossing minimization", None)
