from unittest.mock import MagicMock, patch

from graph_layout_rag.harvest.openalex import _search_openalex


def test_search_openalex_paginates_with_cursor():
    page1 = {
        "results": [{"id": "W1", "display_name": "Layered graph drawing layout"}],
        "meta": {"next_cursor": "cursor-2"},
    }
    page2 = {
        "results": [{"id": "W2", "display_name": "Sugiyama crossing minimization layered"}],
        "meta": {"next_cursor": None},
    }

    with patch("graph_layout_rag.harvest.openalex.httpx.Client") as client_cls:
        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        client.get.side_effect = [
            MagicMock(status_code=200, json=MagicMock(return_value=page1)),
            MagicMock(status_code=200, json=MagicMock(return_value=page2)),
        ]
        client_cls.return_value = client

        results = _search_openalex("layered graph", per_page=1, max_results=3, oa_only=True)

    assert len(results) == 2
    assert client.get.call_count == 2
    second_params = client.get.call_args_list[1].kwargs["params"]
    assert second_params["cursor"] == "cursor-2"
