"""Per-document citation-relatedness vectors (SciNCL / SPECTER2) in LanceDB.

A doc-level companion to the chunk index: one vector per manifest item (including the ~54%
metadata-only papers that have a title + abstract but no PDF), built by `paper_embed` and
stored in a small per-model LanceDB table. Powers `find related papers` by cosine kNN, and
feeds an optional embedding signal into the citation-graph relatedness ranker.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import lancedb

from rag_literature_rag.ingest.index import _table_names
from rag_literature_rag.ingest.log import get_logger
from rag_literature_rag.manifest import load_manifest
from rag_literature_rag.paper_embed import embed_papers, model_spec, paper_text
from rag_literature_rag.paths import DOC_VECTORS_TABLE, related_lance_dir


def _connect(model: str) -> lancedb.DBConnection:
    lance_dir = related_lance_dir(model)
    lance_dir.mkdir(parents=True, exist_ok=True)
    return lancedb.connect(str(lance_dir))


def build_doc_vectors(model: str, *, rebuild: bool = False, batch_size: int = 16) -> int:
    """Embed title+abstract for every manifest item and (re)write the doc-vector table.

    All items with a title are embedded — metadata-only ones included, which is the whole
    point: they get a relatedness vector even without a PDF or rich citation edges.
    """
    spec = model_spec(model)
    log = get_logger()
    sep_token = _sep_token(model)

    items = [it for it in load_manifest().items if (it.title or "").strip()]
    if not items:
        return 0
    texts = [paper_text(it.title, it.abstract, sep=sep_token) for it in items]
    log.info("doc-vectors: embedding %d papers with %s (%s)", len(items), model, spec.hf_model)
    vectors = embed_papers(texts, model=model, batch_size=batch_size)

    rows = [
        {"id": it.id, "doc_id": it.id, "title": it.title, "vector": vec}
        for it, vec in zip(items, vectors)
    ]
    db = _connect(model)
    tables = _table_names(db)
    if rebuild and DOC_VECTORS_TABLE in tables:
        db.drop_table(DOC_VECTORS_TABLE)
        tables = _table_names(db)
    if DOC_VECTORS_TABLE not in tables:
        db.create_table(DOC_VECTORS_TABLE, data=rows)
    else:
        table = db.open_table(DOC_VECTORS_TABLE)
        for it in items:
            table.delete(f"doc_id = '{it.id.replace(chr(39), chr(39) * 2)}'")
        table.add(rows)
    _vector_cache.cache_clear()
    log.info("doc-vectors: wrote %d rows for %s", len(rows), model)
    return len(rows)


def _sep_token(model: str) -> str:
    """The tokenizer's SEP token (loading is cached); BERT-family default is ``[SEP]``."""
    try:
        from rag_literature_rag.paper_embed import _load

        tokenizer, _ = _load(model)
        return tokenizer.sep_token or "[SEP]"
    except Exception:
        return "[SEP]"


def has_doc_vectors(model: str) -> bool:
    lance_dir = related_lance_dir(model)
    if not lance_dir.exists():
        return False
    db = lancedb.connect(str(lance_dir))
    return DOC_VECTORS_TABLE in _table_names(db)


@lru_cache(maxsize=2)
def _vector_cache(model: str) -> dict[str, list[float]]:
    if not has_doc_vectors(model):
        return {}
    db = lancedb.connect(str(related_lance_dir(model)))
    table = db.open_table(DOC_VECTORS_TABLE)
    return {row["doc_id"]: row["vector"] for row in table.to_arrow().to_pylist()}


def load_all_vectors(model: str) -> dict[str, list[float]]:
    return _vector_cache(model)


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def related_by_embedding(model: str, doc_id: str, *, top: int = 20) -> list[dict[str, Any]]:
    """Cosine-nearest papers to ``doc_id`` in the citation-trained vector space."""
    vectors = load_all_vectors(model)
    seed = vectors.get(doc_id)
    if seed is None:
        return []
    scored = [
        {"doc_id": cand, "score": round(_dot(seed, vec), 6)}
        for cand, vec in vectors.items()
        if cand != doc_id
    ]
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored[:top]


def embedding_scores(
    model: str, seed_doc_ids: list[str], candidate_doc_ids: list[str] | None = None
) -> dict[str, float]:
    """Mean cosine of each candidate to the seed set (vectors are L2-normalized → dot).

    Returned scores are min-max normalized to [0, 1] so they fuse cleanly with the graph
    signals in `rank_related`.
    """
    vectors = load_all_vectors(model)
    seeds = [vectors[d] for d in seed_doc_ids if d in vectors]
    if not seeds:
        return {}
    candidates = candidate_doc_ids if candidate_doc_ids is not None else list(vectors)
    raw: dict[str, float] = {}
    for cand in candidates:
        vec = vectors.get(cand)
        if vec is None or cand in seed_doc_ids:
            continue
        raw[cand] = sum(_dot(s, vec) for s in seeds) / len(seeds)
    if not raw:
        return {}
    lo, hi = min(raw.values()), max(raw.values())
    span = (hi - lo) or 1.0
    return {d: (v - lo) / span for d, v in raw.items()}
