"""Toy-graph tests for the relatedness math (no network, no DB)."""

from collections import defaultdict

from graph_layout_rag.query.citation_rank import (
    CitationGraph,
    bibliographic_coupling,
    co_citation,
    personalized_pagerank,
    rank_related,
    related_to_docs,
)
from graph_layout_rag.query.identity import CanonicalIdentityMap


def _toy() -> CitationGraph:
    # Corpus A,B,C cite external refs R1,R2; external X cites A and B.
    #   A -> R1, R2 ; B -> R1 ; C -> R2 ; X -> A, B
    g = CitationGraph()
    edges = [("Wa", "R1"), ("Wa", "R2"), ("Wb", "R1"), ("Wc", "R2"), ("Wx", "Wa"), ("Wx", "Wb")]
    for s, d in edges:
        g.out_adj[s].add(d)
        g.in_adj[d].add(s)
        g.undirected[s].add(d)
        g.undirected[d].add(s)
    g.cbc = {"Wa": 100, "Wb": 10, "Wc": 5, "Wx": 1, "R1": 50, "R2": 40}
    g.oa_to_doc = {"Wa": "doc-a", "Wb": "doc-b", "Wc": "doc-c"}
    g.doc_to_oa = {v: k for k, v in g.oa_to_doc.items()}
    return g


def test_bibliographic_coupling():
    g = _toy()
    seed_refs = g.out_adj["Wa"]  # {R1, R2}
    assert bibliographic_coupling(g, seed_refs, "Wb") > 0  # shares R1
    assert bibliographic_coupling(g, seed_refs, "Wc") > 0  # shares R2
    assert bibliographic_coupling(g, seed_refs, "Wx") == 0  # shares none


def test_co_citation():
    g = _toy()
    seed_citers = g.in_adj["Wa"]  # {Wx}
    assert co_citation(g, seed_citers, "Wb") > 0  # both cited by Wx
    assert co_citation(g, seed_citers, "Wc") == 0


def test_ppr_seed_is_top_and_spreads():
    g = _toy()
    ppr = personalized_pagerank(g, {"Wa"}, iters=100)
    assert ppr  # non-empty
    assert max(ppr, key=ppr.get) == "Wa"  # restart node dominates
    assert ppr.get("Wb", 0) > 0  # reachable via R1 and via Wx
    assert ppr.get("Wc", 0) > 0  # reachable via R2
    # mass is a proper distribution-ish (bounded, positive)
    assert all(v >= 0 for v in ppr.values())


def test_ppr_empty_for_unknown_seed():
    g = _toy()
    assert personalized_pagerank(g, {"W-missing"}) == {}


def test_rank_related_returns_corpus_neighbors():
    g = _toy()
    ranked = rank_related(g, {"Wa"}, {"Wb", "Wc", "Wx"})
    docs = [r.doc_id for r in ranked]
    assert "doc-b" in docs and "doc-c" in docs  # both related to A
    # Wb shares a reference AND a co-citation with Wa; Wc only a reference -> Wb ranks first.
    assert docs[0] == "doc-b"
    top = ranked[0]
    assert top.shared_refs >= 1 and top.shared_citations >= 1


def test_related_to_docs_resolves_seed_alias_and_deduplicates_results(monkeypatch):
    g = _toy()
    g.oa_to_doc["Wb2"] = "doc-b-alias"
    g.doc_to_oa["doc-b-alias"] = "Wb2"
    g.add_edge("Wb2", "R1")
    identities = CanonicalIdentityMap(
        canonical_by_doc={
            "doc-a": "doc-a",
            "doc-a-alias": "doc-a",
            "doc-b": "doc-b",
            "doc-b-alias": "doc-b",
            "doc-c": "doc-c",
        },
        aliases_by_canonical={
            "doc-a": ("doc-a-alias",),
            "doc-b": ("doc-b-alias",),
            "doc-c": (),
        },
    )
    monkeypatch.setattr(
        "graph_layout_rag.query.identity.canonical_identity_map",
        lambda: identities,
    )

    ranked = related_to_docs(None, ["doc-a-alias"], graph=g, top=10)
    assert ranked
    assert [result.doc_id for result in ranked].count("doc-b") == 1
