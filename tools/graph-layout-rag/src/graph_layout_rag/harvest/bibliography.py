from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from graph_layout_rag.harvest.checkpoint import RELEVANCE_CHECKPOINT_EVERY, RESOLVE_BATCH_SIZE
from graph_layout_rag.harvest.doi_resolver import _openalex_by_doi, resolve_dois
from graph_layout_rag.harvest.doi_validate import filter_plausible_bibliography_dois, is_plausible_bibliography_doi
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.tags_inference import infer_harvest_tags
from graph_layout_rag.manifest import ManifestItem, load_manifest, relative_local_path
from graph_layout_rag.paths import PKG_ROOT, PDF_DIR

DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)

SEED_TAGS = {
    "layered",
    "compound",
    "elk-bibliography",
    "layer-assignment",
    "sugiyama",
    "grouped",
    "crossing",
    "hierarchical",
    "dot",
    "handbook",
    "graphviz",
    "topic-seed",
    "curated",
    "bibliography",
    "arxiv",
    "compaction",
    "packing",
    "overlap",
    "research-thread",
    "coordinate-assignment",
    "routing",
    "constraints",
}
DEFAULT_MAX_BIB_DOIS = 300
BIB_RELEVANCE_WORKERS_CAP = 8


def extract_dois_from_text(text: str) -> list[str]:
    return list({m.group(0).lower() for m in DOI_RE.finditer(text)})


def read_pdf_text(local_relative: str) -> str:
    from graph_layout_rag.pdf_text import extract_pages_from_path

    result = extract_pages_from_path(PKG_ROOT / local_relative)
    return "\n".join(text for _, text in result.pages)


def _doi_relevance_decision(doi: str) -> bool:
    from graph_layout_rag.harvest.relevance import is_layout_relevant

    work = _openalex_by_doi(doi)
    if work:
        abstract_idx = work.get("abstract_inverted_index")
        abstract = None
        if abstract_idx:
            pairs = [(pos, word) for word, positions in abstract_idx.items() for pos in positions]
            pairs.sort(key=lambda x: x[0])
            abstract = " ".join(word for _, word in pairs)
        title = work.get("display_name") or ""
        return is_layout_relevant(title, abstract)
    return True  # unknown DOI from layout seed PDF — allow


def _filter_relevant_dois(dois: list[str], *, workers: int | None) -> list[str]:
    decisions = filter_relevant_dois_resumable(dois, workers=workers, relevance_decisions={})
    return select_bibliography_dois(dois, decisions, max_dois=len(dois))


def filter_relevant_dois_resumable(
    dois: list[str],
    *,
    workers: int | None,
    relevance_decisions: dict[str, bool],
    on_decisions_batch: Callable[[dict[str, bool]], None] | None = None,
    checkpoint_every: int = RELEVANCE_CHECKPOINT_EVERY,
) -> dict[str, bool]:
    log = get_logger()
    if not dois:
        return dict(relevance_decisions)

    decisions = dict(relevance_decisions)
    pending = [d for d in dois if d not in decisions]
    if not pending:
        log.info(
            "bibliography: relevance already checked for all %d candidate DOI(s)",
            len(dois),
        )
        return decisions

    relevance_workers = min(workers or BIB_RELEVANCE_WORKERS_CAP, BIB_RELEVANCE_WORKERS_CAP)
    log.info(
        "bibliography: checking relevance for %d candidate DOI(s) (%d already done, %d workers)",
        len(pending),
        len(decisions),
        relevance_workers,
    )

    since_checkpoint = 0

    def _flush() -> None:
        nonlocal since_checkpoint
        if on_decisions_batch and since_checkpoint > 0:
            on_decisions_batch(dict(decisions))
            since_checkpoint = 0

    for start in range(0, len(pending), checkpoint_every):
        batch = pending[start : start + checkpoint_every]

        def _keep(doi: str) -> tuple[str, bool]:
            return doi, _doi_relevance_decision(doi)

        batch_results = parallel_map(
            _keep,
            batch,
            workers=relevance_workers,
            label="bib-doi-relevance",
        )
        for result in batch_results:
            if not result:
                continue
            doi, relevant = result
            decisions[doi] = relevant
            since_checkpoint += 1
        _flush()

    relevant_count = sum(1 for d in dois if decisions.get(d))
    log.info(
        "bibliography: %d/%d candidate DOIs passed relevance filter",
        relevant_count,
        len(dois),
    )
    return decisions


def select_bibliography_dois(
    candidates: list[str],
    relevance_decisions: dict[str, bool],
    *,
    max_dois: int,
) -> list[str]:
    relevant = [d for d in candidates if relevance_decisions.get(d)]
    return relevant[:max_dois]


def scan_bibliography_candidates(
    *,
    max_dois: int = DEFAULT_MAX_BIB_DOIS,
    bib_state: dict[str, Any] | None = None,
) -> list[str]:
    log = get_logger()
    if bib_state:
        saved_max = bib_state.get("max_dois")
        saved_candidates = bib_state.get("candidates")
        if saved_max == max_dois and saved_candidates:
            log.info(
                "bibliography: resuming with %d saved candidate DOI(s)",
                len(saved_candidates),
            )
            return list(saved_candidates)

    manifest = load_manifest()
    known = {i.doi.lower() for i in manifest.items if i.doi}
    candidates: set[str] = set()

    seeds = [
        item
        for item in manifest.items
        if item.status == "ok"
        and item.localPath
        and any(t in SEED_TAGS for t in item.tags)
    ]
    log.info("bibliography: scanning %d seed PDF(s) for DOIs (max_dois=%d)", len(seeds), max_dois)

    for idx, item in enumerate(seeds, 1):
        log.info("bibliography: seed %d/%d — %s", idx, len(seeds), item.id)
        try:
            text = read_pdf_text(item.localPath)
            page_hint = f"{len(text)} chars" if text else "empty"
            raw_dois = extract_dois_from_text(text)
            plausible = [d for d in raw_dois if is_plausible_bibliography_doi(d)]
            new_dois = [d for d in plausible if d not in known and d not in candidates]
            candidates.update(new_dois)
            log.info(
                "bibliography: %s — %s, %d DOI(s) in text, %d new (%d candidates)",
                item.id,
                page_hint,
                len(raw_dois),
                len(new_dois),
                len(candidates),
            )
        except Exception as exc:
            log.warning("bibliography: failed reading %s: %s", item.id, exc)
            continue

        if len(candidates) >= max_dois * 3:
            log.info(
                "bibliography: stopping seed scan early at %d candidates (3× max_dois)",
                len(candidates),
            )
            break

    if not candidates:
        log.info("bibliography: no new DOI candidates in seed PDFs")
        return []

    sorted_candidates = filter_plausible_bibliography_dois(sorted(candidates))
    dropped = len(candidates) - len(sorted_candidates)
    if dropped:
        log.info("bibliography: dropped %d malformed/off-topic DOI candidate(s)", dropped)
    return sorted_candidates


def collect_bibliography_dois(
    *,
    max_dois: int = DEFAULT_MAX_BIB_DOIS,
    workers: int | None = None,
) -> list[str]:
    candidates = scan_bibliography_candidates(max_dois=max_dois)
    if not candidates:
        return []
    decisions = filter_relevant_dois_resumable(candidates, workers=workers, relevance_decisions={})
    selected = select_bibliography_dois(candidates, decisions, max_dois=max_dois)
    get_logger().info("bibliography: selected %d DOI(s) for resolve", len(selected))
    return selected


def pending_bibliography_resolve_dois(
    selected: list[str],
    *,
    resolved_dois: list[str] | set[str] | None = None,
    manifest=None,
) -> list[str]:
    done = {d.lower() for d in (resolved_dois or [])}
    if manifest is not None:
        for item in manifest.items:
            if item.source == "bibliography" and item.doi:
                done.add(item.doi.lower())
    return [d for d in selected if d.lower() not in done]


def resolve_bibliography_dois(
    dois: list[str],
    *,
    workers: int | None = None,
    on_batch: Callable[[list[ManifestItem]], None] | None = None,
    batch_size: int = RESOLVE_BATCH_SIZE,
) -> list[ManifestItem]:
    log = get_logger()
    if not dois:
        return []
    log.info("bibliography: resolving %d DOI(s)", len(dois))
    items = resolve_dois(
        dois,
        source="bibliography",
        tags=["bibliography"],
        workers=workers,
        include_archive=False,
        on_batch=on_batch,
        batch_size=batch_size,
    )
    for item in items:
        item.tags = infer_harvest_tags(item.title, item.abstract, existing=item.tags)
    ok = sum(1 for i in items if i.status == "ok")
    log.info("bibliography: resolve done — %d/%d ok PDFs", ok, len(items))
    return items


def resolve_dois_to_items(
    dois: list[str],
    *,
    workers: int | None = None,
    on_batch: Callable[[list[ManifestItem]], None] | None = None,
    batch_size: int = RESOLVE_BATCH_SIZE,
) -> list[ManifestItem]:
    return resolve_bibliography_dois(
        dois,
        workers=workers,
        on_batch=on_batch,
        batch_size=batch_size,
    )


def _download_bib_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    if item.source != "bibliography" or item.status in ("ok", "metadata_only"):
        return item
    if not item.localPath or ".pdf" not in (item.url or "").lower():
        return item
    dest = PDF_DIR / f"{item.id}.pdf"
    dl = download_to_file(dest, item.url, dry_run=dry_run, doc_id=item.id, doi=item.doi, stage="bibliography")
    if dl.get("ok"):
        item.status = "ok"
        item.sha256 = dl.get("sha256")
        item.localPath = relative_local_path(dest)
    return item


def download_bibliography_pdfs(manifest, *, dry_run: bool, workers: int | None = None) -> None:
    pending = [i for i in manifest.items if i.source == "bibliography" and i.status != "ok"]
    log = get_logger()
    if not pending:
        log.info("bibliography: no pending bibliography PDF downloads")
        return
    log.info("bibliography: downloading %d pending PDF(s)", len(pending))
    updated = parallel_map(
        lambda item: _download_bib_item(item, dry_run=dry_run),
        pending,
        workers=workers,
        label="bibliography-download",
    )
    by_id = {i.id: i for i in updated if i}
    for idx, item in enumerate(manifest.items):
        if item.id in by_id:
            manifest.items[idx] = by_id[item.id]
    ok = sum(1 for i in updated if i and i.status == "ok")
    log.info("bibliography: download pass — %d/%d ok", ok, len(pending))
