from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from graph_layout_rag.harvest.download import download_to_file, fetch_text
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import ManifestItem, relative_local_path, slug_id
from graph_layout_rag.paths import PDF_DIR

HANDBOOK_INDEX = "https://cs.brown.edu/people/rtamassi/gdhandbook/"

HANDBOOK_GUARANTEED_CHAPTERS = [
    {
        "id": "handbook-hierarchical",
        "title": "Hierarchical drawing algorithms",
        "url": "https://cs.brown.edu/people/rtamassi/gdhandbook/chapters/hierarchical.pdf",
        "tags": ["handbook", "layered", "hierarchical", "sugiyama"],
    },
]

CHAPTER_TAG_HINTS: dict[str, list[str]] = {
    "hierarchical": ["handbook", "layered", "hierarchical", "sugiyama"],
    "force": ["handbook", "force-directed"],
    "orthogonal": ["handbook", "orthogonal"],
    "tree": ["handbook", "tree"],
    "cluster": ["handbook", "clustering"],
    "constraint": ["handbook", "constraints"],
    "sugiyama": ["handbook", "layered", "hierarchical"],
    "planar": ["handbook", "planar"],
    "crossing": ["handbook", "crossing"],
    "geographic": ["handbook", "geographic"],
    "label": ["handbook", "labeling"],
    "flow": ["handbook", "flow"],
    "visibility": ["handbook", "visibility"],
}


def _tags_for_chapter(filename: str, title: str) -> list[str]:
    hay = f"{filename} {title}".lower()
    tags = {"handbook"}
    for key, values in CHAPTER_TAG_HINTS.items():
        if key in hay:
            tags.update(values)
    return sorted(tags)


def _extract_chapters(html: str, base_url: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    chapters: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "chapters/" not in href or not href.endswith(".pdf"):
            continue
        url = urljoin(base_url, href)
        row = a.find_parent("tr")
        title = a.get_text(strip=True)
        if row:
            cells = row.find_all("td")
            if len(cells) > 1:
                title = cells[1].get_text(strip=True) or title
        chapters.append((url, title or Path(href).stem))
    return chapters


def _build_handbook_item(
    url: str, title: str, fixed_tags: list[str] | None, *, dry_run: bool
) -> ManifestItem:
    base = Path(url).stem
    extra = next((e for e in HANDBOOK_GUARANTEED_CHAPTERS if e["url"] == url), None)
    doc_id = extra["id"] if extra else slug_id(f"handbook-{base}")
    dest = PDF_DIR / f"{doc_id}.pdf"
    item = ManifestItem(
        id=doc_id,
        title=f"Handbook: {title}",
        authors=["Tamassia"],
        year=2013,
        source="handbook",
        url=url,
        localPath=f"data/raw/pdf/{doc_id}.pdf",
        contentType="application/pdf",
        status="failed",
        tags=fixed_tags or _tags_for_chapter(base, title),
    )
    if dry_run:
        return item
    dl = download_to_file(dest, url, dry_run=dry_run)
    if dl.get("ok") and dest.exists() and dest.read_bytes()[:4] == b"%PDF":
        item.status = "ok"
        item.sha256 = dl.get("sha256")
        item.localPath = relative_local_path(dest)
    return item


def harvest_handbook(*, dry_run: bool = False, workers: int | None = None) -> list[ManifestItem]:
    html = fetch_text(HANDBOOK_INDEX)
    chapters = _extract_chapters(html, HANDBOOK_INDEX)
    by_url: dict[str, tuple[str, str, list[str] | None]] = {
        url: (title, url, None) for url, title in chapters
    }
    for extra in HANDBOOK_GUARANTEED_CHAPTERS:
        by_url[extra["url"]] = (extra["title"], extra["url"], extra["tags"])

    entries = [(url, title, tags) for url, (title, _, tags) in by_url.items()]
    return parallel_map(
        lambda e: _build_handbook_item(e[0], e[1], e[2], dry_run=dry_run),
        entries,
        workers=workers,
    )
