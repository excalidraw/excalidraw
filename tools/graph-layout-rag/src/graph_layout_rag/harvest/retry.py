"""Retry failed or metadata-only items via enhanced DOI resolution."""

from __future__ import annotations

import time

from graph_layout_rag.harvest.doi_resolver import (
    _openalex_by_doi,
    pick_pdf_urls,
    resolve_doi_with_fallbacks,
)
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import Manifest, ManifestItem, relative_local_path, upsert_item
from graph_layout_rag.paths import PDF_DIR


def _retry_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    if item.status == "ok":
        return item

    doi = item.doi
    if not doi and item.url and "doi.org/" in item.url:
        doi = item.url.split("doi.org/", 1)[-1].split("?")[0]

    extra_urls: list[str] = []
    if item.url and ".pdf" in item.url.lower():
        extra_urls.append(item.url)

    if doi:
        resolved = resolve_doi_with_fallbacks(
            doi,
            source=item.source,
            tags=item.tags,
            pdf_urls=extra_urls,
            dry_run=dry_run,
            include_archive=True,
            include_paywall_guesses=True,
        )
        resolved.id = item.id
        if resolved.status == "ok" or (resolved.abstract and not item.abstract):
            if resolved.status != "ok":
                resolved.status = "metadata_only"
            elif resolved.status == "ok":
                get_logger().info("retry ok: %s (%s)", item.id, doi)
            return resolved

    if extra_urls and not dry_run:
        dest = PDF_DIR / f"{item.id}.pdf"
        for url in extra_urls:
            dl = download_to_file(dest, url)
            if dl.get("ok"):
                item.status = "ok"
                item.url = url
                item.sha256 = dl.get("sha256")
                item.localPath = relative_local_path(dest)
                item.contentType = "application/pdf"
                return item
            dest.unlink(missing_ok=True)

    if doi and not dry_run:
        work = _openalex_by_doi(doi)
        dest = PDF_DIR / f"{item.id}.pdf"
        for url in pick_pdf_urls(
            doi, work, extra_urls, include_archive=True, include_paywall_guesses=True
        ):
            insecure = any(h in url for h in ("infotech.monash.edu", "it.monash.edu", "marvl."))
            try:
                dl = download_to_file(dest, url, verify=not insecure)
                if dl.get("ok"):
                    item.status = "ok"
                    item.url = url
                    item.sha256 = dl.get("sha256")
                    item.localPath = relative_local_path(dest)
                    item.contentType = "application/pdf"
                    return item
                dest.unlink(missing_ok=True)
            except Exception:
                dest.unlink(missing_ok=True)

    return item


def retry_unresolved(
    manifest: Manifest,
    *,
    dry_run: bool = False,
    workers: int | None = None,
    include_metadata: bool = True,
) -> int:
    """Retry failed (and optionally metadata-only) items. Returns count upgraded to ok."""
    statuses = {"failed"}
    if include_metadata:
        statuses.add("metadata_only")

    pending = [
        i
        for i in manifest.items
        if i.status in statuses and (i.doi or (i.url and ".pdf" in (i.url or "").lower()))
    ]

    if not pending:
        return 0

    before_ok = sum(1 for i in manifest.items if i.status == "ok")
    updated = parallel_map(
        lambda item: _retry_item(item, dry_run=dry_run),
        pending,
        workers=workers,
        label="retry",
    )
    for item in updated:
        upsert_item(manifest, item)

    after_ok = sum(1 for i in manifest.items if i.status == "ok")
    return after_ok - before_ok


def retry_unresolved_multi_pass(
    manifest: Manifest,
    *,
    passes: int = 3,
    dry_run: bool = False,
    workers: int | None = None,
    pass_delay_s: float = 5.0,
) -> int:
    """Run multiple retry passes with delay between passes."""
    log = get_logger()
    total_upgraded = 0
    for pass_num in range(1, passes + 1):
        upgraded = retry_unresolved(manifest, dry_run=dry_run, workers=workers)
        total_upgraded += upgraded
        log.info("retry pass %d/%d: upgraded %d items", pass_num, passes, upgraded)
        if upgraded == 0 or pass_num == passes:
            break
        time.sleep(pass_delay_s)
    return total_upgraded
