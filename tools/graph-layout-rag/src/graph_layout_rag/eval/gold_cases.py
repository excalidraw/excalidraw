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


GOLD_CASES: tuple[EvalCase, ...] = (
    EvalCase(
        id="layer-assignment-network-simplex",
        query="network simplex rank assignment layered digraph",
        relevant_doc_ids=frozenset({"gansner-tse93", "handbook-hierarchical"}),
        category="layer-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="layer-assignment-alap",
        query="ALAP as-late-as-possible layer reassignment",
        relevant_doc_ids=frozenset({"research-thread-layer-assignment", "doi-10-1007-3-540-45848-4-2"}),
        category="layer-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="layer-assignment-min-width",
        query="minimum width layering dummy nodes",
        relevant_doc_ids=frozenset({"kiel-minimum-width-layering"}),
        category="layer-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="crossing-sifting",
        query="sifting crossing minimization layered graph",
        relevant_doc_ids=frozenset({"matuszewski-sifting-crossing-minimization"}),
        category="crossing",
        pdf_only=True,
    ),
    EvalCase(
        id="crossing-k-layer",
        query="sifting k-layer straightline crossing minimization",
        relevant_doc_ids=frozenset({"matuszewski-sifting-crossing-minimization"}),
        category="crossing",
        pdf_only=True,
    ),
    EvalCase(
        id="crossing-heuristics",
        query="crossing minimization heuristics layered drawing",
        relevant_doc_ids=frozenset({"matuszewski-sifting-crossing-minimization", "handbook-crossings"}),
        category="crossing",
        pdf_only=True,
    ),
    EvalCase(
        id="compound-global-ranking",
        query="compound directed graph layout global ranking cluster borders",
        relevant_doc_ids=frozenset({"sander-compound-directed-graphs", "research-thread-compound"}),
        category="compound",
        pdf_only=True,
    ),
    EvalCase(
        id="compound-clustered-sugiyama",
        query="clustered Sugiyama compound graph layout",
        relevant_doc_ids=frozenset({"sander-compound-directed-graphs", "research-thread-compound"}),
        category="compound",
        pdf_only=True,
    ),
    EvalCase(
        id="compound-elk",
        query="ELK compound graph hierarchical layout",
        relevant_doc_ids=frozenset({"research-thread-compound", "sander-compound-directed-graphs"}),
        category="compound",
        pdf_only=True,
    ),
    EvalCase(
        id="constraints-vpsc",
        query="VPSC separation constraints IPSep-CoLa",
        relevant_doc_ids=frozenset({"dwyer-ipsep-cola", "doi-10-1109-tvcg-2006-156"}),
        category="constraints",
        pdf_only=True,
    ),
    EvalCase(
        id="constraints-cluster-containment",
        query="separation constraints cluster containment overlap removal",
        relevant_doc_ids=frozenset({"dwyer-ipsep-cola", "graphviz-prism-overlap"}),
        category="constraints",
        pdf_only=True,
    ),
    EvalCase(
        id="constraints-force-overlap",
        query="force directed overlap removal separation constraints",
        relevant_doc_ids=frozenset({"dwyer-ipsep-cola", "graphviz-prism-overlap"}),
        category="constraints",
        pdf_only=True,
    ),
    EvalCase(
        id="coordinate-brandes-koepf",
        query="Brandes Köpf horizontal coordinate assignment",
        relevant_doc_ids=frozenset({"brandes-koepf-horizontal-coordinate-assignment"}),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="coordinate-fast-simple",
        query="fast simple horizontal coordinate assignment",
        relevant_doc_ids=frozenset({"brandes-koepf-horizontal-coordinate-assignment"}),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="coordinate-blocks",
        query="horizontal coordinate assignment blocks median heuristic",
        relevant_doc_ids=frozenset({"brandes-koepf-horizontal-coordinate-assignment", "handbook-hierarchical"}),
        category="coordinate-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="packing-left-edge",
        query="left edge algorithm channel routing track assignment",
        relevant_doc_ids=frozenset({"doi-10-1145-800158-805069", "research-thread-packing"}),
        category="packing",
        pdf_only=True,
    ),
    EvalCase(
        id="packing-skyline",
        query="skyline strip packing bottom-left heuristic",
        relevant_doc_ids=frozenset({"research-thread-packing", "arxiv-1506-09145v2"}),
        category="packing",
        pdf_only=True,
    ),
    EvalCase(
        id="packing-column-reassignment",
        query="column reassignment vertical slack cross-lane packing",
        relevant_doc_ids=frozenset({"research-thread-packing", "research-thread-layer-assignment"}),
        category="packing",
        pdf_only=True,
    ),
    EvalCase(
        id="compaction-1d-constraint-graph",
        query="constraint graph one-dimensional compaction scanline",
        relevant_doc_ids=frozenset({"research-thread-compaction", "doi-10-1587-e76-a-4-507"}),
        category="compaction",
        pdf_only=True,
    ),
    EvalCase(
        id="compaction-longest-path",
        query="constraint graph one-dimensional compaction longest path",
        relevant_doc_ids=frozenset({"research-thread-compaction", "doi-10-1007-978-3-319-42333-3-16"}),
        category="compaction",
        pdf_only=True,
    ),
    EvalCase(
        id="compaction-vlsi",
        query="VLSI compaction constraint graph scanline",
        relevant_doc_ids=frozenset({"research-thread-compaction", "doi-10-1587-e76-a-4-507"}),
        category="compaction",
        pdf_only=True,
    ),
    EvalCase(
        id="overlap-mental-map",
        query="layout adjustment mental map cluster busting",
        relevant_doc_ids=frozenset({"research-thread-overlap", "doi-10-7155-jgaa-00004"}),
        category="overlap",
        pdf_only=True,
    ),
    EvalCase(
        id="overlap-prism",
        query="PRISM overlap removal layout adjustment",
        relevant_doc_ids=frozenset({"graphviz-prism-overlap", "research-thread-overlap"}),
        category="overlap",
        pdf_only=True,
    ),
    EvalCase(
        id="overlap-dynamic",
        query="dynamic graph layout overlap removal mental map",
        relevant_doc_ids=frozenset({"research-thread-overlap", "doi-10-7155-jgaa-00004"}),
        category="overlap",
        pdf_only=True,
    ),
    EvalCase(
        id="routing-orthogonal",
        query="orthogonal edge routing channel assignment VLSI",
        relevant_doc_ids=frozenset({"doi-10-1145-800158-805069", "crossref-10-1109-dac-1981-1585439"}),
        category="routing",
        pdf_only=True,
    ),
    EvalCase(
        id="routing-track",
        query="track assignment channel routing graph edges",
        relevant_doc_ids=frozenset({"doi-10-1145-800158-805069", "research-thread-packing"}),
        category="routing",
        pdf_only=True,
    ),
    EvalCase(
        id="stress-majorization",
        query="stress majorization graph drawing neato",
        relevant_doc_ids=frozenset({"gansner-gkn04-stress"}),
        category=None,
        pdf_only=True,
    ),
    EvalCase(
        id="dot-rank-assignment-legacy",
        query="network simplex rank assignment directed graphs",
        relevant_doc_ids=frozenset({"gansner-tse93"}),
        category="layer-assignment",
        pdf_only=True,
        notes="Legacy eval case from original retrieval.py",
    ),
    EvalCase(
        id="sugiyama-hierarchical-survey",
        query="Sugiyama hierarchical graph drawing layered layout survey",
        relevant_doc_ids=frozenset({"handbook-hierarchical", "gansner-tse93"}),
        category="layer-assignment",
        pdf_only=True,
    ),
    EvalCase(
        id="vague-layout-height",
        query="why is my graph layout vertically tall lane stacking",
        relevant_doc_ids=frozenset({"research-thread-layer-assignment", "research-thread-packing"}),
        category="layer-assignment",
        pdf_only=False,
        notes="Exploratory / agent-style vague query for HyDE testing",
    ),
)


def gold_cases() -> list[EvalCase]:
    return list(GOLD_CASES)
