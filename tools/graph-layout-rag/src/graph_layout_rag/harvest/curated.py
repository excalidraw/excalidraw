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
    {
        # Canonical-coverage seed: open PDF (Stanford VIS group).
        "id": "bostock-d3-data-driven-documents-2011",
        "title": "D3: Data-Driven Documents",
        "authors": ["Bostock", "Ogievetsky", "Heer"],
        "year": 2011,
        "url": "http://vis.stanford.edu/files/2011-D3-InfoVis.pdf",
        "doi": "10.1109/tvcg.2011.185",
        "source": "stanford",
        "tags": ["d3", "visualization", "toolkit", "web", "canonical-seed"],
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
    # --- Canonical-coverage seeds (gap-fill, 2026-06-14). Paywalled/old; seeded
    # with DOI + real abstract so they are useful metadata units and the
    # retry/bibliography-resolve stages can upgrade to full PDF if an OA copy exists.
    {
        "id": "de-fraysseix-pach-pollack-planar-grid-1990",
        "title": "How to Draw a Planar Graph on a Grid",
        "authors": ["de Fraysseix", "Pach", "Pollack"],
        "year": 1990,
        "url": "https://doi.org/10.1007/BF02122694",
        "doi": "10.1007/bf02122694",
        "source": "springer",
        "tags": ["planar", "straight-line", "grid", "canonical-seed"],
        "abstract": (
            "Proves every n-vertex planar graph has a planar straight-line drawing on a "
            "(2n-4) x (n-2) integer grid, computable in linear time via a canonical vertex "
            "ordering and the incremental 'shift' method. Foundational grid-drawing result."
        ),
    },
    {
        "id": "brandes-pich-pivot-mds-2007",
        "title": "Eigensolver Methods for Progressive Multidimensional Scaling of Large Data (PivotMDS)",
        "authors": ["Brandes", "Pich"],
        "year": 2007,
        "url": "https://doi.org/10.1007/978-3-540-70904-6_6",
        "doi": "10.1007/978-3-540-70904-6_6",
        "source": "springer",
        "tags": ["mds", "stress", "force-directed", "scalable", "canonical-seed"],
        "abstract": (
            "Introduces PivotMDS, a sampling-based approximation of classical multidimensional "
            "scaling that scales graph layout to large graphs by computing positions from "
            "graph-theoretic distances to a small set of pivot vertices via a power-iteration "
            "eigensolver. Complements full stress majorization."
        ),
    },
    {
        "id": "walker-node-positioning-general-trees-1990",
        "title": "A Node-Positioning Algorithm for General Trees",
        "authors": ["Walker"],
        "year": 1990,
        "url": "https://doi.org/10.1002/spe.4380201404",
        "doi": "10.1002/spe.4380201404",
        "source": "wiley",
        "tags": ["tree", "node-positioning", "reingold-tilford", "canonical-seed"],
        "abstract": (
            "Extends Reingold-Tilford tidy tree drawing to general n-ary trees, positioning "
            "subtrees recursively and 'apportioning' to remove overlap between adjacent "
            "subtrees. Original is O(n^2); later made linear-time by Buchheim, Junger, Leipert."
        ),
    },
    {
        "id": "wetherell-shannon-tidy-trees-1979",
        "title": "Tidy Drawings of Trees",
        "authors": ["Wetherell", "Shannon"],
        "year": 1979,
        "url": "https://doi.org/10.1109/TSE.1979.234212",
        "doi": "10.1109/tse.1979.234212",
        "source": "ieee",
        "tags": ["tree", "tidy", "canonical-seed"],
        "abstract": (
            "Early algorithms for aesthetically positioning trees under tidiness criteria "
            "(minimal width, parents centered over children, isomorphic subtrees drawn "
            "identically). Direct precursor to the Reingold-Tilford tree-drawing algorithm."
        ),
    },
    {
        "id": "booth-lueker-pq-trees-1976",
        "title": "Testing for the Consecutive Ones Property, Interval Graphs, and Graph Planarity Using PQ-Tree Algorithms",
        "authors": ["Booth", "Lueker"],
        "year": 1976,
        "url": "https://doi.org/10.1016/S0022-0000(76)80045-1",
        "doi": "10.1016/s0022-0000(76)80045-1",
        "source": "elsevier",
        "tags": ["planarity", "pq-tree", "data-structure", "canonical-seed"],
        "abstract": (
            "Introduces the PQ-tree data structure, giving linear-time tests for the "
            "consecutive-ones property, interval graph recognition, and graph planarity. "
            "Foundational machinery for planar embedding used in many graph-drawing pipelines."
        ),
    },
    {
        "id": "fary-straight-line-planar-1948",
        "title": "On Straight-Line Representation of Planar Graphs",
        "authors": ["Fary"],
        "year": 1948,
        "url": "https://zbmath.org/0030.17902",
        "source": "curated",
        "tags": ["planar", "straight-line", "theory", "canonical-seed"],
        "abstract": (
            "Fary's theorem: every simple planar graph admits a planar straight-line drawing; "
            "any planar graph drawn with curved edges can be redrawn with straight segments "
            "and no crossings. Existence result underpinning straight-line grid algorithms."
        ),
    },
]


# Implementer-grade documentation for the layout engines this corpus models.
# HTML-scraped (``content_url``) into the abstract via ``_extract_blog_text``.
# Distinct from research papers: these describe the *actual* compaction/packing/
# routing modules in OGDF, ELK, dagre, and Graphviz that the pipeline mirrors.
LIBRARY_DOCS = [
    {
        "id": "ogdf-modules-overview",
        "title": "OGDF — Open Graph Drawing Framework: module overview",
        "authors": ["OGDF Contributors"],
        "year": 2024,
        "url": "https://ogdf.github.io/",
        "source": "ogdf",
        "tags": [
            "ogdf", "source-code-docs", "layered", "planar",
            "orthogonal", "compaction", "packing", "routing",
        ],
        "content_url": "https://ogdf.github.io/doc/ogdf/",
    },
    {
        "id": "elk-layered-algorithm-reference",
        "title": "ELK Layered — algorithm reference (phases and intermediate processors)",
        "authors": ["Eclipse Layout Kernel"],
        "year": 2024,
        "url": "https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html",
        "source": "elk",
        "tags": [
            "elk", "source-code-docs", "layered", "sugiyama",
            "coordinate-assignment", "crossing", "ports",
        ],
        "content_url": "https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html",
    },
    {
        "id": "elk-layout-options-reference",
        "title": "ELK — layout options reference (spacing, node placement, compaction)",
        "authors": ["Eclipse Layout Kernel"],
        "year": 2024,
        "url": "https://eclipse.dev/elk/reference/options.html",
        "source": "elk",
        "tags": ["elk", "source-code-docs", "compaction", "packing", "constraints"],
        "content_url": "https://eclipse.dev/elk/reference/options.html",
    },
    {
        "id": "dagre-layout-algorithm-wiki",
        "title": "dagre — layout algorithm internals (rank, order, position)",
        "authors": ["dagre contributors"],
        "year": 2023,
        "url": "https://github.com/dagrejs/dagre/wiki",
        "source": "dagre",
        "tags": [
            "dagre", "source-code-docs", "layered", "sugiyama",
            "layer-assignment", "coordinate-assignment",
        ],
        "content_url": "https://github.com/dagrejs/dagre/wiki",
    },
    {
        "id": "graphviz-dot-layout-docs",
        "title": "Graphviz — dot layout engine documentation",
        "authors": ["Graphviz"],
        "year": 2024,
        "url": "https://graphviz.org/docs/layouts/dot/",
        "source": "graphviz.org",
        "tags": ["graphviz", "dot", "source-code-docs", "layered", "layer-assignment"],
        "content_url": "https://graphviz.org/docs/layouts/dot/",
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

    for spec in [*CURATED_METADATA, *LIBRARY_DOCS]:
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
