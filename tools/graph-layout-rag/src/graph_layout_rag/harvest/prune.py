"""Precision-first corpus prune.

Drops manifest items (and deletes their PDFs) that fail the strict
layout-relevance gate, while always keeping hand-curated high-signal sources
(see ``CURATED_SOURCES``). Survivors from discovered sources are re-tagged from
their own title/abstract so leaked OpenAlex topic tags are removed.

Destructive: ``apply_prune`` deletes files. Callers must gate it behind an
explicit confirmation; ``plan_prune`` is read-only.
"""

from __future__ import annotations

import shutil
from collections import Counter
from dataclasses import dataclass, field

from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.relevance import CURATED_SOURCES, is_layout_relevant
from graph_layout_rag.manifest import Manifest, ManifestItem, save_manifest
from graph_layout_rag.paths import MANIFEST_PATH, PKG_ROOT

# Provenance/origin tags that are NOT pipeline categories — kept verbatim when
# re-tagging discovered survivors. Everything else on a discovered item is
# recomputed from its text (this strips leaked topic tags like "dagre").
PROVENANCE_TAGS = frozenset(
    {
        "openalex",
        "arxiv",
        "dblp",
        "semantic-scholar",
        "bibliography",
        "graph-drawing",
        "research-thread",
    }
)


@dataclass
class PrunePlan:
    keep: list[ManifestItem] = field(default_factory=list)
    prune: list[ManifestItem] = field(default_factory=list)

    @property
    def n_keep(self) -> int:
        return len(self.keep)

    @property
    def n_prune(self) -> int:
        return len(self.prune)


def _is_kept(item: ManifestItem) -> bool:
    if item.source in CURATED_SOURCES:
        return True
    return is_layout_relevant(item.title, item.abstract, strict=True)


def plan_prune(manifest: Manifest) -> PrunePlan:
    """Partition manifest items into keep/prune (read-only)."""
    plan = PrunePlan()
    for item in manifest.items:
        (plan.keep if _is_kept(item) else plan.prune).append(item)
    return plan


def clean_tags(item: ManifestItem) -> list[str]:
    """Recompute tags for a survivor, removing leaked topic tags.

    Curated/seed items keep their hand-assigned tags; discovered items keep only
    provenance tags plus categories genuinely matched by their own text.
    """
    if item.source in CURATED_SOURCES:
        return item.tags
    # Lazy import: catalog -> classify -> relevance cycle.
    from graph_layout_rag.catalog.taxonomy import categories_from_keywords

    provenance = {t for t in item.tags if t in PROVENANCE_TAGS}
    cats = categories_from_keywords(f"{item.title} {item.abstract or ''}")
    return sorted(provenance | cats)


def apply_prune(manifest: Manifest, plan: PrunePlan, *, backup: bool = True) -> dict[str, int]:
    """Delete pruned PDFs, retag survivors, and save the manifest.

    DESTRUCTIVE. Backs up the manifest to ``manifest.bak.json`` first.
    """
    log = get_logger()
    if backup and MANIFEST_PATH.exists():
        backup_path = MANIFEST_PATH.with_name("manifest.bak.json")
        shutil.copy2(MANIFEST_PATH, backup_path)
        log.info("prune: backed up manifest -> %s", backup_path)

    deleted_pdfs = 0
    for item in plan.prune:
        if item.localPath:
            path = PKG_ROOT / item.localPath
            if path.exists():
                path.unlink()
                deleted_pdfs += 1

    for item in plan.keep:
        item.tags = clean_tags(item)

    manifest.items = plan.keep
    save_manifest(manifest)
    log.info(
        "prune: removed %d items (%d PDFs deleted), kept %d",
        plan.n_prune,
        deleted_pdfs,
        plan.n_keep,
    )
    return {"removed_items": plan.n_prune, "deleted_pdfs": deleted_pdfs, "kept": plan.n_keep}


def signal_stats(items: list[ManifestItem]) -> dict[str, object]:
    """Summary: counts, OK PDFs, strong-signal ratio, per-source."""
    ok = [i for i in items if i.status == "ok"]
    strong = sum(
        1 for i in ok if is_layout_relevant(i.title, i.abstract, strict=True) or i.source in CURATED_SOURCES
    )
    by_source: Counter[str] = Counter(i.source for i in items)
    return {
        "total": len(items),
        "ok": len(ok),
        "strong_ratio": (strong / len(ok)) if ok else 0.0,
        "by_source": dict(by_source.most_common()),
    }
