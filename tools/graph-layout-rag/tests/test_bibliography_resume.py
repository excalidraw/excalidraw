from unittest.mock import patch

from graph_layout_rag.harvest.bibliography import (
    _positive_env_int,
    filter_relevant_dois_resumable,
    pending_bibliography_resolve_dois,
    select_bibliography_dois,
)
from graph_layout_rag.harvest.checkpoint import discovery_complete
from graph_layout_rag.manifest import Manifest, ManifestItem


def test_discovery_complete_stages():
    assert discovery_complete("semantic-scholar")
    assert discovery_complete("bibliography-relevance")
    assert discovery_complete("bibliography")
    assert not discovery_complete("openalex")
    assert not discovery_complete(None)


def test_relevance_resumes_skips_openalex_for_known_decisions():
    prior = {"10.1145/1234567.1234567": True, "10.1007/off-topic": False}
    with patch("graph_layout_rag.harvest.bibliography._openalex_by_doi") as openalex:
        with patch("graph_layout_rag.harvest.bibliography.parallel_map") as pmap:
            pmap.side_effect = lambda func, items, **kw: [func(d) for d in items]
            decisions = filter_relevant_dois_resumable(
                ["10.1145/1234567.1234567", "10.1007/new-paper"],
                workers=4,
                relevance_decisions=dict(prior),
            )
    openalex.assert_called_once()
    assert openalex.call_args[0][0] == "10.1007/new-paper"
    assert decisions["10.1145/1234567.1234567"] is True
    assert "10.1007/new-paper" in decisions


def test_positive_env_int(monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_TEST_INT", "32")
    assert _positive_env_int("GRAPH_RAG_TEST_INT", 8) == 32
    monkeypatch.setenv("GRAPH_RAG_TEST_INT", "invalid")
    assert _positive_env_int("GRAPH_RAG_TEST_INT", 8) == 8


def test_select_bibliography_dois_caps_relevant():
    decisions = {
        "10.1145/a": True,
        "10.1145/b": True,
        "10.1145/c": False,
    }
    selected = select_bibliography_dois(
        ["10.1145/a", "10.1145/b", "10.1145/c"],
        decisions,
        max_dois=1,
    )
    assert selected == ["10.1145/a"]


def test_pending_bibliography_resolve_skips_manifest_items():
    manifest = Manifest(
        items=[
            ManifestItem(
                id="doi-10-1145-done",
                title="Done",
                source="bibliography",
                url="https://doi.org/10.1145/done",
                status="ok",
                doi="10.1145/done",
            )
        ]
    )
    pending = pending_bibliography_resolve_dois(
        ["10.1145/done", "10.1145/pending"],
        resolved_dois=[],
        manifest=manifest,
    )
    assert pending == ["10.1145/pending"]
