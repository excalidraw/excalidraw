"""Manifest integrity verification — ensure ok items have valid PDFs on disk."""

from __future__ import annotations

from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.relevance import is_layout_relevant
from graph_layout_rag.manifest import Manifest, ManifestItem
from graph_layout_rag.paths import PKG_ROOT

MIN_PDF_BYTES = 10_000


def _pdf_valid(item: ManifestItem) -> tuple[bool, str]:
    if not item.localPath:
        return False, "no localPath"
    path = PKG_ROOT / item.localPath
    if not path.exists():
        return False, "file missing"
    data = path.read_bytes()
    if not data.startswith(b"%PDF"):
        return False, "not a PDF"
    if len(data) < MIN_PDF_BYTES:
        return False, f"too small ({len(data)} bytes)"
    if not is_layout_relevant(item.title, item.abstract):
        return False, "off-topic"
    return True, "ok"


def verify_manifest(manifest: Manifest, *, downgrade: bool = True) -> dict[str, int]:
    """Verify ok items. Optionally downgrade invalid entries to failed."""
    log = get_logger()
    stats = {"checked": 0, "valid": 0, "downgraded": 0, "off_topic": 0}

    for item in manifest.items:
        if item.status != "ok":
            continue
        stats["checked"] += 1
        valid, reason = _pdf_valid(item)
        if valid:
            stats["valid"] += 1
            continue
        log.warning("verify: %s invalid — %s", item.id, reason)
        if reason == "off-topic":
            stats["off_topic"] += 1
        if downgrade:
            item.status = "failed"
            item.localPath = None
            item.sha256 = None
            stats["downgraded"] += 1

    return stats
