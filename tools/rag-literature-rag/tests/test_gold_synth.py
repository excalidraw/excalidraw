"""Unit tests for the synthetic-gold filter logic (the bias guards).

Covers the deterministic, no-LLM core: category mapping, anti-leakage rejection,
near-duplicate rejection (within-set and vs curated), and the cases.json round-trip.
"""
from __future__ import annotations

from rag_literature_rag.eval.gold_cases import GOLD_CASES
from rag_literature_rag.eval.gold_synth import (
    Seed,
    category_for,
    load_synth_cases,
    quality_filters,
    write_cases,
)
from rag_literature_rag.manifest import ManifestItem


def _seed(doc_id: str, title: str, abstract: str) -> Seed:
    return Seed(
        doc_id=doc_id,
        title=title,
        abstract=abstract,
        chunk_text="",
        category="dense-retrieval",
        year_bucket=">=2024",
        track="catalog",
    )


def test_category_for_maps_tags_to_curated_vocab():
    item = ManifestItem(
        id="x", title="A ColBERT late interaction study", source="s", url="u",
        status="metadata_only", tags=["reranking"],
    )
    assert category_for(item) in {"reranking", "dense-retrieval"}


def test_leakage_query_is_rejected():
    seed = _seed("d1", "Dense Passage Retrieval for Open Domain QA", "bi-encoder dense passage retrieval")
    # Query echoes the seed wording → high Jaccard → leakage drop.
    leaky = {0: "Dense passage retrieval for open domain question answering bi-encoder"}
    kept, stats = quality_filters([seed], ["single"], leaky)
    assert kept == []
    assert stats.leakage == 1


def test_independent_phrasing_survives():
    seed = _seed("d1", "Dense Passage Retrieval for Open Domain QA", "bi-encoder dense passage retrieval")
    good = {0: "how to embed questions and documents separately to find answers fast"}
    kept, stats = quality_filters([seed], ["single"], good)
    assert len(kept) == 1
    assert stats.kept == 1


def test_near_duplicate_within_set_is_dropped():
    s1 = _seed("d1", "Paper One", "topic about graph retrieval clustering")
    s2 = _seed("d2", "Paper Two", "different subject entirely about audio")
    q = "techniques for graph based community detection in knowledge retrieval"
    queries = {0: q, 1: q + " methods"}  # second is a near-duplicate
    kept, stats = quality_filters([s1, s2], ["single", "single"], queries)
    assert stats.kept == 1
    assert stats.duplicate == 1


def test_collision_with_curated_query_is_dropped():
    seed = _seed("d1", "Some Paper", "unrelated wording here")
    curated_q = GOLD_CASES[0].query
    kept, stats = quality_filters([seed], ["single"], {0: curated_q})
    # Either flagged as duplicate of curated or as leakage; must not survive.
    assert kept == []


def test_cases_json_roundtrip(tmp_path, monkeypatch):
    from rag_literature_rag.eval import gold_synth

    monkeypatch.setattr(gold_synth, "SYNTH_DIR", tmp_path)
    monkeypatch.setattr(gold_synth, "CASES_PATH", tmp_path / "cases.json")
    from rag_literature_rag.eval.gold_cases import EvalCase

    cases = [
        EvalCase(
            id="synth-catalog-single-0001",
            query="example synthetic query about retrieval evaluation",
            relevant_doc_ids=frozenset({"arxiv-2005-11401"}),
            category="evaluation",
            notes="synthetic;mode=single;seed=arxiv-2005-11401",
        )
    ]
    write_cases(cases, {"version": "synth-v1", "total_cases": 1})
    loaded = load_synth_cases()
    assert len(loaded) == 1
    assert loaded[0].id == "synth-catalog-single-0001"
    assert loaded[0].relevant_doc_ids == frozenset({"arxiv-2005-11401"})
