"""Curated seeds from research threads and blog posts."""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from graph_layout_rag.harvest.download import download_to_file, fetch_text
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import ManifestItem, relative_local_path
from graph_layout_rag.paths import PDF_DIR

# HN discussion: https://news.ycombinator.com/item?id=34576941
# Graphviz comment: https://news.ycombinator.com/item?id=34580064
HN_THREAD_URL = "https://news.ycombinator.com/item?id=34576941"

CURATED_PDFS = [
    {
        "id": "purchase-aesthetic-criteria-gd1997",
        "title": "Which Aesthetic Has the Greatest Effect on Human Understanding?",
        "authors": ["Purchase", "Carrington", "Allder"],
        "year": 1997,
        "url": "https://link.springer.com/content/pdf/10.1007/3-540-63938-1_31.pdf",
        "doi": "10.1007/3-540-63938-1_31",
        "source": "springer",
        "tags": ["aesthetic", "evaluation", "layered", "curated"],
    },
    {
        "id": "brandes-koepf-blocks-gd2004",
        "title": "On the Complexity of Partitioning Graphs for Arc Diagrams",
        "authors": ["Brandes", "Köpf"],
        "year": 2004,
        "url": "https://link.springer.com/content/pdf/10.1007/978-3-540-31843-9_31.pdf",
        "doi": "10.1007/978-3-540-31843-9_31",
        "source": "springer",
        "tags": ["layered", "blocks", "curated"],
    },
    {
        "id": "brandes-koepf-horizontal-coordinate-assignment",
        "title": "Fast and Simple Horizontal Coordinate Assignment",
        "authors": ["Brandes", "Köpf"],
        "year": 2001,
        "url": "https://link.springer.com/content/pdf/10.1007/3-540-45848-4_3.pdf",
        "doi": "10.1007/3-540-45848-4_3",
        "source": "springer",
        "tags": ["layered", "hierarchical", "coordinate-assignment", "gd2001", "hn"],
        "hn_note": "Recommended by Graphviz on HN 34580064 for crossing minimization.",
    },
    {
        "id": "yoghourdjian-ultra-compact-grid-grouped",
        "title": "High-Quality Ultra-Compact Grid Layout of Grouped Networks",
        "authors": ["Yoghourdjian", "Dwyer", "Gange", "Kieffer", "Marriott", "Stuckey"],
        "year": 2015,
        "url": "http://marvl.infotech.monash.edu/~dwyer/papers/gridlayout2015.pdf",
        "doi": "10.1109/tvcg.2015.2467251",
        "source": "monash",
        "tags": ["grouped", "grid", "constraints", "ieeevis", "hn"],
        "hn_note": "Recommended by Graphviz on HN 34580064 for grouped/hierarchical blocks.",
    },
]

CURATED_METADATA = [
    {
        "id": "terrastruct-crossing-minimization-blog",
        "title": "Diagram layout engines: Minimizing hierarchical edge crossings",
        "authors": ["Batista"],
        "year": 2023,
        "url": "https://www.terrastruct.com/blog/post/diagram-layout-engines-crossing-minimization/",
        "source": "terrastruct",
        "tags": ["blog", "crossing-minimization", "layered", "sugiyama", "sifting", "hn"],
        "content_url": "https://www.terrastruct.com/blog/post/diagram-layout-engines-crossing-minimization/",
    },
    {
        "id": "dwyer-ipsep-cola",
        "title": "IPSep-CoLa: An Incremental Procedure for Separation Constraint Layout of Graphs",
        "authors": ["Dwyer", "Koren", "Marriott"],
        "year": 2006,
        "url": "https://doi.org/10.1109/tvcg.2006.156",
        "doi": "10.1109/tvcg.2006.156",
        "source": "ieee",
        "tags": ["neato", "constraints", "separation", "force-directed", "ieeevis", "hn"],
        "abstract": (
            "Extends force-directed stress-majorization layout with separation constraints "
            "(minimum horizontal or vertical distance between node pairs). Used for directed "
            "flow, non-overlapping labels, and grouped clusters. Implemented in Graphviz neato "
            "-Gmode=hier. Recommended by Graphviz on HN 34580064."
        ),
        "hn_note": "IEEE TVCG; paywalled — metadata stub unless an OA PDF is found later.",
    },
]


def _extract_blog_text(url: str, *, max_chars: int = 12000) -> str:
    html = fetch_text(url)
    soup = BeautifulSoup(html, "html.parser")
    root = soup.find("main") or soup.find("article") or soup.body
    if not root:
        return ""
    for tag in root(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = root.get_text("\n", strip=True)
    marker = "Minimizing hierarchical edge crossings"
    if marker in text:
        text = text[text.index(marker) :]
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:max_chars]


def harvest_curated(*, dry_run: bool = False, workers: int | None = None) -> list[ManifestItem]:
    """Harvest papers and posts curated from the Terrastruct/HN crossing-minimization thread."""
    results: list[ManifestItem] = []

    results.extend(
        parallel_map(
            lambda spec: _harvest_curated_pdf(spec, dry_run=dry_run),
            CURATED_PDFS,
            workers=workers,
        )
    )

    for spec in CURATED_METADATA:
        abstract = spec.get("abstract", "")
        if spec.get("content_url") and not dry_run:
            try:
                body = _extract_blog_text(spec["content_url"])
                if body:
                    abstract = body
            except Exception:
                pass
        elif spec.get("content_url") and dry_run:
            abstract = abstract or f"Blog post at {spec['content_url']}"

        results.append(
            ManifestItem(
                id=spec["id"],
                title=spec["title"],
                authors=spec.get("authors", []),
                year=spec.get("year"),
                source=spec.get("source", "curated"),
                url=spec["url"],
                contentType="text/html" if spec.get("content_url") else "text/metadata",
                status="metadata_only",
                tags=[*spec.get("tags", []), "curated"],
                doi=spec.get("doi"),
                abstract=abstract or spec.get("hn_note"),
            )
        )

    return results


def _harvest_curated_pdf(spec: dict, *, dry_run: bool) -> ManifestItem:
    note = spec.get("hn_note", "")
    item = ManifestItem(
        id=spec["id"],
        title=spec["title"],
        authors=spec.get("authors", []),
        year=spec.get("year"),
        source=spec.get("source", "curated"),
        url=spec["url"],
        localPath=f"data/raw/pdf/{spec['id']}.pdf",
        contentType="application/pdf",
        status="failed",
        tags=[*spec.get("tags", []), "curated"],
        doi=spec.get("doi"),
        abstract=note or None,
    )
    if dry_run:
        return item

    dest = PDF_DIR / f"{spec['id']}.pdf"
    insecure = any(
        host in spec["url"]
        for host in ("infotech.monash.edu", "it.monash.edu", "marvl.")
    )
    try:
        dl = download_to_file(dest, spec["url"], dry_run=dry_run, verify=not insecure)
        if dl.get("ok") and dest.exists() and dest.read_bytes()[:4] == b"%PDF":
            item.status = "ok"
            item.sha256 = dl.get("sha256")
            item.localPath = relative_local_path(dest)
        else:
            dest.unlink(missing_ok=True)
    except Exception:
        dest.unlink(missing_ok=True)
    return item
