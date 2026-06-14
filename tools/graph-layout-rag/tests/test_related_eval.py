"""Leave-one-out eval: fold construction, variant scoring, payload assembly (toy graph)."""

from graph_layout_rag.eval import related_eval
from graph_layout_rag.query.citation_rank import CitationGraph


def _toy() -> CitationGraph:
    # Corpus a,b,c. a cites b and c; b cites c. (c has no out-edges.)
    g = CitationGraph()
    for s, d in [("Wa", "Wb"), ("Wa", "Wc"), ("Wb", "Wc")]:
        g.add_edge(s, d)
    g.oa_to_doc = {"Wa": "doc-a", "Wb": "doc-b", "Wc": "doc-c"}
    g.doc_to_oa = {v: k for k, v in g.oa_to_doc.items()}
    return g


def test_build_loo_cases_holds_out_corpus_ref():
    g = _toy()
    folds = related_eval.build_loo_cases(g, max_cases=10)
    seeds = {f.seed_doc for f in folds}
    assert seeds == {"doc-a", "doc-b"}  # doc-c has no out-edges -> not a seed
    for f in folds:
        assert f.held_doc in {"doc-a", "doc-b", "doc-c"} and f.held_doc != f.seed_doc


def test_loo_edge_is_restored_after_scoring():
    g = _toy()
    folds = related_eval.build_loo_cases(g, max_cases=10)
    related_eval.run_variant(g, "coupling_only", folds)
    # Every held-out edge must be put back so later variants see the full graph.
    for f in folds:
        assert g.has_edge(f.seed_oa, f.held_oa)


def test_run_variant_returns_metric_row():
    g = _toy()
    folds = related_eval.build_loo_cases(g, max_cases=10)
    row = related_eval.run_variant(g, "ppr_directional", folds)
    assert row["variant"] == "ppr_directional"
    assert row["cases"] == len(folds)
    for key in ("mrr", "ndcg@10", "recall@10", "latency_ms_p95"):
        assert key in row


def test_run_related_eval_skips_embed_variants_without_vectors(monkeypatch):
    g = _toy()

    class _DummyDB:
        def close(self): pass

    monkeypatch.setattr(related_eval.cs, "connect", lambda: _DummyDB())
    monkeypatch.setattr(related_eval, "load_graph", lambda db: g)
    monkeypatch.setattr(related_eval, "has_doc_vectors", lambda model: False)

    payload = related_eval.run_related_eval(max_cases=10)
    names = {r["variant"] for r in payload["results"]}
    assert "ppr_directional" in names and "coupling_only" in names
    # Embedding-dependent variants are skipped (not errored) when vectors are absent.
    assert {"scincl", "specter2", "related_v2"} <= set(payload["variants_skipped"])
    assert payload["fold_count"] == len(related_eval.build_loo_cases(g, max_cases=10))
