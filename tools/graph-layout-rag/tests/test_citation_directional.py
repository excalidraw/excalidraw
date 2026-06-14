"""Directional PPR (node-split) and leave-one-out edge surgery on a toy graph."""

from graph_layout_rag.query.citation_rank import CitationGraph, personalized_pagerank


def _toy() -> CitationGraph:
    # Wa -> R1, R2 ; Wb -> R1 ; Wc -> R2 ; Wx -> Wa, Wb
    g = CitationGraph()
    for s, d in [("Wa", "R1"), ("Wa", "R2"), ("Wb", "R1"), ("Wc", "R2"), ("Wx", "Wa"), ("Wx", "Wb")]:
        g.add_edge(s, d)
    g.oa_to_doc = {"Wa": "doc-a", "Wb": "doc-b", "Wc": "doc-c"}
    g.doc_to_oa = {v: k for k, v in g.oa_to_doc.items()}
    return g


def test_forward_ppr_follows_references_only():
    g = _toy()
    fwd = personalized_pagerank(g, {"Wa"}, direction="forward")
    # Forward walk from Wa reaches its references, not its citer.
    assert fwd.get("R1", 0) > 0 and fwd.get("R2", 0) > 0
    assert fwd.get("Wx", 0) == 0


def test_backward_ppr_follows_citers_only():
    g = _toy()
    bwd = personalized_pagerank(g, {"Wa"}, direction="backward")
    # Backward walk from Wa reaches its citer, not its references.
    assert bwd.get("Wx", 0) > 0
    assert bwd.get("R1", 0) == 0


def test_undirected_reaches_both_sides():
    g = _toy()
    und = personalized_pagerank(g, {"Wa"}, direction="undirected")
    assert und.get("R1", 0) > 0 and und.get("Wx", 0) > 0
    assert max(und, key=und.get) == "Wa"  # restart node dominates


def test_remove_and_restore_edge():
    g = _toy()
    assert g.has_edge("Wa", "R1")
    assert g.remove_edge("Wa", "R1") is True
    assert not g.has_edge("Wa", "R1")
    assert "R1" not in g.out_adj["Wa"] and "Wa" not in g.in_adj["R1"]
    assert "R1" not in g.undirected["Wa"]  # no reverse edge existed -> undirected cleared
    # Removing a non-edge is a no-op returning False.
    assert g.remove_edge("Wa", "Wc") is False
    g.add_edge("Wa", "R1")
    assert g.has_edge("Wa", "R1") and "R1" in g.undirected["Wa"]
