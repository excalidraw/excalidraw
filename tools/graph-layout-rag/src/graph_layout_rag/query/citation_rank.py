"""Relatedness ranking over the persisted citation graph.

Three classic signals, fused:
  * **bibliographic coupling** — share outgoing references (forward-looking, time-stable)
  * **co-citation** — get cited together by later work (backward-looking)
  * **personalized PageRank** — random walk with restart on the seeds (whole-neighborhood
    relatedness that generalizes the two 1-hop measures)
plus a log citation-count prior with an influential-edge boost.

The graph is loaded once into in-memory adjacency. PPR runs on the subgraph induced by the
seeds, the candidates, and their neighbors, so it stays fast at query time regardless of
total corpus size.
"""

from __future__ import annotations

import math
import sqlite3
from collections import defaultdict, deque
from dataclasses import dataclass, field

from graph_layout_rag import citation_store as cs


@dataclass
class CitationGraph:
    out_adj: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))  # references
    in_adj: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))   # cited-by
    undirected: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))
    cbc: dict[str, int] = field(default_factory=dict)
    oa_to_doc: dict[str, str] = field(default_factory=dict)
    doc_to_oa: dict[str, str] = field(default_factory=dict)

    def has_edge(self, src: str, dst: str) -> bool:
        return dst in self.out_adj.get(src, ())

    def remove_edge(self, src: str, dst: str) -> bool:
        """Drop a citation edge from all three adjacencies. Returns whether it existed.

        Used by the leave-one-out eval to hide a known citation before prediction. The
        undirected entry is only cleared when no edge remains in either direction.
        """
        if dst not in self.out_adj.get(src, ()):
            return False
        self.out_adj[src].discard(dst)
        self.in_adj[dst].discard(src)
        if src not in self.out_adj.get(dst, ()) and dst not in self.out_adj.get(src, ()):
            self.undirected[src].discard(dst)
            self.undirected[dst].discard(src)
        return True

    def add_edge(self, src: str, dst: str) -> None:
        """Restore a citation edge (inverse of remove_edge)."""
        self.out_adj[src].add(dst)
        self.in_adj[dst].add(src)
        self.undirected[src].add(dst)
        self.undirected[dst].add(src)

    def adjacency(self, direction: str) -> dict[str, set[str]]:
        """Pick the adjacency for a walk direction.

        ``forward`` follows references (out-edges) — generalized bibliographic coupling;
        ``backward`` follows citers (in-edges) — generalized co-citation; ``undirected``
        is the symmetric union (the original behaviour).
        """
        if direction == "forward":
            return self.out_adj
        if direction == "backward":
            return self.in_adj
        return self.undirected

    def neighbors_within(
        self, seeds: set[str], radius: int, max_nodes: int, *, direction: str = "undirected"
    ) -> set[str]:
        adj = self.adjacency(direction)
        seen: set[str] = set(seeds)
        frontier: deque[tuple[str, int]] = deque((s, 0) for s in seeds)
        while frontier and len(seen) < max_nodes:
            node, depth = frontier.popleft()
            if depth >= radius:
                continue
            for nb in adj.get(node, ()):  # type: ignore[arg-type]
                if nb not in seen:
                    seen.add(nb)
                    frontier.append((nb, depth + 1))
                    if len(seen) >= max_nodes:
                        break
        return seen


_GRAPH_CACHE: dict[str, object] = {}


def load_graph_cached() -> CitationGraph | None:
    """Load the corpus graph once, reusing it across benchmark cases. None if no store yet.

    Cached by the citation DB's mtime so a re-enrichment is picked up without a restart.
    """
    from graph_layout_rag.paths import CITATIONS_DB_PATH

    if not CITATIONS_DB_PATH.exists():
        return None
    mtime = CITATIONS_DB_PATH.stat().st_mtime
    if _GRAPH_CACHE.get("mtime") == mtime and "graph" in _GRAPH_CACHE:
        return _GRAPH_CACHE["graph"]  # type: ignore[return-value]
    db = cs.connect()
    try:
        graph = load_graph(db)
    finally:
        db.close()
    _GRAPH_CACHE["mtime"] = mtime
    _GRAPH_CACHE["graph"] = graph
    return graph


def load_graph(db: sqlite3.Connection) -> CitationGraph:
    g = CitationGraph()
    for src, dst in db.execute("SELECT src_oa, dst_oa FROM cites"):
        g.out_adj[src].add(dst)
        g.in_adj[dst].add(src)
        g.undirected[src].add(dst)
        g.undirected[dst].add(src)
    for oa, doc, cbc in db.execute("SELECT oa_id, doc_id, cited_by_count FROM papers"):
        g.cbc[oa] = int(cbc or 0)
        if doc:
            g.oa_to_doc[oa] = doc
            g.doc_to_oa.setdefault(doc, oa)
    return g


def _idf(g: CitationGraph, node: str) -> float:
    """Rare shared neighbors are more informative. Degree = how many papers touch `node`."""
    deg = len(g.undirected.get(node, ()))  # type: ignore[arg-type]
    return 1.0 / math.log2(2.0 + deg)


def bibliographic_coupling(g: CitationGraph, seed_refs: set[str], cand: str) -> float:
    shared = seed_refs & g.out_adj.get(cand, set())
    return sum(_idf(g, r) for r in shared)


def co_citation(g: CitationGraph, seed_citers: set[str], cand: str) -> float:
    shared = seed_citers & g.in_adj.get(cand, set())
    return sum(_idf(g, c) for c in shared)


def personalized_pagerank(
    g: CitationGraph,
    seeds: set[str],
    *,
    direction: str = "undirected",
    restart: float = 0.15,
    iters: int = 40,
    radius: int = 2,
    max_nodes: int = 30000,
    tol: float = 1e-7,
) -> dict[str, float]:
    """Random walk with restart on the seeds over the citation subgraph.

    ``direction`` selects the adjacency: ``undirected`` (default, symmetric union),
    ``forward`` (references — generalized bibliographic coupling), or ``backward``
    (citers — generalized co-citation). The node-split result (arXiv:2110.15513) shows the
    directed walks recover high-similarity links the undirected blend conflates.
    """
    seeds = {s for s in seeds if s in g.undirected or s in g.out_adj or s in g.in_adj}
    if not seeds:
        return {}
    walk_adj = g.adjacency(direction)
    nodes = g.neighbors_within(seeds, radius=radius, max_nodes=max_nodes, direction=direction)
    adj = {n: [m for m in walk_adj.get(n, ()) if m in nodes] for n in nodes}  # type: ignore[arg-type]
    teleport = 1.0 / len(seeds)
    rank = {n: (teleport if n in seeds else 0.0) for n in nodes}
    for _ in range(iters):
        nxt = {n: 0.0 for n in nodes}
        dangling = 0.0
        for n, score in rank.items():
            deg = len(adj[n])
            if deg == 0:
                dangling += score
                continue
            share = score / deg
            for m in adj[n]:
                nxt[m] += share
        # restart + redistribute dangling mass to the seed set
        delta = 0.0
        for n in nodes:
            walked = (1.0 - restart) * (nxt[n] + (dangling * teleport if n in seeds else 0.0))
            tele = restart * (teleport if n in seeds else 0.0)
            val = walked + tele
            delta += abs(val - rank[n])
            nxt[n] = val
        rank = nxt
        if delta < tol:
            break
    return rank


def citation_prior(g: CitationGraph, oa: str) -> float:
    return math.log1p(g.cbc.get(oa, 0))


@dataclass
class RelatedResult:
    doc_id: str
    oa_id: str
    score: float
    ppr: float
    coupling: float
    cocitation: float
    prior: float
    shared_refs: int
    shared_citations: int
    ppr_fwd: float = 0.0
    ppr_bwd: float = 0.0
    embedding: float = 0.0


def _normalized_ppr(g: CitationGraph, seed_oas: set[str], direction: str) -> dict[str, float]:
    ppr = personalized_pagerank(g, seed_oas, direction=direction)
    peak = max(ppr.values()) if ppr else 1.0
    peak = peak or 1.0
    return {n: v / peak for n, v in ppr.items()}


def rank_related(
    g: CitationGraph,
    seed_oas: set[str],
    candidate_oas: set[str],
    *,
    w_ppr: float = 1.0,
    w_ppr_fwd: float = 0.0,
    w_ppr_bwd: float = 0.0,
    w_coupling: float = 0.6,
    w_cocitation: float = 0.4,
    w_prior: float = 0.05,
    w_embedding: float = 0.0,
    embed_scores: dict[str, float] | None = None,
) -> list[RelatedResult]:
    """Score candidate OA nodes by relatedness to the seeds. Seeds are excluded.

    PPR can be drawn from the undirected walk (``w_ppr``) and/or the directed walks
    (``w_ppr_fwd`` over references, ``w_ppr_bwd`` over citers); directed walks are only
    computed when their weight is non-zero. ``embed_scores`` is an optional per-oa cosine
    signal (e.g. SciNCL/SPECTER2) fused with weight ``w_embedding``.
    """
    seed_refs: set[str] = set()
    seed_citers: set[str] = set()
    for s in seed_oas:
        seed_refs |= g.out_adj.get(s, set())
        seed_citers |= g.in_adj.get(s, set())

    ppr = _normalized_ppr(g, seed_oas, "undirected") if w_ppr else {}
    ppr_fwd = _normalized_ppr(g, seed_oas, "forward") if w_ppr_fwd else {}
    ppr_bwd = _normalized_ppr(g, seed_oas, "backward") if w_ppr_bwd else {}
    embed_scores = embed_scores or {}

    results: list[RelatedResult] = []
    for cand in candidate_oas:
        if cand in seed_oas:
            continue
        coup = bibliographic_coupling(g, seed_refs, cand)
        coci = co_citation(g, seed_citers, cand)
        pr = ppr.get(cand, 0.0)
        prf = ppr_fwd.get(cand, 0.0)
        prb = ppr_bwd.get(cand, 0.0)
        prior = citation_prior(g, cand)
        emb = embed_scores.get(cand, 0.0)
        score = (
            w_ppr * pr
            + w_ppr_fwd * prf
            + w_ppr_bwd * prb
            + w_coupling * coup
            + w_cocitation * coci
            + w_prior * prior
            + w_embedding * emb
        )
        if score <= 0.0:
            continue
        results.append(RelatedResult(
            doc_id=g.oa_to_doc.get(cand, ""),
            oa_id=cand,
            score=score, ppr=pr, coupling=coup, cocitation=coci, prior=prior,
            ppr_fwd=prf, ppr_bwd=prb, embedding=emb,
            shared_refs=len(seed_refs & g.out_adj.get(cand, set())),
            shared_citations=len(seed_citers & g.in_adj.get(cand, set())),
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return results


def related_to_docs(
    db: sqlite3.Connection,
    seed_doc_ids: list[str],
    *,
    top: int = 20,
    corpus_only: bool = True,
    graph: CitationGraph | None = None,
    weights: dict[str, float] | None = None,
    embed_scores_by_doc: dict[str, float] | None = None,
) -> list[RelatedResult]:
    """High-level: related papers to a set of seed doc_ids (for `cite related`).

    ``weights`` overrides the default `rank_related` signal weights; ``embed_scores_by_doc``
    supplies a per-doc cosine signal (SciNCL/SPECTER2) which is mapped into oa-id space.
    """
    from graph_layout_rag.query.identity import canonical_identity_map

    g = graph or load_graph(db)
    identities = canonical_identity_map()
    seed_candidates = {
        candidate
        for doc_id in seed_doc_ids
        for candidate in identities.component_doc_ids(doc_id)
    }
    seed_oas = {g.doc_to_oa[d] for d in seed_candidates if d in g.doc_to_oa}
    if not seed_oas:
        return []
    if corpus_only:
        candidates = set(g.oa_to_doc)  # all corpus OA nodes
    else:
        candidates = set(g.undirected)  # type: ignore[arg-type]
    embed_scores = None
    if embed_scores_by_doc:
        embed_scores = {
            g.doc_to_oa[d]: s for d, s in embed_scores_by_doc.items() if d in g.doc_to_oa
        }
    ranked = rank_related(g, seed_oas, candidates, embed_scores=embed_scores, **(weights or {}))
    if corpus_only:
        ranked = [r for r in ranked if r.doc_id]

    canonical_seed_ids = {
        identities.canonicalize_doc_id(doc_id)
        for doc_id in seed_doc_ids
    }
    deduplicated: list[RelatedResult] = []
    seen: set[str] = set()
    for result in ranked:
        canonical_doc_id = identities.canonicalize_doc_id(result.doc_id)
        if canonical_doc_id in canonical_seed_ids or canonical_doc_id in seen:
            continue
        result.doc_id = canonical_doc_id
        deduplicated.append(result)
        seen.add(canonical_doc_id)
        if len(deduplicated) >= top:
            break
    return deduplicated


def citation_doc_ranking(
    db: sqlite3.Connection,
    seed_doc_ids: list[str],
    candidate_doc_ids: list[str],
    *,
    graph: CitationGraph | None = None,
) -> dict[str, float]:
    """Relatedness score per candidate doc_id, for fusing into the text ranking.

    Candidates that the citation graph can't place get 0 (RRF then leaves them to text).
    """
    g = graph or load_graph(db)
    seed_oas = {g.doc_to_oa[d] for d in seed_doc_ids if d in g.doc_to_oa}
    cand_oas = {g.doc_to_oa[d] for d in candidate_doc_ids if d in g.doc_to_oa}
    if not seed_oas or not cand_oas:
        return {}
    ranked = rank_related(g, seed_oas, cand_oas)
    return {r.doc_id: r.score for r in ranked if r.doc_id}
