import json

import pytest

from graph_layout_rag.harvest import prune as prune_mod
from graph_layout_rag.manifest import Manifest, ManifestItem


def _item(id_, title, source="openalex", status="ok", tags=None, local=None, abstract=None):
    return ManifestItem(
        id=id_,
        title=title,
        authors=[],
        year=2020,
        source=source,
        url=f"https://example.org/{id_}",
        localPath=local,
        status=status,
        tags=tags or [],
        abstract=abstract,
    )


def _manifest():
    return Manifest(
        version=1,
        updatedAt="2026-01-01T00:00:00Z",
        items=[
            # on-topic discovered -> keep
            _item("a", "Sugiyama layered graph drawing with crossing minimization", local="data/raw/pdf/a.pdf"),
            # off-topic discovered -> prune
            _item("b", "Coarse root architecture of boreal tree species", local="data/raw/pdf/b.pdf"),
            # off-topic discovered, leaked tag -> prune
            _item("c", "Gradient-based learning applied to document recognition", tags=["openalex", "dagre", "layer-assignment"], local="data/raw/pdf/c.pdf"),
            # curated weak-title -> keep regardless
            _item("d", "How to draw a compound digraph", source="topic-seed", tags=["sugiyama", "compound"], local="data/raw/pdf/d.pdf"),
        ],
    )


def test_plan_keeps_curated_and_drops_offtopic():
    plan = prune_mod.plan_prune(_manifest())
    keep_ids = {i.id for i in plan.keep}
    prune_ids = {i.id for i in plan.prune}
    assert keep_ids == {"a", "d"}
    assert prune_ids == {"b", "c"}


def test_library_doc_sources_are_kept():
    # ogdf / dagre engine docs are off-topic by strict keyword gate but must
    # survive prune because they are curated implementer-grade sources.
    items = [
        _item("og", "OGDF module overview", source="ogdf", tags=["ogdf"]),
        _item("dg", "dagre layout internals", source="dagre", tags=["dagre"]),
    ]
    plan = prune_mod.plan_prune(prune_mod.Manifest(updatedAt="t", items=items))
    assert {i.id for i in plan.keep} == {"og", "dg"}


def test_clean_tags_strips_leaked_topic_tag():
    leaked = _item("c", "Gradient-based learning applied to document recognition", tags=["openalex", "dagre", "layer-assignment"])
    cleaned = prune_mod.clean_tags(leaked)
    assert "dagre" not in cleaned
    assert "layer-assignment" not in cleaned
    assert "openalex" in cleaned


def test_clean_tags_preserves_curated():
    seed = _item("d", "How to draw a compound digraph", source="topic-seed", tags=["sugiyama", "compound"])
    assert prune_mod.clean_tags(seed) == ["sugiyama", "compound"]


def test_apply_prune_deletes_pdfs_and_backs_up(tmp_path, monkeypatch):
    pdf_dir = tmp_path / "data" / "raw" / "pdf"
    pdf_dir.mkdir(parents=True)
    manifest_path = tmp_path / "data" / "manifest.json"
    for name in ("a", "b", "c", "d"):
        (pdf_dir / f"{name}.pdf").write_bytes(b"%PDF-1.4 test")
    manifest_path.write_text(json.dumps({"version": 1, "updatedAt": "x", "items": []}))

    monkeypatch.setattr(prune_mod, "PKG_ROOT", tmp_path)
    monkeypatch.setattr(prune_mod, "MANIFEST_PATH", manifest_path)
    # save_manifest writes to manifest module's MANIFEST_PATH
    import graph_layout_rag.manifest as man_mod

    monkeypatch.setattr(man_mod, "MANIFEST_PATH", manifest_path)

    manifest = _manifest()
    plan = prune_mod.plan_prune(manifest)
    stats = prune_mod.apply_prune(manifest, plan)

    assert stats["removed_items"] == 2
    assert stats["deleted_pdfs"] == 2
    assert not (pdf_dir / "b.pdf").exists()
    assert not (pdf_dir / "c.pdf").exists()
    assert (pdf_dir / "a.pdf").exists()
    assert (manifest_path.with_name("manifest.bak.json")).exists()
    saved = json.loads(manifest_path.read_text())
    assert {i["id"] for i in saved["items"]} == {"a", "d"}


def test_signal_stats():
    stats = prune_mod.signal_stats(_manifest().items)
    assert stats["total"] == 4
    assert stats["ok"] == 4
    assert 0.0 < stats["strong_ratio"] <= 1.0
