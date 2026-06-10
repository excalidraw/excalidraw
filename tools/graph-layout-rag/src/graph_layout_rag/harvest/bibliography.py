from __future__ import annotations

import re

import fitz

from graph_layout_rag.harvest.doi_resolver import _openalex_by_doi, resolve_dois
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.relevance import is_layout_relevant
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
}
DEFAULT_MAX_BIB_DOIS = 300


def extract_dois_from_text(text: str) -> list[str]:
    return list({m.group(0).lower() for m in DOI_RE.finditer(text)})


def read_pdf_text(local_relative: str) -> str:
    path = PKG_ROOT / local_relative
    doc = fitz.open(path)
    try:
        return "\n".join(page.get_text() for page in doc)
    finally:
        doc.close()


def _doi_is_relevant(doi: str) -> bool:
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


def collect_bibliography_dois(*, max_dois: int = DEFAULT_MAX_BIB_DOIS) -> list[str]:
    manifest = load_manifest()
    known = {i.doi.lower() for i in manifest.items if i.doi}
    found: set[str] = set()
    for item in manifest.items:
        if item.status != "ok" or not item.localPath:
            continue
        if not any(t in SEED_TAGS for t in item.tags):
            continue
        try:
            for doi in extract_dois_from_text(read_pdf_text(item.localPath)):
                if doi in known or doi in found:
                    continue
                if _doi_is_relevant(doi):
                    found.add(doi)
        except Exception:
            continue
        if len(found) >= max_dois:
            break
    return sorted(found)[:max_dois]


def resolve_dois_to_items(dois: list[str], *, workers: int | None = None) -> list[ManifestItem]:
    return resolve_dois(
        dois, source="bibliography", tags=["bibliography"], workers=workers
    )


def _download_bib_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    if item.source != "bibliography" or item.status in ("ok", "metadata_only"):
        return item
    if not item.localPath or ".pdf" not in (item.url or "").lower():
        return item
    dest = PDF_DIR / f"{item.id}.pdf"
    dl = download_to_file(dest, item.url, dry_run=dry_run)
    if dl.get("ok"):
        item.status = "ok"
        item.sha256 = dl.get("sha256")
        item.localPath = relative_local_path(dest)
    return item


def download_bibliography_pdfs(manifest, *, dry_run: bool, workers: int | None = None) -> None:
    pending = [i for i in manifest.items if i.source == "bibliography"]
    updated = parallel_map(
        lambda item: _download_bib_item(item, dry_run=dry_run),
        pending,
        workers=workers,
        label="bibliography-download",
    )
    by_id = {i.id: i for i in updated}
    for idx, item in enumerate(manifest.items):
        if item.id in by_id:
            manifest.items[idx] = by_id[item.id]
