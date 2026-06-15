from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class EvalCase:
    id: str
    query: str
    relevant_doc_ids: frozenset[str]
    category: str | None = None
    pdf_only: bool = False
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "query": self.query,
            "relevant_doc_ids": sorted(self.relevant_doc_ids),
            "category": self.category,
            "pdf_only": self.pdf_only,
            "notes": self.notes,
        }


# Gold cases expanded 2026-06-15 via offline BM25 pooling + abstract/title
# curation (tools/graph-layout-rag, /tmp/gold_pool.py). Most cases now carry
# multiple relevant documents: the prior single-label set systematically
# understated quality because the corpus holds dense clusters of on-topic
# papers per subtopic (e.g. the node-overlap-removal / IPSep-CoLa family, the
# skyline strip-packing papers, the Brandes-Köpf coordinate-assignment family).
# Labels reference exact manifest ids; duplicate provider variants of one paper
# canonicalize at query time, so one id per distinct work is listed.
GOLD_CASES: tuple[EvalCase, ...] = (
    # ---- layer assignment ----
    EvalCase(
        id="layer-assignment-network-simplex",
        query="network simplex rank assignment layered digraph",
        relevant_doc_ids=frozenset({
            "gansner-tse93",
            "handbook-hierarchical",
            "doi-10-1109-iccis-2013-401",
        }),
        category="layer-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="layer-assignment-alap",
        query="ALAP as-late-as-possible layer reassignment",
        relevant_doc_ids=frozenset({
            "research-thread-layer-assignment",
            "doi-10-1007-3-540-45848-4-2",
            "jgaa-2468-root-demotion-efficient-post-processing-of-layered-graphs-to-reduce-du",
        }),
        category="layer-assignment",
    ),
    EvalCase(
        id="layer-assignment-min-width",
        query="minimum width layering dummy nodes",
        relevant_doc_ids=frozenset({
            "kiel-minimum-width-layering",
            "research-thread-layer-assignment",
            "openalex-10-21941-bii-1701",
            "doi-10-1145-1064546-1180618",
        }),
        category="layer-assignment",
    ),
    EvalCase(
        id="layer-assignment-longest-path",
        query="longest path layering directed acyclic graph",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-3-540-36151-0-10",
            "doi-10-1007-3-540-45848-4-2",
            "doi-10-1007-978-3-319-50106-2-16",
            "arxiv-1908-04104v1",
        }),
        category="layer-assignment",
    ),
    EvalCase(
        id="layer-assignment-coffman-graham",
        query="Coffman-Graham layering bounded width",
        relevant_doc_ids=frozenset({
            "handbook-hierarchical",
            "kiel-minimum-width-layering",
            "openalex-10-21941-bii-1701",
        }),
        category="layer-assignment",
    ),
    EvalCase(
        id="layer-assignment-node-promotion",
        query="node promotion reduce dummy nodes layered layout",
        relevant_doc_ids=frozenset({
            "doi-10-1016-j-dam-2005-05-023",
            "research-thread-layer-assignment",
            "handbook-hierarchical",
        }),
        category="layer-assignment",
    ),
    # ---- crossing minimization ----
    EvalCase(
        id="crossing-sifting",
        query="sifting crossing minimization layered graph",
        relevant_doc_ids=frozenset({
            "matuszewski-sifting-crossing-minimization",
            "openalex-10-1007-3-540-44541-2-24",
        }),
        category="crossing",
        pdf_only=True,
    ),
    EvalCase(
        id="crossing-barycenter-median",
        query="barycenter median heuristic crossing reduction two layer",
        relevant_doc_ids=frozenset({
            "doi-10-1007-bfb0021817",
            "doi-10-7155-jgaa-00001",
            "matuszewski-sifting-crossing-minimization",
            "handbook-hierarchical",
        }),
        category="crossing",
        pdf_only=True,
    ),
    EvalCase(
        id="crossing-heuristics",
        query="crossing minimization heuristics layered drawing",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-978-3-540-24595-7-2",
            "matuszewski-sifting-crossing-minimization",
            "handbook-crossings",
        }),
        category="crossing",
        pdf_only=True,
    ),
    EvalCase(
        id="crossing-one-sided-nphard",
        query="one sided two-layer crossing minimization NP-hard",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-3-540-45848-4-10",
            "openalex-10-1007-978-3-642-18469-7-22",
        }),
        category="crossing",
    ),
    # ---- compound / clustered ----
    EvalCase(
        id="compound-global-ranking",
        query="compound directed graph layout global ranking cluster borders",
        relevant_doc_ids=frozenset({
            "sander-compound-directed-graphs",
            "research-thread-compound",
            "s2-10-1007-978-3-540-31843-9-45",
            "forster-compound-crossing-gd2002",
        }),
        category="compound",
        pdf_only=True,
    ),
    EvalCase(
        id="compound-clustered-sugiyama",
        query="clustered Sugiyama compound graph layout",
        relevant_doc_ids=frozenset({
            "research-thread-compound",
            "sander-compound-directed-graphs",
            "openalex-10-5120-16945-7012",
            "openalex-10-1007-3-540-62495-3-41",
        }),
        category="compound",
    ),
    EvalCase(
        id="compound-elk",
        query="ELK compound graph hierarchical layout",
        relevant_doc_ids=frozenset({
            "openalex-10-48550-arxiv-2311-00533",
            "research-thread-compound",
            "sander-compound-directed-graphs",
            "openalex-10-48550-arxiv-2312-07319",
        }),
        category="compound",
    ),
    # ---- constraints ----
    EvalCase(
        id="constraints-vpsc",
        query="VPSC separation constraints IPSep-CoLa",
        relevant_doc_ids=frozenset({
            "dwyer-ipsep-cola",
            "openalex-10-1007-11618058-15",
            "research-thread-constraints",
        }),
        category="constraints",
    ),
    EvalCase(
        id="constraints-cluster-containment",
        query="separation constraints cluster containment overlap removal",
        relevant_doc_ids=frozenset({
            "graphviz-prism-overlap",
            "openalex-10-1007-11618058-15",
            "doi-10-1007-978-3-319-50106-2-3",
            "research-thread-constraints",
        }),
        category="constraints",
    ),
    EvalCase(
        id="constraints-force-overlap",
        query="force directed overlap removal separation constraints",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-11618058-15",
            "doi-10-1007-978-3-319-50106-2-3",
            "doi-10-1111-cgf-13722",
            "graphviz-prism-overlap",
            "jgaa-2721-efficient-proximity-preserving-node-overlap-removal",
        }),
        category="constraints",
    ),
    EvalCase(
        id="constraints-quadratic-programming",
        query="constrained graph layout quadratic programming",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-3-540-62495-3-50",
            "doi-10-1007-978-3-642-00219-9-22",
            "doi-10-1109-tvcg-2006-67",
            "openalex-10-1007-978-3-540-77537-9-23",
        }),
        category="constraints",
    ),
    # ---- coordinate assignment ----
    EvalCase(
        id="coordinate-brandes-koepf",
        query="Brandes Köpf horizontal coordinate assignment",
        relevant_doc_ids=frozenset({
            "brandes-koepf-horizontal-coordinate-assignment",
            "forward-10-48550-arxiv-2008-01252",
            "doi-10-1007-978-3-319-27261-0-12",
            "forward-10-1007-978-3-030-04414-5-13",
        }),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="coordinate-fast-simple",
        query="fast simple horizontal coordinate assignment",
        relevant_doc_ids=frozenset({
            "brandes-koepf-horizontal-coordinate-assignment",
            "forward-10-48550-arxiv-2008-01252",
            "doi-10-1007-978-3-319-27261-0-12",
            "forward-10-1007-978-3-030-04414-5-13",
        }),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="coordinate-blocks",
        query="horizontal coordinate assignment blocks median heuristic",
        relevant_doc_ids=frozenset({
            "brandes-koepf-horizontal-coordinate-assignment",
            "handbook-hierarchical",
            "doi-10-1007-978-3-319-27261-0-12",
        }),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="coordinate-priority",
        query="node x-coordinate assignment priority method",
        relevant_doc_ids=frozenset({
            "handbook-hierarchical",
            "brandes-koepf-horizontal-coordinate-assignment",
            "doi-10-1007-978-3-319-27261-0-12",
        }),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    # ---- packing ----
    EvalCase(
        id="packing-left-edge",
        query="left edge algorithm channel routing track assignment",
        relevant_doc_ids=frozenset({
            "doi-10-1145-800158-805069",
            "s2-10-2991-icacsei-2013-27",
            "research-thread-packing",
        }),
        category="packing",
    ),
    EvalCase(
        id="packing-skyline",
        query="skyline strip packing bottom-left heuristic",
        relevant_doc_ids=frozenset({
            "doi-10-1016-j-ejor-2011-06-022",
            "doi-10-1016-j-cor-2016-11-024",
            "research-thread-packing",
            "arxiv-1506-09145v2",
        }),
        category="packing",
        notes="Was a single-label false-failure case; corpus has dedicated skyline strip-packing papers.",
    ),
    EvalCase(
        id="packing-column-reassignment",
        query="column reassignment vertical slack cross-lane packing",
        relevant_doc_ids=frozenset({
            "research-thread-packing",
            "forward-10-1007-978-3-642-36763-2-21",
            "jgaa-2576-column-based-graph-layouts",
            "research-thread-layer-assignment",
        }),
        category="packing",
    ),
    EvalCase(
        id="packing-disconnected-polyomino",
        query="disconnected component packing polyomino layout",
        relevant_doc_ids=frozenset({
            "doi-10-1007-3-540-45848-4-30",
            "research-thread-packing",
        }),
        category="packing",
    ),
    # ---- compaction ----
    EvalCase(
        id="compaction-1d-constraint-graph",
        query="constraint graph one-dimensional compaction scanline",
        relevant_doc_ids=frozenset({
            "research-thread-compaction",
            "doi-10-1007-978-3-319-42333-3-16",
            "doi-10-1587-e76-a-4-507",
        }),
        category="compaction",
    ),
    EvalCase(
        id="compaction-longest-path",
        query="constraint graph one-dimensional compaction longest path",
        relevant_doc_ids=frozenset({
            "research-thread-compaction",
            "doi-10-1007-978-3-319-42333-3-16",
            "jgaa-2643-inapproximability-of-orthogonal-compaction",
            "arxiv-2210-05019v2",
        }),
        category="compaction",
    ),
    EvalCase(
        id="compaction-vlsi",
        query="VLSI compaction constraint graph scanline",
        relevant_doc_ids=frozenset({
            "research-thread-compaction",
            "doi-10-1587-e76-a-4-507",
            "openalex-10-1109-dac-1983-1585634",
            "arxiv-2210-05019v2",
        }),
        category="compaction",
    ),
    # ---- overlap / mental map ----
    EvalCase(
        id="overlap-mental-map",
        query="layout adjustment mental map cluster busting",
        relevant_doc_ids=frozenset({
            "research-thread-overlap",
            "doi-10-7155-jgaa-00004",
            "jgaa-2914-algorithms-for-cluster-busting-in-anchored-graph-drawing",
            "openalex-10-1006-jvlc-1995-1010",
        }),
        category="overlap",
    ),
    EvalCase(
        id="overlap-prism",
        query="PRISM proximity stress node overlap removal",
        relevant_doc_ids=frozenset({
            "graphviz-prism-overlap",
            "doi-10-1007-978-3-642-00219-9-20",
            "doi-10-1007-978-3-319-50106-2-3",
            "openalex-10-1007-11618058-15",
        }),
        category="overlap",
    ),
    EvalCase(
        id="overlap-dynamic",
        query="dynamic graph layout overlap removal mental map",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-978-3-540-70904-6-19",
            "openalex-10-1007-978-3-642-36763-2-42",
            "research-thread-overlap",
            "s2-10-1007-978-3-319-92043-6-9",
        }),
        category="overlap",
    ),
    EvalCase(
        id="overlap-node-overlap-comparison",
        query="node overlap removal algorithms comparison",
        relevant_doc_ids=frozenset({
            "doi-10-1111-cgf-13722",
            "crossref-10-1007-978-3-030-35802-0-14",
            "arxiv-2208-10334v2",
            "s2-10-1109-iv-2017-14",
        }),
        category="overlap",
    ),
    # ---- routing ----
    EvalCase(
        id="routing-orthogonal",
        query="orthogonal edge routing channel assignment VLSI",
        relevant_doc_ids=frozenset({
            "doi-10-1145-800158-805069",
            "handbook-orthogonal",
            "forward-10-5121-csit-2021-111821",
        }),
        category="routing",
    ),
    EvalCase(
        id="routing-track",
        query="track assignment channel routing graph edges",
        relevant_doc_ids=frozenset({
            "doi-10-1145-800158-805069",
            "s2-10-2991-icacsei-2013-27",
            "forward-10-5121-csit-2021-111821",
            "research-thread-packing",
        }),
        category="routing",
    ),
    EvalCase(
        id="routing-edge-bundling",
        query="edge bundling hierarchical graph visualization",
        relevant_doc_ids=frozenset({
            "doi-10-1109-tvcg-2021-3114795",
            "openalex-10-1109-tvcg-2011-233",
            "crossref-10-1007-978-3-642-18469-7-30",
            "doi-10-1109-tvcg-2011-190",
        }),
        category="routing",
    ),
    EvalCase(
        id="routing-spline-connector",
        query="spline edge routing connector avoiding nodes",
        relevant_doc_ids=frozenset({
            "graphviz-edge-router",
            "forward-10-1007-978-3-540-70904-6-3",
            "doi-10-1007-11618058-40",
            "forward-10-1007-978-3-540-77537-9-38",
        }),
        category="routing",
    ),
    # ---- ports ----
    EvalCase(
        id="ports-layered-constraints",
        query="port constraints layered layout fixed order",
        relevant_doc_ids=frozenset({
            "doi-10-1007-978-3-642-11805-0-14",
            "elk-10-1016-j-comgeo-2022-101886",
            "thesis-schulze-layered-port-constraints",
            "doi-10-1016-j-jvlc-2013-11-005",
        }),
        category="ports",
    ),
    EvalCase(
        id="ports-hyperedge-orthogonal",
        query="hyperedge orthogonal routing ports schematic",
        relevant_doc_ids=frozenset({
            "openalex-10-1007-978-3-030-86062-2-2",
            "doi-10-1007-978-3-642-31223-6-10",
            "doi-10-1007-978-3-662-45803-7-27",
            "handbook-orthogonal",
        }),
        category="ports",
    ),
    # ---- force-directed / stress ----
    EvalCase(
        id="stress-majorization",
        query="stress majorization graph drawing neato",
        relevant_doc_ids=frozenset({
            "gansner-gkn04-stress",
            "graphviz-neatoguide",
            "openalex-10-1007-11618058-14",
            "doi-10-1007-978-3-030-35802-0-23",
        }),
        category=None,
        pdf_only=True,
    ),
    EvalCase(
        id="force-fruchterman-reingold",
        query="force directed graph layout Fruchterman Reingold",
        relevant_doc_ids=frozenset({
            "handbook-force-directed",
            "arxiv-2412-20317v3",
            "s2-10-1007-978-3-658-21742-6-49",
            "arxiv-1606-02162v1",
        }),
        category=None,
        pdf_only=True,
    ),
    EvalCase(
        id="force-mds-stress",
        query="multidimensional scaling graph layout stress model",
        relevant_doc_ids=frozenset({
            "gansner-gkn04-stress",
            "arxiv-2512-21901v1",
            "arxiv-2109-11505v1",
            "doi-10-1007-978-3-030-35802-0-23",
        }),
        category=None,
        pdf_only=True,
    ),
    EvalCase(
        id="force-scalable-multilevel",
        query="scalable multilevel force directed placement large graphs",
        relevant_doc_ids=frozenset({
            "handbook-force-directed",
            "openalex-10-1007-3-540-44541-2-17",
            "openalex-10-1007-3-540-44541-2-20",
            "arxiv-1608-08522v2",
        }),
        category=None,
        pdf_only=True,
    ),
    # ---- surveys / cross-cutting ----
    EvalCase(
        id="sugiyama-hierarchical-survey",
        query="Sugiyama hierarchical graph drawing layered layout survey",
        relevant_doc_ids=frozenset({
            "doi-10-1007-978-3-540-31843-9-17",
            "handbook-hierarchical",
            "gansner-tse93",
            "graphviz-dynadag",
        }),
        category="layer-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="cycle-removal-feedback-arc-set",
        query="cycle removal feedback arc set layered layout",
        relevant_doc_ids=frozenset({
            "jgaa-2281-effective-computation-of-a-feedback-arc-set-using-pagerank",
            "jgaa-3028-improved-combinatorial-approximation-algorithms-for-feedback-arc-set-a",
            "handbook-hierarchical",
        }),
        category="layer-assignment",
    ),
    EvalCase(
        id="dot-rank-assignment-legacy",
        query="network simplex rank assignment directed graphs",
        relevant_doc_ids=frozenset({"gansner-tse93", "doi-10-1109-iccis-2013-401"}),
        category="layer-assignment",
        pdf_only=True,
        notes="Legacy eval case from original retrieval.py",
    ),
    # ---- tooling (ELK / dagre / mermaid) ----
    EvalCase(
        id="elk-kernel",
        query="Eclipse Layout Kernel ELK layered algorithm",
        relevant_doc_ids=frozenset({
            "openalex-10-48550-arxiv-2311-00533",
            "doi-10-4230-lipics-gd-2024-56",
            "elk-dagre-engine-docs",
            "elk-layout-options-reference",
        }),
        category="elk",
    ),
    EvalCase(
        id="dagre-engine",
        query="dagre directed graph layout engine internals",
        relevant_doc_ids=frozenset({
            "elk-dagre-engine-docs",
            "dagre-layout-algorithm-wiki",
            "mermaid-layouts-docs",
        }),
        category=None,
    ),
    # ---- vague / agent-style (query-transform stress tests) ----
    EvalCase(
        id="vague-layout-height",
        query="why is my graph layout vertically tall lane stacking",
        relevant_doc_ids=frozenset({
            "research-thread-layer-assignment",
            "research-thread-packing",
            "openalex-10-21941-kcss-2018-1",
            "elk-10-1007-978-3-319-50106-2-17",
        }),
        category="layer-assignment",
        notes="Exploratory / agent-style vague query for HyDE / step-back testing.",
    ),
    EvalCase(
        id="vague-compact-horizontal",
        query="how to make a hierarchical diagram more compact horizontally",
        relevant_doc_ids=frozenset({
            "doi-10-1007-3-540-45848-4-2",
            "elk-10-1007-978-3-319-50106-2-17",
            "forward-10-48550-arxiv-1609-01755",
            "doi-10-1007-978-3-319-42333-3-16",
        }),
        category="layer-assignment",
        notes="Exploratory / agent-style vague query for HyDE / step-back testing.",
    ),
)


def gold_cases() -> list[EvalCase]:
    """Return the gold cases, optionally overlaid with a judged qrels file.

    When ``GRAPH_RAG_QRELS_PATH`` is set (e.g. by ``eval benchmark --qrels``),
    the de-biased multi-system judgments are unioned into each case's relevant
    set. The env var propagates to the isolated strategy workers automatically.
    """
    import os

    cases = list(GOLD_CASES)
    qrels_path = os.getenv("GRAPH_RAG_QRELS_PATH")
    if qrels_path:
        from pathlib import Path

        from graph_layout_rag.eval.qrels import apply_qrels_overlay, load_qrels

        cases = apply_qrels_overlay(cases, load_qrels(Path(qrels_path)))
    return cases
