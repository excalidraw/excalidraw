"""Citation-graph enrichment: persist the edges the harvest already touches.

For every corpus paper with a DOI, fetch its OpenAlex record (references out, citations
in, citation count, authors) and write nodes + edges into `citations.sqlite`. Optionally
overlay Semantic Scholar's `isInfluential` flag on the edges. Idempotent: re-running skips
papers already enriched unless ``force`` is set.

Reuses the existing OpenAlex client (`harvest/openalex._fetch_by_doi`), the throttled
thread pool (`harvest/parallel.parallel_map`), and the manifest loader. SQLite writes run
on the main thread; only the network fetches are parallel.
"""

from __future__ import annotations

from datetime import datetime, timezone

from rag_literature_rag import citation_store as cs
from rag_literature_rag.harvest.log import get_logger
from rag_literature_rag.harvest.openalex import _fetch_by_doi
from rag_literature_rag.harvest.parallel import parallel_map, streaming_parallel_map
from rag_literature_rag.harvest.providers import (
    SEMANTIC_SCHOLAR,
    OutcomeKind,
    RequestOutcome,
    log_provider_summaries,
)
from rag_literature_rag.manifest import load_manifest

# OpenAlex meters filter/search queries (the `cites:` form returns 429 "insufficient
# budget" for anonymous callers) but the direct entity GET `works/doi:{doi}` is free and
# already carries referenced_works + cited_by_count + authorships. `mailto` as a *query
# param* is what puts us in the polite pool (it is ignored in the User-Agent).
S2_BATCH_API = "https://api.semanticscholar.org/graph/v1/paper/batch"
S2_GRAPH_API = "https://api.semanticscholar.org/graph/v1"
_S2_PAGE = 1000  # max page size the citations endpoint accepts
_S2_INCOMING_WORKERS = 32


def _citer_node_id(doi: str | None, paper_id: str | None, corpus_oa_by_doi: dict[str, str]) -> str | None:
    """Stable node id for an external citer.

    A citer that is itself a corpus paper reuses the corpus OpenAlex id (so co-citation
    dedups against the OpenAlex edges). Otherwise we synthesize a stable id from the DOI,
    falling back to the S2 paper id. Co-citation only needs the *same* citer to land on the
    *same* id across the papers it cites — these synthetic ids satisfy that.
    """
    if doi and doi in corpus_oa_by_doi:
        return corpus_oa_by_doi[doi]
    if doi:
        return f"doi:{doi}"
    if paper_id:
        return f"s2:{paper_id}"
    return None


def _fetch_work_by_doi(doi: str) -> dict | None:
    return _fetch_by_doi(doi)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_record(spec: dict) -> dict | None:
    work = _fetch_work_by_doi(spec["doi"])
    if not work:
        return None
    oa_id = cs.normalize_oa_id(work.get("id"))
    if not oa_id:
        return None
    refs = [r for r in (cs.normalize_oa_id(x) for x in work.get("referenced_works") or []) if r]
    # OpenAlex gives us outgoing references + counts for free. Incoming citations (the other
    # half of co-citation) come from Semantic Scholar in `_s2_incoming_pass`, because
    # OpenAlex meters its `cites:` filter ($0 budget for anonymous callers).
    return {
        "doc_id": spec["doc_id"],
        "doi": spec["doi"],
        "oa_id": oa_id,
        "title": work.get("display_name") or spec.get("title"),
        "year": work.get("publication_year") or spec.get("year"),
        "cbc": work.get("cited_by_count") or 0,
        "refs": refs,
    }


def _write_record(db, rec: dict, ts: str) -> None:
    cs.upsert_paper(
        db, oa_id=rec["oa_id"], doi=rec["doi"], doc_id=rec["doc_id"],
        title=rec["title"], year=rec["year"], cited_by_count=rec["cbc"],
        in_corpus=True, enriched_at=ts,
    )
    cs.upsert_alias(db, provider="openalex", external_id=rec["oa_id"], oa_id=rec["oa_id"])
    cs.upsert_alias(db, provider="doi", external_id=rec["doi"], oa_id=rec["oa_id"])
    # Outgoing references: minimal external nodes + edges (corpus refs already keyed by oa_id).
    for ref in rec["refs"]:
        cs.upsert_paper(db, oa_id=ref)
    cs.add_cites(
        db,
        ((rec["oa_id"], ref, 0) for ref in rec["refs"]),
        provider="openalex",
    )


def _s2_influential_pass(db, dois: list[str], log) -> int:
    """Overlay Semantic Scholar isInfluential on existing edges. Best-effort; throttled."""
    hits = 0
    for i in range(0, len(dois), 400):
        chunk = dois[i:i + 400]
        body = {"ids": [f"DOI:{d}" for d in chunk]}
        outcome = SEMANTIC_SCHOLAR.request(
            "POST",
            S2_BATCH_API,
            params={"fields": "externalIds,references.externalIds,references.isInfluential"},
            json=body,
            timeout=90.0,
        )
        if outcome.kind is not OutcomeKind.SUCCESS:
            log.warning("s2 batch %d-%d failed: %s", i, i + len(chunk), outcome.kind.value)
            continue
        papers = outcome.data or []
        for paper, src_doi in zip(papers, chunk):
            if not paper:
                continue
            for ref in paper.get("references") or []:
                if not ref or not ref.get("isInfluential"):
                    continue
                dst_doi = cs.normalize_doi((ref.get("externalIds") or {}).get("DOI"))
                if dst_doi:
                    hits += db_set_influential(db, src_doi, dst_doi)
        log.info("s2 influential pass %d/%d DOIs, %d edges flagged", min(i + 400, len(dois)), len(dois), hits)
    return hits


def db_set_influential(db, src_doi: str, dst_doi: str) -> int:
    return cs.set_influential_by_doi(db, src_doi, dst_doi)


def _fetch_s2_incoming(doi: str, *, cap: int) -> RequestOutcome:
    """Citers of a DOI from Semantic Scholar's free citations endpoint, paginated.

    Returns a typed outcome containing ``[{doi, paper_id, year, is_influential}]``.
    Terminal misses are distinct from retryable provider failures.
    """
    url = f"{S2_GRAPH_API}/paper/DOI:{doi}/citations"
    fields = "externalIds,year,isInfluential"
    out: list[dict] = []
    offset = 0
    while len(out) < cap:
        params = {"fields": fields, "limit": str(min(_S2_PAGE, cap - len(out))), "offset": str(offset)}
        outcome = SEMANTIC_SCHOLAR.request("GET", url, params=params, timeout=90.0)
        if outcome.kind is OutcomeKind.TERMINAL_MISS:
            return outcome
        if outcome.kind is not OutcomeKind.SUCCESS:
            return outcome
        payload = outcome.data or {}
        data = payload.get("data") or []
        for item in data:
            citing = item.get("citingPaper") or {}
            ext = citing.get("externalIds") or {}
            out.append({
                "doi": cs.normalize_doi(ext.get("DOI")),
                "paper_id": citing.get("paperId"),
                "year": citing.get("year"),
                "is_influential": bool(item.get("isInfluential")),
            })
        nxt = payload.get("next")
        if nxt is None or not data:
            break
        offset = nxt
    return RequestOutcome(OutcomeKind.SUCCESS, data=out[:cap], status_code=200)


def _s2_incoming_pass(
    db, specs: list[dict], *, cap: int, checkpoint_every: int, log, workers: int = _S2_INCOMING_WORKERS
) -> dict[str, int]:
    """Populate incoming-citation edges (and isInfluential) from Semantic Scholar.

    For each corpus paper, fetch its citers, key each citer to a stable node id, and add the
    edge citer -> corpus_paper. This is what revives `in_adj` (and therefore co-citation and
    the backward PPR signal), since OpenAlex meters the equivalent query.

    Network fetches use one long-lived bounded executor. SQLite writes stay on the main
    thread and checkpoint progressively. Successful and terminal-not-found responses are
    marked complete; retryable failures remain pending.
    """
    corpus_oa_by_doi = cs.corpus_oa_by_doi(db)
    done = cs.incoming_done_dois(db)
    todo = [s for s in specs if s["doi"] not in done and s["doi"] in corpus_oa_by_doi]
    log.info("cite enrich: S2 incoming pass over %d corpus DOIs (cap=%d/paper, workers=%d)",
             len(todo), cap, workers)

    new_edges = 0
    new_influential = 0
    failed = 0
    processed = 0
    terminal_misses = 0
    for _, (spec, outcome) in streaming_parallel_map(
        lambda s: (s, _fetch_s2_incoming(s["doi"], cap=cap)),
        todo,
        workers=workers,
    ):
        ts = _now()
        target_oa = corpus_oa_by_doi[spec["doi"]]
        if not outcome.complete:
            failed += 1
        else:
            citers = outcome.data or []
            if outcome.kind is OutcomeKind.TERMINAL_MISS:
                terminal_misses += 1
            edges: list[tuple[str, str, int]] = []
            for c in citers:
                node = _citer_node_id(c["doi"], c["paper_id"], corpus_oa_by_doi)
                if not node or node == target_oa:
                    continue
                in_corpus = bool(c["doi"] and c["doi"] in corpus_oa_by_doi)
                cs.upsert_paper(db, oa_id=node, doi=c["doi"], year=c["year"], in_corpus=in_corpus)
                cs.upsert_alias(db, provider="semantic-scholar", external_id=c["paper_id"], oa_id=node)
                cs.upsert_alias(db, provider="doi", external_id=c["doi"], oa_id=node)
                infl = 1 if c["is_influential"] else 0
                edges.append((node, target_oa, infl))
                new_influential += infl
            new_edges += cs.add_cites(db, edges, provider="semantic-scholar")
            cs.mark_incoming_done(db, target_oa, ts)
        processed += 1
        if processed % max(1, checkpoint_every) == 0 or processed == len(todo):
            db.commit()
            log.info("cite enrich: S2 incoming %d/%d papers, %d edges (%d fetch-fails)",
                     processed, len(todo), new_edges, failed)
    log.info("cite enrich: S2 incoming done, %d edges (%d influential, %d fetch-fails to retry)",
             new_edges, new_influential, failed)
    return {
        "incoming_edges": new_edges,
        "incoming_influential": new_influential,
        "incoming_failed": failed,
        "incoming_terminal_misses": terminal_misses,
    }


def enrich_citations(
    *,
    force: bool = False,
    workers: int = 16,
    with_s2: bool = True,
    incoming: bool = True,
    incoming_cap: int = 500,
    incoming_workers: int = _S2_INCOMING_WORKERS,
    checkpoint_every: int = 50,
) -> dict[str, int]:
    log = get_logger()
    manifest = load_manifest()

    # Corpus papers with a usable DOI (dedup by DOI; first doc_id wins).
    doi_to_doc: dict[str, str] = {}
    specs: list[dict] = []
    db = cs.connect()
    ts = _now()

    # Authorship edges are cheap and don't need OpenAlex — write them upfront.
    author_pairs: list[tuple[str, str]] = []
    for item in manifest.items:
        doi = cs.normalize_doi(item.doi)
        for name in item.authors or []:
            ak = cs.author_key(name)
            if ak:
                author_pairs.append((ak, item.id))
        if not doi or doi in doi_to_doc:
            continue
        doi_to_doc[doi] = item.id
        specs.append({"doi": doi, "doc_id": item.id, "title": item.title, "year": item.year})
    cs.add_authorships(db, author_pairs)
    db.commit()

    all_specs = list(specs)  # incoming pass runs over every corpus DOI (own resumption marker)
    if not force:
        done = {r[0] for r in db.execute(
            "SELECT doi FROM papers WHERE in_corpus=1 AND enriched_at IS NOT NULL AND doi IS NOT NULL"
        )}
        specs = [s for s in specs if s["doi"] not in done]

    log.info("cite enrich: %d corpus DOIs to fetch (workers=%d)", len(specs), workers)

    records = parallel_map(
        _fetch_record, specs, workers=workers, label="openalex citations",
    )

    written = 0
    for rec in records:
        if not rec:
            continue
        _write_record(db, rec, ts)
        written += 1
        if written % checkpoint_every == 0:
            db.commit()
            log.info("cite enrich: wrote %d/%d papers", written, len(specs))
    db.commit()

    # Incoming citations (Semantic Scholar): the half OpenAlex meters. This is what makes
    # co-citation and the backward PPR signal real.
    if incoming and all_specs:
        try:
            _s2_incoming_pass(
                db, all_specs, cap=incoming_cap, checkpoint_every=checkpoint_every,
                log=log, workers=incoming_workers,
            )
        except Exception as exc:  # never let S2 sink the whole run
            log.warning("s2 incoming pass aborted: %s", exc)
            db.commit()

    if with_s2 and doi_to_doc:
        log.info("cite enrich: Semantic Scholar isInfluential pass over %d DOIs", len(doi_to_doc))
        try:
            _s2_influential_pass(db, list(doi_to_doc), log)
            db.commit()
        except Exception as exc:  # never let S2 sink the whole run
            log.warning("s2 influential pass aborted: %s", exc)

    stats = cs.counts(db)
    db.close()
    log_provider_summaries()
    log.info("cite enrich done: %s", stats)
    return stats
