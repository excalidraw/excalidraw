"""Deferred retry pass for transient rate-limit failures."""

from __future__ import annotations

import hashlib
import time

from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.ledger import (
    set_harvest_stage,
    transient_doc_urls,
    update_document,
)
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import Manifest, relative_local_path, upsert_item
from graph_layout_rag.paths import PDF_DIR


def _retry_transient(entry: tuple[str, str, str | None], *, dry_run: bool) -> tuple[str, bool]:
    doc_id, url, _doi = entry
    if dry_run:
        return doc_id, False

    dest = PDF_DIR / f"{doc_id}.pdf"
    insecure = any(h in url for h in ("infotech.monash.edu", "it.monash.edu", "marvl."))
    dl = download_to_file(
        dest,
        url,
        verify=not insecure,
        doc_id=doc_id,
        doi=_doi,
        stage="deferred-retry",
    )
    if dl.get("ok"):
        update_document(doc_id, final_status="ok", winning_url=url, last_outcome="ok")
        return doc_id, True
    dest.unlink(missing_ok=True)
    return doc_id, False


def run_deferred_retries(
    manifest: Manifest,
    *,
    dry_run: bool = False,
    workers: int | None = None,
    delay_s: float = 30.0,
) -> int:
    """Retry URLs that failed with transient errors. Returns count upgraded to ok."""
    log = get_logger()
    set_harvest_stage("deferred-retry")
    entries = transient_doc_urls()
    if not entries:
        return 0

    log.info("deferred retry: %d transient URL(s) after %ss cooldown", len(entries), delay_s)
    time.sleep(delay_s)

    by_id = {i.id: i for i in manifest.items}
    before = sum(1 for i in manifest.items if i.status == "ok")
    results = parallel_map(
        lambda e: _retry_transient(e, dry_run=dry_run),
        entries,
        workers=workers,
        label="deferred-retry",
    )

    upgraded = 0
    for doc_id, ok in results:
        if not ok:
            continue
        item = by_id.get(doc_id)
        if not item:
            continue
        dest = PDF_DIR / f"{doc_id}.pdf"
        if not dest.exists():
            continue
        item.status = "ok"
        item.localPath = relative_local_path(dest)
        item.sha256 = hashlib.sha256(dest.read_bytes()).hexdigest()
        item.contentType = "application/pdf"
        upsert_item(manifest, item)
        upgraded += 1

    after = sum(1 for i in manifest.items if i.status == "ok")
    log.info("deferred retry upgraded %d items (+%d)", upgraded, after - before)
    return after - before
