"""CitationGraphStrategy must degrade gracefully and not corrupt result rows."""

from graph_layout_rag.eval.gold_cases import EvalCase
from graph_layout_rag.eval.strategies import CitationGraphStrategy, strategy_registry


def test_strategy_registered():
    reg = strategy_registry()
    assert "hybrid_citation" in reg
    assert isinstance(reg["hybrid_citation"], CitationGraphStrategy)


def test_degrades_to_hybrid_without_store(monkeypatch):
    """With no citation graph loaded, the strategy returns the plain hybrid results."""
    sentinel = [
        {"doc_id": "a", "id": "a:0", "score": 0.9, "title": "A", "text": "x"},
        {"doc_id": "b", "id": "b:0", "score": 0.8, "title": "B", "text": "y"},
    ]
    monkeypatch.setattr(
        "graph_layout_rag.query.retrieve.retrieve_candidates",
        lambda *a, **k: [dict(r) for r in sentinel],
    )
    monkeypatch.setattr(
        "graph_layout_rag.query.citation_rank.load_graph_cached", lambda: None
    )
    case = EvalCase(id="t", query="q", relevant_doc_ids=frozenset({"a"}),
                    category=None, pdf_only=False)
    out = CitationGraphStrategy().run(case, embed_profile="p", top=5)
    assert [r["doc_id"] for r in out] == ["a", "b"]
