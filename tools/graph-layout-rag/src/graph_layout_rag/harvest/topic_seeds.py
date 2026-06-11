"""Verified topic seeds for Sugiyama, ELK/Mermaid, layer reassignment, constraints, compound graphs."""

from __future__ import annotations

from graph_layout_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import ManifestItem, relative_local_path
from graph_layout_rag.paths import PDF_DIR

# Direct PDF URLs (verified or high-confidence)
TOPIC_PDF_SEEDS = [
    {
        "id": "elk-eclipse-layout-kernel-arxiv",
        "title": "The Eclipse Layout Kernel",
        "authors": ["Domrös", "von Hanxleden", "Spönemann", "Rüegg", "Schulze"],
        "year": 2023,
        "url": "https://arxiv.org/pdf/2311.00533.pdf",
        "doi": "10.48550/arXiv.2311.00533",
        "source": "arxiv",
        "tags": ["elk", "mermaid", "layered", "compound", "ports", "kieler"],
    },
    {
        "id": "kiel-minimum-width-layering",
        "title": "Layering Heuristics for Minimum-Width Layerings",
        "authors": ["Rüegg", "von Hanxleden"],
        "year": 2017,
        "url": "https://rtsys.informatik.uni-kiel.de/~biblio/downloads/papers/report-1701.pdf",
        "source": "kiel",
        "tags": ["layer-assignment", "layered", "minimum-width", "elk"],
    },
    {
        "id": "kiel-wrapping-layered-graphs",
        "title": "Wrapping Layered Graphs",
        "authors": ["Rüegg", "von Hanxleden"],
        "year": 2018,
        "url": "https://rtsys.informatik.uni-kiel.de/~biblio/downloads/papers/report-1803.pdf",
        "doi": "10.1007/978-3-319-91376-6_10",
        "source": "kiel",
        "tags": ["layer-assignment", "layered", "wrapping", "elk"],
    },
    {
        "id": "sander-compound-directed-graphs",
        "title": "Layout of Compound Directed Graphs",
        "authors": ["Sander"],
        "year": 1996,
        "url": "https://publikationen.sulb.uni-saarland.de/bitstream/20.500.11880/25862/1/tr-A03-96.pdf",
        "source": "saarland",
        "tags": ["compound", "layered", "dagre", "clustering"],
    },
    {
        "id": "stratisfimal-layout",
        "title": "STRATISFIMAL LAYOUT: A modular optimization model for laying out layered node-link network visualizations",
        "authors": ["Di Bartolomeo", "Riedewald", "Gatterbauer", "Dunne"],
        "year": 2021,
        "url": "https://par.nsf.gov/servlets/purl/10323504",
        "doi": "10.1109/TVCG.2021.3114756",
        "source": "nsf-par",
        "tags": ["layered", "compound", "grouped", "crossing", "constraints"],
    },
    {
        "id": "forster-compound-crossing-gd2002",
        "title": "Applying Crossing Reduction Strategies to Layered Compound Graphs",
        "authors": ["Forster"],
        "year": 2002,
        "url": "https://link.springer.com/content/pdf/10.1007/3-540-36151-0_26.pdf",
        "doi": "10.1007/3-540-36151-0_26",
        "source": "springer",
        "tags": ["compound", "crossing", "layered", "dagre"],
    },
    {
        "id": "forster-constrained-two-level-crossing",
        "title": "A Fast and Simple Heuristic for Constrained Two-Level Crossing Reduction",
        "authors": ["Forster"],
        "year": 2004,
        "url": "https://link.springer.com/content/pdf/10.1007/978-3-540-31843-9_19.pdf",
        "doi": "10.1007/978-3-540-31843-9_19",
        "source": "springer",
        "tags": ["compound", "crossing", "layered", "dagre"],
    },
    {
        "id": "fruchterman-reingold",
        "title": "Graph Drawing by Force-directed Placement",
        "authors": ["Fruchterman", "Reingold"],
        "year": 1991,
        "url": "https://onlinelibrary.wiley.com/doi/pdfdirect/10.1002/spe.4380211102",
        "doi": "10.1002/spe.4380211102",
        "source": "wiley",
        "tags": ["force-directed", "elastic"],
    },
]

# Resolved via doi_resolver (OpenAlex / S2 / Springer)
TOPIC_DOI_SEEDS: list[dict] = [
    {
        "doi": "10.1109/TSMC.1981.4308636",
        "tags": ["sugiyama", "layered", "hierarchical"],
        "title_hint": "Methods for visual understanding of hierarchical system structures",
    },
    {
        "doi": "10.1109/21.108630",
        "tags": ["sugiyama", "compound", "layered"],
        "title_hint": "How to draw a compound digraph",
    },
    {
        "doi": "10.1016/j.dam.2005.05.023",
        "tags": ["layer-assignment", "layered"],
        "title_hint": "Graph layering by promotion of nodes",
    },
    {
        "doi": "10.1145/1064546.1180618",
        "tags": ["layer-assignment", "minimum-width", "layered"],
        "title_hint": "Minimum-width graph layering with dummy nodes",
    },
    {
        "doi": "10.1007/BF00288685",
        "tags": ["layer-assignment", "layered", "coffman-graham"],
        "title_hint": "Optimal scheduling for two-processor systems",
    },
    {
        "doi": "10.1109/INFVIS.2005.1532130",
        "tags": ["constraints", "elastic", "force-directed", "layered"],
        "pdf_urls": ["http://marvl.infotech.monash.edu/~dwyer/papers/digcola2005.pdf"],
    },
    {
        "doi": "10.1016/j.jvlc.2013.11.005",
        "tags": ["ports", "layered", "compound", "elk"],
        "title_hint": "Drawing layered graphs with port constraints",
    },
    {
        "doi": "10.1007/978-3-642-11805-0_14",
        "tags": ["ports", "layered", "compound", "elk"],
        "title_hint": "Port constraints in hierarchical layout of data flow diagrams",
    },
    {
        "doi": "10.1007/978-3-319-50106-2_16",
        "tags": ["layer-assignment", "layered", "elk"],
        "title_hint": "Generalization of the directed graph layering problem",
    },
    {
        "doi": "10.1007/978-3-319-50106-2_17",
        "tags": ["layer-assignment", "compact", "layered"],
        "title_hint": "Compact layered drawings of general directed graphs",
    },
    {
        "doi": "10.1007/978-3-319-27261-0_12",
        "tags": ["coordinate-assignment", "ports", "layered", "elk"],
        "title_hint": "Size- and port-aware horizontal node coordinate assignment",
    },
    {
        "doi": "10.5220/0011656700003417",
        "tags": ["sugiyama", "layered", "order", "elk"],
        "title_hint": "Model order in Sugiyama layouts",
    },
    {
        "doi": "10.5220/0010833800003124",
        "tags": ["crossing", "sugiyama", "layered", "elk"],
        "title_hint": "Preserving order during crossing minimization in Sugiyama layouts",
    },
    {
        "doi": "10.1109/TVCG.2024.3456349",
        "tags": ["crossing", "layered", "optimal"],
        "title_hint": "Evaluating speedup techniques for optimal crossing minimization",
    },
    {
        "doi": "10.1007/BFb0021828",
        "tags": ["layered", "manhattan", "compound"],
        "title_hint": "A fast heuristic for hierarchical Manhattan layout",
    },
    {
        "doi": "10.1007/978-3-540-31843-9_25",
        "tags": ["stress", "force-directed", "elastic"],
        "title_hint": "Graph drawing by stress majorization",
    },
    {
        "doi": "10.1016/j.comgeo.2022.101886",
        "tags": ["ports", "layered", "constraints"],
        "title_hint": "Layered drawing with generalized port constraints",
    },
    {
        "doi": "10.1007/978-3-642-00219-9_37",
        "tags": ["constraints", "compound"],
        "title_hint": "Dunnart constraint-based network diagram authoring",
    },
    {
        "doi": "10.1007/978-3-319-42333-3_16",
        "tags": ["layered", "compaction", "elk"],
        "title_hint": "One-dimensional compaction for smaller graph drawings",
    },
    {
        "doi": "10.1007/978-3-642-11805-0_19",
        "tags": ["routing", "orthogonal", "ports"],
        "title_hint": "Orthogonal connector routing",
    },
    {
        "doi": "10.1007/3-540-45848-4_3",
        "tags": ["layered", "coordinate-assignment", "crossing"],
        "title_hint": "Fast and Simple Horizontal Coordinate Assignment (Brandes-Köpf)",
    },
    {
        "doi": "10.1007/978-3-540-46648-7_22",
        "tags": ["crossing", "sifting", "layered"],
        "title_hint": "Using Sifting for k-Layer Straightline Crossing Minimization",
    },
    {
        "doi": "10.1007/3-540-46769-6_29",
        "tags": ["layer-assignment", "layered", "circular"],
        "title_hint": "Circular Drawings of Level-Planar Graphs",
    },
    {
        "doi": "10.1016/0020-0190(89)90102-6",
        "tags": ["force-directed", "kamada-kawai"],
        "title_hint": "An algorithm for drawing general undirected graphs (Kamada-Kawai)",
    },
    {
        "doi": "10.1016/0020-0190(89)90105-0",
        "tags": ["force-directed", "constraints"],
        "title_hint": "Drawing graphs nicely using simulated annealing (Davidson-Harel)",
    },
    {
        "doi": "10.1007/978-3-642-55946-3_31",
        "tags": ["aesthetic", "evaluation"],
        "title_hint": "Aesthetics and the Design of Network Visualization (Purchase)",
    },
    {
        "doi": "10.1007/978-3-540-24595-7_26",
        "tags": ["force-directed", "multilevel"],
        "title_hint": "A Multilevel Algorithm for Force-Directed Graph Drawing (Walshaw)",
    },
    {
        "doi": "10.1145/2594291.2594310",
        "tags": ["constraints", "force-directed", "stress"],
        "title_hint": "Stress Minimization with Separation Constraints",
    },
    {
        "doi": "10.1145/2976767.2976805",
        "tags": ["metro-map", "layout"],
        "title_hint": "Metro Map Layout via Mixed-Integer Programming",
    },
    {
        "doi": "10.1007/978-3-031-19756-7_5",
        "tags": ["edge-bundling", "layout"],
        "title_hint": "Bundling Edges in Graph Drawings",
    },
    {
        "doi": "10.1007/978-3-642-11805-0_2",
        "tags": ["compound", "layered"],
        "title_hint": "The Art of Cheating When Drawing a Graph",
    },
    {
        "doi": "10.1007/978-3-642-16145-2_14",
        "tags": ["compound", "clustering"],
        "title_hint": "Drawing Clustered Graphs as Topographic Maps",
    },
    {
        "doi": "10.1007/978-3-319-42333-3_2",
        "tags": ["layered", "storyline"],
        "title_hint": "Block Crossings in Storyline Layouts",
    },
    {
        "doi": "10.1109/VLHCC.2013.6645246",
        "tags": ["elk", "ports", "layered"],
        "title_hint": "Port Constraints in KIELER",
    },
    {
        "doi": "10.1109/VLHCC.2014.6883019",
        "tags": ["elk", "layered"],
        "title_hint": "KIELER Layout for Diagrams",
    },
    {
        "doi": "10.1109/VLHCC.2016.7739657",
        "tags": ["elk", "layered", "compound"],
        "title_hint": "Layered Layout with ELK",
    },
    {
        "doi": "10.1007/978-3-319-42333-3_17",
        "tags": ["layered", "wrapping"],
        "title_hint": "Drawing Layered Graphs with Wrapping",
    },
    {
        "doi": "10.1007/978-3-642-00219-9_25",
        "tags": ["constraints", "layout"],
        "title_hint": "Constraint-Based Layout",
    },
    {
        "doi": "10.5220/0010186400380049",
        "tags": ["elk", "layered", "crossing"],
        "title_hint": "KIELER layered layout crossing",
    },
    {
        "doi": "10.5220/0011803000003417",
        "tags": ["elk", "layered"],
        "title_hint": "KIELER layout heuristics",
    },
    {
        "doi": "10.21941/kcss/2019/4",
        "tags": ["elk", "layered"],
        "title_hint": "KIELER layout kernel technical report",
    },
    {
        "doi": "10.1007/978-3-642-55946-3",
        "tags": ["graph-drawing", "gd2001"],
        "title_hint": "Graph Drawing GD 2001 proceedings",
    },
    {
        "doi": "10.1007/978-3-540-24595-7",
        "tags": ["graph-drawing", "gd2002"],
        "title_hint": "Graph Drawing GD 2002 proceedings",
    },
    {
        "doi": "10.1007/978-3-540-31843-9",
        "tags": ["graph-drawing", "gd2004"],
        "title_hint": "Graph Drawing GD 2004 proceedings",
    },
    {
        "doi": "10.1007/978-3-319-50106-2",
        "tags": ["graph-drawing", "gd2016"],
        "title_hint": "Graph Drawing GD 2016 proceedings",
    },
    {
        "doi": "10.1007/978-3-319-27261-0",
        "tags": ["graph-drawing", "gd2014"],
        "title_hint": "Graph Drawing GD 2014 proceedings",
    },
    {
        "doi": "10.1007/978-3-031-19756-7",
        "tags": ["graph-drawing", "gd2022"],
        "title_hint": "Graph Drawing GD 2022 proceedings",
    },
]

# Pipeline layout research threads: compaction, packing, overlap, VPSC/containment
PIPELINE_LAYOUT_DOI_SEEDS: list[dict] = [
    {
        "doi": "10.1007/11582767_38",
        "tags": ["constraints", "overlap", "vpsc"],
        "title_hint": "Fast Node Overlap Removal (VPSC)",
        "pdf_urls": ["http://marvl.infotech.monash.edu/~dwyer/papers/fnr.pdf"],
    },
    {
        "doi": "10.1109/TVCG.2006.197",
        "tags": ["constraints", "compound", "overlap"],
        "title_hint": "IPSep-CoLa separation constraint layout",
        "pdf_urls": ["http://marvl.infotech.monash.edu/~dwyer/papers/ipsepcola.pdf"],
    },
    {
        "doi": "10.1007/978-3-642-00219-9_22",
        "tags": ["constraints", "compound", "overlap"],
        "title_hint": "Topology Preserving Constrained Graph Layout",
        "pdf_urls": ["http://www.csse.monash.edu.au/~tdwyer/topology.pdf"],
    },
    {
        "doi": "10.1007/BFb0021827",
        "tags": ["overlap", "mental-map", "force-directed"],
        "title_hint": "Layout Adjustment and the Mental Map",
    },
    {
        "doi": "10.1109/TCAD.1983.1270025",
        "tags": ["compaction", "vlsi"],
        "title_hint": "An Algorithm to Compact a VLSI Symbolic Layout with Mixed Constraints",
    },
    {
        "doi": "10.1145/285730.285792",
        "tags": ["compaction", "vlsi"],
        "title_hint": "Symbolic layout compaction review",
    },
    {
        "doi": "10.1016/j.ins.2007.02.016",
        "tags": ["overlap", "cluster-busting"],
        "title_hint": "A new algorithm for removing node overlapping in graph visualization",
    },
    {
        "doi": "10.7155/jgaa.00004",
        "tags": ["overlap", "cluster-busting", "compound"],
        "title_hint": "Algorithms for Cluster Busting in Anchored Graph Drawing",
        "pdf_urls": ["https://jgaa.info/index.php/jgaa/article/view/paper4/4.pdf"],
    },
    {
        "doi": "10.1016/j.ejor.2011.06.022",
        "tags": ["packing", "strip-packing"],
        "title_hint": "A skyline heuristic for the 2D rectangular packing and strip packing problems",
    },
    {
        "doi": "10.1016/j.cor.2016.11.024",
        "tags": ["packing", "strip-packing"],
        "title_hint": "An improved skyline based heuristic for the 2D strip packing problem",
    },
    {
        "doi": "10.1145/800158.805069",
        "tags": ["packing", "channel-routing", "left-edge"],
        "title_hint": "Wire routing by optimizing channel assignment (left-edge algorithm)",
    },
    {
        "doi": "10.1587/e76-a_4_507",
        "tags": ["compaction", "vlsi", "scanline"],
        "title_hint": "Optimal constraint graph generation via enhanced plane-sweep (shadow propagation)",
    },
    {
        "doi": "10.1109/43.543596",
        "tags": ["packing", "floorplanning", "sequence-pair"],
        "title_hint": "VLSI module placement based on rectangle-packing by the sequence-pair",
    },
    {
        "doi": "10.1145/337292.337541",
        "tags": ["packing", "floorplanning", "b-star-tree"],
        "title_hint": "B*-Trees: a new representation for non-slicing floorplans",
        "pdf_urls": [
            "https://cecs.uci.edu/~papers/compendium94-03/papers/2000/dac00/pdffiles/27_1.pdf"
        ],
    },
]

TOPIC_METADATA_SEEDS = [
    {
        "id": "mermaid-layouts-docs",
        "title": "Mermaid diagram layouts (dagre, ELK, tidy-tree, cose-bilkent)",
        "authors": ["Mermaid"],
        "year": 2024,
        "url": "https://mermaid.ai/open-source/config/layouts.html",
        "source": "mermaid",
        "tags": ["mermaid", "dagre", "elk", "layered"],
        "abstract": (
            "Mermaid supports multiple layout engines: dagre (layered/Sugiyama-style), "
            "elk (Eclipse Layout Kernel for compound graphs and ports), tidy-tree, and "
            "cose-bilkent force-directed. Configure via flowchart defaultRenderer."
        ),
    },
    {
        "id": "research-thread-layer-assignment",
        "title": "Layer reassignment with slack / ALAP scheduling",
        "authors": ["Gansner", "Nikolov", "Tarassov"],
        "year": 2005,
        "url": "https://graphviz.org/documentation/TSE93.pdf",
        "source": "research-thread",
        "tags": ["layer-assignment", "research-thread"],
        "abstract": (
            "Network simplex balance, node promotion layering, minimum-width layering with "
            "dummy nodes, Coffman-Graham scheduling. Queries: minimum width layering dummy "
            "nodes; node promotion layering; ALAP as-late-as-possible scheduling DAG."
        ),
    },
    {
        "id": "research-thread-compaction",
        "title": "VLSI layout compaction — constraint graphs and scanlines",
        "authors": ["Liao", "Wong"],
        "year": 1983,
        "url": "https://doi.org/10.1109/TCAD.1983.1270025",
        "source": "research-thread",
        "tags": ["compaction", "research-thread"],
        "abstract": (
            "Reposition boxes in XY without overlap via 1D compaction (constraint graphs + "
            "longest path), scanline constraint generation, mixed-constraint compaction. "
            "Queries: constraint graph one-dimensional compaction longest path; scanline "
            "shadow constraint generation VLSI; two-dimensional compaction NP-hard."
        ),
    },
    {
        "id": "research-thread-constraints",
        "title": "Constraint-based layout with cluster containment",
        "authors": ["Dwyer", "Marriott", "Stuckey"],
        "year": 2005,
        "url": "http://marvl.infotech.monash.edu/~dwyer/papers/fnr.pdf",
        "source": "research-thread",
        "tags": ["constraints", "research-thread"],
        "abstract": (
            "VPSC separation constraints, IPSep-CoLa cluster containment, topology-preserving "
            "constrained layout. Queries: separation constraints quadratic program VPSC; "
            "cluster containment constraint layout."
        ),
    },
    {
        "id": "research-thread-compound",
        "title": "Compound/clustered Sugiyama layout",
        "authors": ["Sugiyama", "Sander", "Forster"],
        "year": 1996,
        "url": "https://arxiv.org/abs/2311.00533",
        "source": "research-thread",
        "tags": ["compound", "research-thread"],
        "abstract": (
            "Global ranking with cluster borders, ELK layered hierarchical handling, crossing "
            "reduction in compound graphs. Queries: compound directed graph layout global "
            "ranking cluster borders."
        ),
    },
    {
        "id": "research-thread-packing",
        "title": "Rectangle/strip packing with fixed coordinate",
        "authors": ["Hashimoto", "Burke", "Wei"],
        "year": 2011,
        "url": "https://doi.org/10.1016/j.ejor.2011.06.022",
        "source": "research-thread",
        "tags": ["packing", "research-thread"],
        "abstract": (
            "Skyline/bottom-left strip packing heuristics; interval scheduling and track "
            "assignment (channel routing left-edge algorithm — siblings with disjoint "
            "X-intervals sharing Y tracks). Queries: strip packing bottom-left skyline "
            "heuristic; left edge algorithm channel routing track assignment."
        ),
    },
    {
        "id": "research-thread-overlap",
        "title": "Mental-map-preserving layout adjustment",
        "authors": ["Misue", "Gansner", "Huang"],
        "year": 1995,
        "url": "https://doi.org/10.1007/BFb0021827",
        "source": "research-thread",
        "tags": ["overlap", "research-thread"],
        "abstract": (
            "Force-scan layout adjustment, PRISM overlap removal, cluster busting. "
            "Queries: layout adjustment mental map graph drawing; cluster busting clutter "
            "reduction graph layout."
        ),
    },
]


def _download_pdf_seed(spec: dict, *, dry_run: bool) -> ManifestItem:
    item = ManifestItem(
        id=spec["id"],
        title=spec["title"],
        authors=spec.get("authors", []),
        year=spec.get("year"),
        source=spec.get("source", "topic-seed"),
        url=spec["url"],
        localPath=f"data/raw/pdf/{spec['id']}.pdf",
        contentType="application/pdf",
        status="failed",
        tags=[*spec.get("tags", []), "topic-seed"],
        doi=spec.get("doi"),
    )
    if dry_run:
        return item

    dest = PDF_DIR / f"{spec['id']}.pdf"
    fallback_urls = [spec["url"], *spec.get("fallback_urls", [])]
    for url in fallback_urls:
        insecure = any(h in url for h in ("infotech.monash.edu", "marvl.", "rtsys.informatik"))
        try:
            dl = download_to_file(dest, url, verify=not insecure)
            if dl.get("ok") and dest.exists() and dest.read_bytes()[:4] == b"%PDF":
                item.status = "ok"
                item.url = url
                item.sha256 = dl.get("sha256")
                item.localPath = relative_local_path(dest)
                return item
            dest.unlink(missing_ok=True)
        except Exception:
            dest.unlink(missing_ok=True)
    return item


def harvest_topic_seeds(*, dry_run: bool = False, workers: int | None = None) -> list[ManifestItem]:
    results: list[ManifestItem] = []

    results.extend(
        parallel_map(
            lambda spec: _download_pdf_seed(spec, dry_run=dry_run),
            TOPIC_PDF_SEEDS,
            workers=workers,
        )
    )

    def _resolve_doi_seed(spec: dict) -> ManifestItem:
        return resolve_doi_with_fallbacks(
            spec["doi"],
            source="topic-seed",
            tags=[*spec.get("tags", []), "topic-seed"],
            pdf_urls=spec.get("pdf_urls"),
            dry_run=dry_run,
        )

    all_doi_seeds = [*TOPIC_DOI_SEEDS, *PIPELINE_LAYOUT_DOI_SEEDS]
    results.extend(parallel_map(_resolve_doi_seed, all_doi_seeds, workers=workers))

    for spec in TOPIC_METADATA_SEEDS:
        results.append(
            ManifestItem(
                id=spec["id"],
                title=spec["title"],
                authors=spec.get("authors", []),
                year=spec.get("year"),
                source=spec.get("source", "topic-seed"),
                url=spec["url"],
                contentType="text/html",
                status="metadata_only",
                tags=[*spec.get("tags", []), "topic-seed"],
                abstract=spec.get("abstract"),
            )
        )

    return results
