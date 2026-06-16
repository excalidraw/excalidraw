import json

import pytest

from rag_literature_rag.harvest import prune as prune_mod
from rag_literature_rag.manifest import Manifest, ManifestItem


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
            _item(
                "a",
                "Self-RAG reflection tokens for retrieval augmented generation",
                local="data/raw/pdf/a.pdf",
            ),
            _item("b", "Coarse root architecture of boreal tree species", local="data/raw/pdf/b.pdf"),
            _item(
                "c",
                "Gradient-based learning applied to document recognition",
                tags=["openalex", "graphrag", "agentic"],
                local="data/raw/pdf/c.pdf",
            ),
            _item(
                "d",
                "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                source="topic-seed",
                tags=["foundations", "topic-seed"],
                local="data/raw/pdf/d.pdf",
            ),
        ],
    )


def test_plan_keeps_curated_and_drops_offtopic():
    plan = prune_mod.plan_prune(_manifest())
    keep_ids = {i.id for i in plan.keep}
    prune_ids = {i.id for i in plan.prune}
    assert keep_ids == {"a", "d"}
    assert prune_ids == {"b", "c"}


def test_implementer_sources_are_kept():
    items = [
        _item("hs", "Haystack RAG pipeline", source="implementer-guide", tags=["engineering"]),
        _item("lc", "LangChain RAG tutorial", source="implementer-guide", tags=["engineering"]),
    ]
    plan = prune_mod.plan_prune(prune_mod.Manifest(updatedAt="t", items=items))
    assert {i.id for i in plan.keep} == {"hs", "lc"}


def test_clean_tags_strips_leaked_topic_tag():
    leaked = _item(
        "c",
        "Gradient-based learning applied to document recognition",
        tags=["openalex", "graphrag", "agentic"],
    )
    cleaned = prune_mod.clean_tags(leaked)
    assert "graphrag" not in cleaned
    assert "agentic" not in cleaned
    assert "openalex" in cleaned


def test_clean_tags_preserves_curated():
    seed = _item(
        "d",
        "Self-RAG paper",
        source="topic-seed",
        tags=["self-correcting", "topic-seed"],
    )
    assert prune_mod.clean_tags(seed) == ["self-correcting", "topic-seed"]


def test_apply_prune_deletes_pdfs_and_backs_up(tmp_path, monkeypatch):
    pdf_dir = tmp_path / "data" / "raw" / "pdf"
    pdf_dir.mkdir(parents=True)
    manifest_path = tmp_path / "data" / "manifest.json"
    for name in ("a", "b", "c", "d"):
        (pdf_dir / f"{name}.pdf").write_bytes(b"%PDF-1.4 test")
    manifest_path.write_text(json.dumps({"version": 1, "updatedAt": "x", "items": []}))

    monkeypatch.setattr(prune_mod, "PKG_ROOT", tmp_path)
    monkeypatch.setattr(prune_mod, "MANIFEST_PATH", manifest_path)
    import rag_literature_rag.manifest as man_mod

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
