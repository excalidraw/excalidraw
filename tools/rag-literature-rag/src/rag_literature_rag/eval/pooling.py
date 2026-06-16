"""Multi-system pooling for de-biased relevance judging.

Builds a *diverse* candidate pool per gold case by unioning the top-k of several
retrievers (lexical, dense, hybrid, query-expansion, learned-sparse,
late-interaction), deduped on canonical document id. Judging this union — rather
than a single lexical system's output — removes the pooling bias that favored
BM25 in the original gold set (Buckley & Voorhees, *Bias and the Limits of
Pooling*; Lin et al. 2022).

Each pooled doc records which systems surfaced it and at what rank, so the
diagnostics step can show that the dense/ColBERT-only documents — the ones the
lexical-only pool missed — are now in the judged set.

The curated gold relevant docs are also folded into the pool (tagged
``curated``) so the judge grades them too; comparing the judge's grade on those
known-relevant docs is a free check on judge quality.
"""
from __future__ import annotations

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rag_literature_rag.eval.gold_validation import EVAL_TRACKS, EvalTrack, cases_for_track
from rag_literature_rag.eval.strategies import strategy_registry
from rag_literature_rag.manifest import load_manifest, manifest_by_id
from rag_literature_rag.paths import DATA_DIR

log = logging.getLogger("rag_literature_rag.eval.pooling")

# Diverse-by-construction: lexical, dense, hybrid fusion, LLM query expansion,
# learned-sparse, late-interaction. The point is to surface docs no single
# retrieval family would, especially the neural-only docs the BM25 pool missed.
DEFAULT_POOL_SYSTEMS: tuple[str, ...] = (
    "bm25",
    "dense",
    "hybrid",
    "hyde",
    "multi_query",
    "splade",
    "colbert",
)

# Which experimental index kind each strategy name consumes.
_EXPERIMENTAL_KIND = {"splade": "splade", "dense_splade": "splade", "colbert": "colbert"}

POOL_DIR = DATA_DIR / "eval" / "pool"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _pool_workers() -> int:
    """Concurrent cases to pool at once (RAG_LIT_POOL_WORKERS, default 8).

    The per-query embed/transform calls are issued one-at-a-time *within* a case, so
    the serial loop wastes the available rate-limit budget. Pooling cases concurrently
    is the real speedup (the rate limiter caps total throughput, not request issuance).
    """
    raw = os.getenv("RAG_LIT_POOL_WORKERS", "8").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 8


def _manifest_lookup() -> dict[str, Any]:
    return manifest_by_id(load_manifest())


def build_pool(
    track: EvalTrack,
    *,
    systems: list[str] | None = None,
    depth: int = 50,
    embed_profile: str,
    experimental_indexes: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Run each system at ``depth`` per case, union+dedupe, enrich for judging.

    ``experimental_indexes`` maps an index *kind* ("splade"/"colbert") to its
    built index directory. Requires a Docker Qdrant server
    (``RAG_LIT_QDRANT_URL``) for the late-interaction arm to avoid OOM.
    """
    if track not in EVAL_TRACKS:
        raise ValueError(f"Unknown eval track {track!r}")
    systems = systems or list(DEFAULT_POOL_SYSTEMS)
    experimental_indexes = experimental_indexes or {}
    registry = strategy_registry()
    by_id = _manifest_lookup()
    cases = cases_for_track(track)

    # Resolve which systems can actually run (experimental ones need an index dir).
    active: list[str] = []
    for name in systems:
        if name not in registry:
            raise ValueError(f"Unknown pool system {name!r}")
        kind = _EXPERIMENTAL_KIND.get(name)
        if kind and kind not in experimental_indexes:
            log.warning("skipping %s: no %s index dir provided", name, kind)
            continue
        active.append(name)

    def _pool_one(case: Any) -> tuple[str, dict[str, Any]]:
        pooled: dict[str, dict[str, Any]] = {}

        def _record(row: dict[str, Any], system: str, rank: int) -> None:
            canonical = row.get("canonical_doc_id") or row.get("doc_id") or ""
            if not canonical:
                return
            entry = pooled.setdefault(
                canonical,
                {
                    "canonical_doc_id": canonical,
                    "doc_id": row.get("doc_id"),
                    "title": row.get("title"),
                    "excerpt": row.get("excerpt"),
                    "source_url": row.get("source_url"),
                    "systems": {},
                    "curated": False,
                },
            )
            # Keep the best (lowest) rank each system gave the doc.
            prev = entry["systems"].get(system)
            entry["systems"][system] = rank if prev is None else min(prev, rank)
            if not entry.get("excerpt") and row.get("excerpt"):
                entry["excerpt"] = row["excerpt"]

        for name in active:
            strategy = registry[name]
            kind = _EXPERIMENTAL_KIND.get(name)
            if kind:
                os.environ["RAG_LIT_EXPERIMENTAL_INDEX"] = experimental_indexes[kind]
            try:
                rows = strategy.run(case, embed_profile=embed_profile, top=depth)
            except Exception as exc:  # noqa: BLE001 — one system failing shouldn't void the pool
                log.warning("pool system %s failed on %s: %s", name, case.id, exc)
                continue
            for rank, row in enumerate(rows, start=1):
                _record(row, name, rank)

        # Fold curated gold labels into the pool so the judge grades them too.
        for doc_id in case.relevant_doc_ids:
            canonical = doc_id
            entry = pooled.get(canonical)
            if entry is None:
                item = by_id.get(doc_id)
                entry = pooled.setdefault(
                    canonical,
                    {
                        "canonical_doc_id": canonical,
                        "doc_id": doc_id,
                        "title": item.title if item else None,
                        "excerpt": None,
                        "source_url": item.url if item else None,
                        "systems": {},
                        "curated": True,
                    },
                )
            entry["curated"] = True

        # Enrich every pooled doc with manifest title/abstract for the judge.
        for entry in pooled.values():
            item = by_id.get(entry["canonical_doc_id"]) or by_id.get(entry.get("doc_id") or "")
            if item:
                entry.setdefault("title", item.title)
                entry["title"] = entry.get("title") or item.title
                entry["abstract"] = item.abstract
                entry["year"] = item.year
                entry["doc_kind"] = item.documentKind
            else:
                entry["abstract"] = None

        log.info("pooled %s: %d candidates from %d systems", case.id, len(pooled), len(active))
        return case.id, {
            "query": case.query,
            "category": case.category,
            "pdf_only": case.pdf_only,
            "curated_relevant": sorted(case.relevant_doc_ids),
            "pooled": pooled,
        }

    # Pool cases concurrently — each case is independent (its `pooled` dict is local)
    # and the embed client + shared GeminiRateLimiter are thread-safe (the judge uses
    # the same pattern). This removes the one-request-at-a-time serial bottleneck; the
    # rate limiter, not request issuance, becomes the real ceiling. Experimental indexes
    # mutate a process-global env var, so fall back to serial when any are active.
    workers = _pool_workers()
    if experimental_indexes:
        workers = 1
    case_pools: dict[str, Any] = {}
    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as pool_exec:
            for case_id, case_dict in pool_exec.map(_pool_one, cases):
                case_pools[case_id] = case_dict
    else:
        for case in cases:
            case_id, case_dict = _pool_one(case)
            case_pools[case_id] = case_dict

    return {
        "version": 1,
        "generated_at": _now_iso(),
        "track": track,
        "depth": depth,
        "embed_profile": embed_profile,
        "systems": active,
        "case_count": len(cases),
        "cases": case_pools,
    }


def pool_path(track: EvalTrack) -> Path:
    return POOL_DIR / track / "pool.json"


def write_pool(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def pool_stats(payload: dict[str, Any]) -> dict[str, Any]:
    """Summary stats: total candidates, mean per case, and neural-only count.

    A 'neural-only' doc is one no lexical system (bm25/splade text-overlap) ranked
    but a dense/late-interaction system did — exactly the docs a BM25-only pool
    would have missed.
    """
    lexical = {"bm25", "splade"}
    total = 0
    neural_only = 0
    curated_outside_lexical = 0
    per_case: list[int] = []
    for case in payload["cases"].values():
        pooled = case["pooled"]
        per_case.append(len(pooled))
        total += len(pooled)
        for entry in pooled.values():
            surfacing = set(entry["systems"])
            if surfacing and not (surfacing & lexical):
                neural_only += 1
            if entry.get("curated") and surfacing and not (surfacing & lexical):
                curated_outside_lexical += 1
    return {
        "total_candidates": total,
        "mean_candidates_per_case": round(total / max(1, len(per_case)), 1),
        "neural_only_candidates": neural_only,
        "curated_docs_no_lexical_system": curated_outside_lexical,
    }
