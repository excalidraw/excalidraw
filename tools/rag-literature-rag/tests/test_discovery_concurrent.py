import logging

from rag_literature_rag.harvest import run as run_mod
from rag_literature_rag.manifest import Manifest, ManifestItem


def _item(id_, source="openalex"):
    return ManifestItem(
        id=id_,
        title=id_,
        authors=[],
        year=2020,
        source=source,
        url=f"https://example.org/{id_}",
        status="metadata_only",
        tags=[],
    )


def test_concurrent_discovery_merges_all_sources(monkeypatch):
    manifest = Manifest(version=1, updatedAt="x", items=[])
    saved_stages: list[str] = []

    monkeypatch.setattr(run_mod, "_save_progress", lambda m, stage, log, **k: saved_stages.append(stage))
    monkeypatch.setattr(run_mod, "harvest_openalex", lambda **k: [_item("oa1"), _item("oa2")])
    monkeypatch.setattr(run_mod, "harvest_arxiv", lambda **k: [_item("ax1", "arxiv")])
    monkeypatch.setattr(run_mod, "harvest_arxiv_category", lambda **k: [])
    monkeypatch.setattr(run_mod, "harvest_dblp", lambda **k: [_item("db1", "dblp")])
    monkeypatch.setattr(run_mod, "harvest_trusted_venues", lambda **k: [])
    monkeypatch.setattr(
        run_mod, "harvest_semantic_scholar", lambda **k: [_item("s2a", "semantic-scholar")]
    )

    run_mod._run_discovery_pass(
        manifest,
        logging.getLogger("test"),
        kw={},
        max_openalex=100,
        max_openalex_per_topic=30,
        max_dblp=100,
        max_semantic_scholar=100,
        max_arxiv=100,
        max_crossref=0,
        max_forward_citations=0,
        skip_openalex=False,
        skip_dblp=False,
        skip_semantic_scholar=False,
        skip_arxiv=False,
        skip_crossref=True,
        skip_forward_citations=True,
        target=None,
        dry_run=False,
        pipeline_only=False,
    )

    assert {i.id for i in manifest.items} == {"oa1", "oa2", "ax1", "db1", "s2a"}
    assert set(saved_stages) >= {"openalex", "arxiv", "dblp", "semantic-scholar"}


def test_one_source_failure_does_not_abort_pass(monkeypatch):
    manifest = Manifest(version=1, updatedAt="x", items=[])
    saved_stages: list[str] = []

    def _boom(**k):
        raise RuntimeError("network down")

    monkeypatch.setattr(run_mod, "_save_progress", lambda m, stage, log, **k: saved_stages.append(stage))
    monkeypatch.setattr(run_mod, "harvest_openalex", lambda **k: [_item("oa1")])
    monkeypatch.setattr(run_mod, "harvest_arxiv", _boom)
    monkeypatch.setattr(run_mod, "harvest_arxiv_category", lambda **k: [])
    monkeypatch.setattr(run_mod, "harvest_dblp", lambda **k: [_item("db1", "dblp")])
    monkeypatch.setattr(run_mod, "harvest_trusted_venues", lambda **k: [])
    monkeypatch.setattr(run_mod, "harvest_semantic_scholar", lambda **k: [_item("s2a", "semantic-scholar")])

    run_mod._run_discovery_pass(
        manifest,
        logging.getLogger("test"),
        kw={},
        max_openalex=100,
        max_openalex_per_topic=30,
        max_dblp=100,
        max_semantic_scholar=100,
        max_arxiv=100,
        max_crossref=0,
        max_forward_citations=0,
        skip_openalex=False,
        skip_dblp=False,
        skip_semantic_scholar=False,
        skip_arxiv=False,
        skip_crossref=True,
        skip_forward_citations=True,
        target=None,
        dry_run=False,
        pipeline_only=False,
    )

    # arXiv failed but the rest still merged.
    assert {i.id for i in manifest.items} == {"oa1", "db1", "s2a"}
