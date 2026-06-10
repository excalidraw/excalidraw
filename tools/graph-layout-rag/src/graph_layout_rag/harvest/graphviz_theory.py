from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from graph_layout_rag.harvest.download import download_to_file, fetch_text
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import ManifestItem, slug_id
from graph_layout_rag.paths import PDF_DIR

GRAPHVIZ_KNOWN_PDFS = [
    {
        "id": "gansner-tse93",
        "title": "A Technique for Drawing Directed Graphs",
        "authors": ["Gansner", "Koutsofios", "North", "Vo"],
        "year": 1993,
        "url": "https://www.graphviz.org/documentation/TSE93.pdf",
        "tags": ["dot", "hierarchical", "layered", "rank"],
    },
    {
        "id": "matuszewski-sifting-crossing-minimization",
        "title": "Using Sifting for k-Layer Straightline Crossing Minimization",
        "authors": ["Matuszewski", "Schönfeld", "Molitor"],
        "year": 1999,
        "url": "https://link.springer.com/content/pdf/10.1007/3-540-46648-7_22.pdf",
        "tags": ["layered", "hierarchical", "crossing", "sugiyama", "graph-drawing"],
        "source": "springer",
        "doi": "10.1007/3-540-46648-7_22",
    },
    {
        "id": "gansner-gkn04-stress",
        "title": "Graph Drawing by Stress Majorization",
        "authors": ["Gansner", "Koren", "North"],
        "year": 2004,
        "url": "https://graphviz.org/documentation/GKN04.pdf",
        "tags": ["neato", "stress", "force-directed"],
    },
    {
        "id": "graphviz-dotguide",
        "title": "Drawing graphs with dot",
        "authors": ["North", "Gansner"],
        "year": 1991,
        "url": "https://www.graphviz.org/pdf/dotguide.pdf",
        "tags": ["dot", "guide"],
    },
    {
        "id": "graphviz-neatoguide",
        "title": "Drawing graphs with neato",
        "authors": ["North"],
        "year": 1992,
        "url": "https://www.graphviz.org/pdf/neatoguide.pdf",
        "tags": ["neato", "guide"],
    },
    {
        "id": "graphviz-sfdp",
        "title": "Efficient and High Quality Force-Directed Graph Drawing",
        "authors": ["Hu"],
        "year": 2005,
        "url": "https://graphviz.org/documentation/Hu05.pdf",
        "alt_urls": ["http://yifanhu.net/PUB/graph_draw.pdf"],
        "tags": ["sfdp", "force-directed"],
    },
    {
        "id": "graphviz-edge-router",
        "title": "Implementing a General-Purpose Edge Router",
        "authors": ["North", "Gansner"],
        "year": 2010,
        "url": "https://graphviz.org/documentation/DGKN97.pdf",
        "tags": ["routing", "edges"],
    },
    {
        "id": "graphviz-gmap",
        "title": "GMap: Visualizing graphs and clusters as maps",
        "authors": ["Gansner", "Hu", "Kobourov"],
        "year": 2010,
        "url": "https://graphviz.org/documentation/GHK09.pdf",
        "tags": ["clustering", "maps"],
    },
    {
        "id": "graphviz-prism-overlap",
        "title": "Efficient Node Overlap Removal Using a Proximity Stress Model",
        "authors": ["Gansner", "Hu"],
        "year": 2012,
        "url": "https://graphviz.org/documentation/GH10.pdf",
        "tags": ["overlap", "stress"],
    },
    {
        "id": "graphviz-dynadag",
        "title": "On-line Hierarchical Graph Drawing",
        "authors": ["Gansner", "North"],
        "year": 2000,
        "url": "https://graphviz.org/documentation/NW01.pdf",
        "tags": ["hierarchical", "dynamic"],
    },
    {
        "id": "graphviz-overview-short",
        "title": "Graphviz and Dynagraph - Static and Dynamic Graph Drawing Tools",
        "authors": ["Gansner", "North"],
        "year": 2001,
        "url": "https://graphviz.org/documentation/EGKNW03.pdf",
        "tags": ["overview"],
    },
    {
        "id": "graphviz-overview-long",
        "title": "An open graph visualization system and its applications to software engineering",
        "authors": ["Gansner", "North"],
        "year": 2000,
        "url": "https://graphviz.org/documentation/GN99.pdf",
        "tags": ["overview", "software-engineering"],
    },
    {
        "id": "graphviz-fisheye",
        "title": "Topological Fisheye Views for Visualizing Large Graphs",
        "authors": ["Hu"],
        "year": 2004,
        "url": "https://graphviz.org/documentation/GKN04a.pdf",
        "tags": ["fisheye", "large-graphs"],
    },
    {
        "id": "graphviz-circular",
        "title": "Improved Circular Layouts",
        "authors": ["Hu"],
        "year": 2006,
        "url": "https://graphviz.org/documentation/GK06.pdf",
        "tags": ["circular"],
    },
]

_GRAPHVIZ_ALT_URLS = {
    k["id"]: k.get("alt_urls", [])
    for k in GRAPHVIZ_KNOWN_PDFS
}


def _extract_pdf_links(html: str, base_url: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        url = urljoin(base_url, href)
        if ".pdf" not in url.lower() and "/documentation/" not in url:
            continue
        title = a.get_text(strip=True) or Path(urlparse(url).path).name
        links.append((url, title))
    return links


def _download_graphviz_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    from graph_layout_rag.manifest import relative_local_path

    urls = [item.url, *_GRAPHVIZ_ALT_URLS.get(item.id, [])]
    dest = PDF_DIR / f"{item.id}.pdf"
    for url in urls:
        if not url:
            continue
        dl = download_to_file(dest, url, dry_run=dry_run)
        if dl.get("ok") and dest.exists() and dest.read_bytes()[:4] == b"%PDF":
            item.status = "ok"
            item.url = url
            item.sha256 = dl.get("sha256")
            item.contentType = dl.get("content_type") or "application/pdf"
            item.localPath = relative_local_path(dest)
            return item
        dest.unlink(missing_ok=True)
    return item


def harvest_graphviz_theory(*, dry_run: bool = False, workers: int | None = None) -> list[ManifestItem]:
    theory_url = "https://graphviz.org/theory/"
    html = fetch_text(theory_url)
    crawled = _extract_pdf_links(html, theory_url)

    by_url: dict[str, ManifestItem] = {}
    for known in GRAPHVIZ_KNOWN_PDFS:
        by_url[known["url"]] = ManifestItem(
            id=known["id"],
            title=known["title"],
            authors=known.get("authors", []),
            year=known.get("year"),
            source=known.get("source", "graphviz.org"),
            url=known["url"],
            localPath=f"data/raw/pdf/{known['id']}.pdf",
            contentType="application/pdf",
            status="failed",
            tags=known["tags"],
            doi=known.get("doi"),
        )

    for url, title in crawled:
        if ".pdf" not in url.lower() or url in by_url:
            continue
        doc_id = slug_id(f"graphviz-{title or Path(urlparse(url).path).name}")
        by_url[url] = ManifestItem(
            id=doc_id,
            title=title or doc_id,
            source="graphviz.org",
            url=url,
            localPath=f"data/raw/pdf/{doc_id}.pdf",
            contentType="application/pdf",
            status="failed",
            tags=["graphviz"],
        )

    return parallel_map(
        lambda item: _download_graphviz_item(item, dry_run=dry_run),
        list(by_url.values()),
        workers=workers,
    )
