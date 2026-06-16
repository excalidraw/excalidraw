from __future__ import annotations

from rag_literature_rag.catalog.taxonomy import categories_from_keywords, categories_from_tags
from rag_literature_rag.harvest.doi_resolver import pick_pdf_urls
from rag_literature_rag.harvest.download import download_to_file
from rag_literature_rag.harvest.parallel import parallel_map
from rag_literature_rag.harvest.providers import OPENALEX, OutcomeKind
from rag_literature_rag.harvest.relevance import is_layout_relevant, is_pipeline_relevant
from rag_literature_rag.manifest import ManifestItem, relative_local_path, slug_id
from rag_literature_rag.paths import PDF_DIR

OPENALEX_API = "https://api.openalex.org/works"
# Information retrieval, NLP, AI (verified OpenAlex concept IDs)
IR_CONCEPT = "C41008148"
NLP_CONCEPT = "C185592680"
AI_CONCEPT = "C119599485"
RAG_CONCEPTS = (IR_CONCEPT, NLP_CONCEPT, AI_CONCEPT)

SEARCH_QUERIES = [
    "retrieval augmented generation",
    "dense passage retrieval",
    "graph retrieval augmented generation",
    "agentic retrieval augmented generation",
    "hybrid dense sparse retrieval",
    "RAG evaluation benchmark",
]

TOPIC_QUERIES: dict[str, list[str]] = {
    "foundations": [
        "retrieval augmented generation knowledge intensive",
        "dense passage retrieval open domain",
        "fusion in decoder question answering",
    ],
    "dense-retrieval": [
        "ColBERT late interaction retrieval",
        "bi-encoder passage retrieval",
        "text embedding retrieval augmented",
    ],
    "hybrid-retrieval": [
        "hybrid dense sparse retrieval RRF",
        "reciprocal rank fusion retrieval",
        "lexical semantic hybrid search",
    ],
    "chunking": [
        "document chunking retrieval augmented",
        "contextual retrieval chunk embedding",
        "RAPTOR hierarchical retrieval",
        "structure aware chunking RAG",
    ],
    "query-expansion": [
        "HyDE hypothetical document embedding",
        "query rewriting retrieval augmented",
        "multi-query retrieval expansion",
    ],
    "reranking": [
        "reranking retrieval augmented generation",
        "cross encoder rerank passages",
        "RankRAG context ranking",
    ],
    "self-correcting": [
        "Self-RAG reflection tokens",
        "corrective retrieval augmented generation",
        "retrieval evaluator fallback",
    ],
    "graphrag": [
        "graph retrieval augmented generation",
        "knowledge graph community summary RAG",
        "HippoRAG personalized pagerank",
        "LightRAG dual level retrieval",
    ],
    "agentic": [
        "agentic retrieval augmented generation",
        "iterative retrieval reasoning loop",
        "active retrieval augmented generation FLARE",
    ],
    "evaluation": [
        "RAG evaluation faithfulness benchmark",
        "retrieval augmented generation metrics RAGAS",
        "RGB benchmark retrieval augmented",
    ],
    "long-context": [
        "long context versus retrieval augmented",
        "long context LLM retrieval comparison",
    ],
    "engineering": [
        "retrieval augmented generation best practices",
        "RAG pipeline engineering deployment",
    ],
    "survey": [
        "retrieval augmented generation survey",
        "agentic RAG survey taxonomy",
    ],
}

PIPELINE_TOPIC_KEYS: tuple[str, ...] = tuple(TOPIC_QUERIES.keys())

PIPELINE_TOPIC_QUERIES: dict[str, list[str]] = {
    key: TOPIC_QUERIES[key] for key in PIPELINE_TOPIC_KEYS if key in TOPIC_QUERIES
}

KEY_AUTHORS = [
    "Lewis",
    "Karpukhin",
    "Khattab",
    "Gao",
    "Izacard",
    "Asai",
    "Yan",
    "Edge",
    "Guo",
    "Jiang",
]


def _pick_pdf_url(work: dict) -> str | None:
    return (
        (work.get("best_oa_location") or {}).get("pdf_url")
        or (work.get("open_access") or {}).get("oa_url")
        or (work.get("primary_location") or {}).get("pdf_url")
    )


def _abstract_from_inverted_index(idx: dict | None) -> str | None:
    if not idx:
        return None
    pairs = [(pos, word) for word, positions in idx.items() for pos in positions]
    pairs.sort(key=lambda x: x[0])
    return " ".join(word for _, word in pairs)[:4000]


def _topic_supported(topic: str, title: str, abstract: str | None) -> bool:
    """True when the work itself supports the discovery topic.

    Prevents the OpenAlex query label (e.g. ``dagre``, ``uml-layout``) from being
    stamped onto every returned work regardless of relevance. A topic sticks only
    when its literal phrase appears in the text, or the topic maps to a pipeline
    category that the text genuinely matches via keyword phrases.
    """
    hay = f"{title} {abstract or ''}".lower()
    if topic in hay or topic.replace("-", " ") in hay:
        return True
    cats = categories_from_tags([topic])
    return bool(cats and (cats & categories_from_keywords(hay)))


def _work_to_item(work: dict, *, topic: str | None = None) -> ManifestItem:
    doi_raw = work.get("doi") or ""
    doi = doi_raw.replace("https://doi.org/", "") if doi_raw else None
    pdf_url = _pick_pdf_url(work)
    authors = [
        a.get("author", {}).get("display_name", "")
        for a in work.get("authorships") or []
        if a.get("author", {}).get("display_name")
    ]
    title = work.get("display_name") or ""
    abstract = _abstract_from_inverted_index(work.get("abstract_inverted_index"))
    doc_id = slug_id(f"openalex-{doi or work.get('id', '').split('/')[-1] or title}")
    # Tags come from the work's OWN text, not the query label. The discovery
    # topic is only added when the work independently supports it.
    tags = {"openalex", "rag-literature"}
    tags |= categories_from_keywords(f"{title} {abstract or ''}")
    if topic and _topic_supported(topic, title, abstract):
        tags.add(topic)
    return ManifestItem(
        id=doc_id,
        title=title or doc_id,
        authors=authors,
        year=work.get("publication_year"),
        source="openalex",
        url=pdf_url or (f"https://doi.org/{doi}" if doi else work.get("id", "")),
        localPath=f"data/raw/pdf/{doc_id}.pdf" if pdf_url else None,
        contentType="application/pdf" if pdf_url else "text/metadata",
        status="metadata_only" if not pdf_url else "failed",
        tags=sorted(tags),
        doi=doi,
        abstract=abstract,
    )


def _search_openalex(
    query: str,
    *,
    per_page: int = 50,
    max_results: int = 200,
    oa_only: bool = True,
    use_concept_filter: bool = False,
) -> list[dict]:
    results: list[dict] = []
    cursor: str | None = "*"
    page_size = min(per_page, 200)

    filters: list[str] = []
    if oa_only:
        filters.append("has_fulltext:true,is_oa:true")
    if use_concept_filter:
        filters.append(f"concepts.id:{IR_CONCEPT}")

    while cursor and len(results) < max_results:
        params: dict[str, str] = {
            "search": query,
            "per_page": str(page_size),
            "sort": "cited_by_count:desc",
            "cursor": cursor,
        }
        if filters:
            params["filter"] = ",".join(filters)

        outcome = OPENALEX.request_openalex(
            "GET", OPENALEX_API, operation="search", params=params, timeout=60.0
        )
        if outcome.kind is OutcomeKind.BUDGET_EXHAUSTED:
            break
        if outcome.kind is not OutcomeKind.SUCCESS:
            break
        payload = outcome.data or {}

        page = payload.get("results") or []
        results.extend(page)
        cursor = payload.get("meta", {}).get("next_cursor")
        if not page:
            break

    return results[:max_results]


def _fetch_by_doi(doi: str) -> dict | None:
    url = f"{OPENALEX_API}/https://doi.org/{doi}"
    outcome = OPENALEX.request_openalex("GET", url, operation="singleton", timeout=30.0)
    return outcome.data if outcome.kind is OutcomeKind.SUCCESS else None


def _try_download_pdf(item: ManifestItem, url: str, *, dry_run: bool) -> bool:
    dest = PDF_DIR / f"{item.id}.pdf"
    insecure = any(h in url for h in ("infotech.monash.edu", "it.monash.edu", "marvl."))
    dl = download_to_file(dest, url, dry_run=dry_run, verify=not insecure)
    if dl.get("ok"):
        item.status = "ok"
        item.url = url
        item.sha256 = dl.get("sha256")
        item.localPath = relative_local_path(dest)
        return True
    dest.unlink(missing_ok=True)
    return False


def _finalize_openalex_item(item: ManifestItem, *, dry_run: bool) -> ManifestItem:
    work = _fetch_by_doi(item.doi) if item.doi else None
    if work and not item.abstract:
        item.abstract = _abstract_from_inverted_index(work.get("abstract_inverted_index"))

    candidates: list[str] = []
    if item.url and ".pdf" in item.url.lower():
        candidates.append(item.url)
    pdf = _pick_pdf_url(work) if work else None
    if pdf:
        candidates.append(pdf)
    if item.doi:
        candidates.extend(pick_pdf_urls(item.doi, work))

    seen: set[str] = set()
    for url in candidates:
        if not url or url in seen:
            continue
        seen.add(url)
        if _try_download_pdf(item, url, dry_run=dry_run):
            return item

    if not dry_run:
        item.status = "metadata_only"
    return item


def harvest_openalex(
    *,
    max_works: int = 200,
    max_per_topic: int = 30,
    dry_run: bool = False,
    use_topic_queries: bool = True,
    oa_only: bool = True,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
    pipeline_only: bool = False,
) -> list[ManifestItem]:
    by_id: dict[str, ManifestItem] = {}
    skip_ids = existing_ids or set()
    topic_map = PIPELINE_TOPIC_QUERIES if pipeline_only else TOPIC_QUERIES

    def add_work(work: dict, topic: str | None = None) -> None:
        if len(by_id) >= max_works:
            return
        title = work.get("display_name") or ""
        abstract = _abstract_from_inverted_index(work.get("abstract_inverted_index"))
        if pipeline_only:
            if not is_layout_relevant(title, abstract, strict=True):
                return
            if topic and not is_pipeline_relevant(title, abstract):
                if not any(k in title.lower() for k in (topic.replace("-", " "), topic)):
                    return
        elif not is_layout_relevant(title, abstract, strict=True):
            return
        item = _work_to_item(work, topic=topic)
        if item.id in skip_ids:
            return
        existing = by_id.get(item.id)
        if existing:
            if topic and topic not in existing.tags and _topic_supported(topic, title, abstract):
                existing.tags = sorted(set([*existing.tags, topic]))
        else:
            by_id.setdefault(item.id, item)

    if use_topic_queries:
        query_specs = [(topic, query) for topic, queries in topic_map.items() for query in queries]
        fetched = parallel_map(
            lambda spec: _search_openalex(
                spec[1], per_page=max_per_topic, max_results=max_per_topic, oa_only=oa_only
            ),
            query_specs,
            workers=min(workers or 32, len(query_specs)),
            label="openalex-search",
        )
        for (topic, _), works in zip(query_specs, fetched):
            for work in works:
                add_work(work, topic=topic)
                if len(by_id) >= max_works:
                    break
            if len(by_id) >= max_works:
                break

    if not pipeline_only:
        for query in SEARCH_QUERIES:
            if len(by_id) >= max_works:
                break
            for work in _search_openalex(query, per_page=80, max_results=80, oa_only=oa_only):
                add_work(work)
                if len(by_id) >= max_works:
                    break

        for author in KEY_AUTHORS:
            if len(by_id) >= max_works:
                break
            for work in _search_openalex(
                f"retrieval augmented generation {author}",
                per_page=40,
                max_results=40,
                oa_only=oa_only,
            ):
                add_work(work)
                if len(by_id) >= max_works:
                    break

        if len(by_id) < max_works:
            for work in _search_openalex(
                "retrieval augmented generation",
                per_page=100,
                max_results=min(200, max_works - len(by_id)),
                oa_only=oa_only,
                use_concept_filter=True,
            ):
                add_work(work)
                if len(by_id) >= max_works:
                    break

    items = list(by_id.values())
    return parallel_map(
        lambda item: _finalize_openalex_item(item, dry_run=dry_run),
        items,
        workers=workers,
        label="openalex-download",
    )
