"""Curated RAG research seeds — foundations, pipeline techniques, GraphRAG, agentic RAG, evaluation."""

from __future__ import annotations

from collections.abc import Callable

from rag_literature_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from rag_literature_rag.harvest.download import download_to_file
from rag_literature_rag.harvest.parallel import parallel_map
from rag_literature_rag.manifest import ManifestItem, relative_local_path
from rag_literature_rag.paths import PDF_DIR


def _arxiv_pdf(arxiv_id: str, title: str, year: int, tags: list[str], *, authors: list[str] | None = None) -> dict:
    slug = arxiv_id.replace(".", "-").lower()
    return {
        "id": f"arxiv-{slug}",
        "title": title,
        "authors": authors or [],
        "year": year,
        "url": f"https://arxiv.org/pdf/{arxiv_id}.pdf",
        "doi": f"10.48550/arXiv.{arxiv_id}",
        "source": "topic-seed",
        "tags": [*tags, "topic-seed"],
    }


# Tier 0 — foundational
TOPIC_PDF_SEEDS: list[dict] = [
    _arxiv_pdf(
        "2005.11401",
        "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
        2020,
        ["foundations", "generation"],
        authors=["Lewis", "Perez", "Piktus"],
    ),
    _arxiv_pdf("2004.04906", "Dense Passage Retrieval for Open-Domain Question Answering", 2020, ["foundations", "dense-retrieval"], authors=["Karpukhin", "Oguz", "Min"]),
    _arxiv_pdf("2004.12832", "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT", 2020, ["foundations", "late-interaction"], authors=["Khattab", "Zaharia"]),
    _arxiv_pdf("2002.08909", "REALM: Retrieval-Augmented Language Model Pre-Training", 2020, ["foundations", "pretraining"], authors=["Guu", "Lee", "Tung"]),
    _arxiv_pdf("2112.04426", "Improving language models by retrieving from trillions of tokens", 2021, ["foundations", "parametric-memory"], authors=["Borgeaud", "Mensch", "Hoffmann"]),
    _arxiv_pdf("2007.01282", "Leveraging Passage Retrieval with Generative Models for Open Domain Question Answering", 2020, ["foundations", "reader"], authors=["Izacard", "Grave"]),
    _arxiv_pdf("2312.10997", "Retrieval-Augmented Generation for Large Language Models: A Survey", 2023, ["survey", "taxonomy"], authors=["Gao", "Yunfan", "Xinyu"]),
]

# Tier 1–4 — resolved via OpenAlex / arXiv DOI
TOPIC_DOI_SEEDS: list[dict] = [
    # Tier 1 — core pipeline
    {"doi": "10.48550/arXiv.2310.11511", "tags": ["self-correcting", "reflection"], "title_hint": "Self-RAG"},
    {"doi": "10.48550/arXiv.2401.15884", "tags": ["self-correcting", "evaluator"], "title_hint": "Corrective Retrieval Augmented Generation"},
    {"doi": "10.48550/arXiv.2401.18059", "tags": ["chunking", "hierarchical-index"], "title_hint": "RAPTOR"},
    {"doi": "10.48550/arXiv.2209.10063", "tags": ["query-expansion"], "title_hint": "Generate rather than Retrieve: GenRead"},
    {"doi": "10.48550/arXiv.2305.06983", "tags": ["agentic", "iterative-retrieval"], "title_hint": "FLARE Active Retrieval Augmented Generation"},
    {"doi": "10.48550/arXiv.2305.14283", "tags": ["query-rewriting"], "title_hint": "Query Rewriting for Retrieval-Augmented Large Language Models"},
    {"doi": "10.48550/arXiv.2310.01352", "tags": ["training", "dual-tuning"], "title_hint": "RA-DIT"},
    {"doi": "10.48550/arXiv.2310.04408", "tags": ["compression", "context"], "title_hint": "RECOMP"},
    {"doi": "10.48550/arXiv.2311.09210", "tags": ["robustness", "noise"], "title_hint": "Chain-of-Note"},
    {"doi": "10.48550/arXiv.2311.08377", "tags": ["filtering", "context"], "title_hint": "FILCO"},
    {"doi": "10.48550/arXiv.2406.19215", "tags": ["adaptive", "uncertainty"], "title_hint": "SeaKR"},
    {"doi": "10.48550/arXiv.2407.02485", "tags": ["reranking", "unified"], "title_hint": "RankRAG"},
    {"doi": "10.48550/arXiv.2406.15319", "tags": ["long-context", "chunking"], "title_hint": "LongRAG"},
    {"doi": "10.48550/arXiv.2409.05591", "tags": ["memory", "draft-retrieval"], "title_hint": "MemoRAG"},
    {"doi": "10.48550/arXiv.2407.01219", "tags": ["engineering", "ablation"], "title_hint": "Searching for Best Practices in RAG"},
    {"doi": "10.48550/arXiv.2501.07391", "tags": ["engineering"], "title_hint": "Enhancing Retrieval-Augmented Generation: Best Practices"},
    # Tier 2 — GraphRAG
    {"doi": "10.48550/arXiv.2404.16130", "tags": ["graphrag", "community"], "title_hint": "From Local to Global: A Graph RAG Approach"},
    {"doi": "10.48550/arXiv.2408.08921", "tags": ["graphrag", "survey"], "title_hint": "Graph Retrieval-Augmented Generation: A Survey"},
    {"doi": "10.48550/arXiv.2405.14831", "tags": ["graphrag", "ppr"], "title_hint": "HippoRAG"},
    {"doi": "10.48550/arXiv.2410.05779", "tags": ["graphrag", "dual-level"], "title_hint": "LightRAG"},
    {"doi": "10.48550/arXiv.2504.11544", "tags": ["graphrag", "heterogeneous"], "title_hint": "NodeRAG"},
    {"doi": "10.48550/arXiv.2506.05690", "tags": ["graphrag", "evaluation"], "title_hint": "When to use Graphs in RAG"},
    {"doi": "10.48550/arXiv.2602.01965", "tags": ["graphrag", "query-aware"], "title_hint": "CatRAG"},
    {"doi": "10.1145/3795880", "tags": ["graphrag", "survey"], "title_hint": "Graph-Based Approaches in RAG"},
    # Tier 3 — agentic
    {"doi": "10.48550/arXiv.2501.09136", "tags": ["agentic", "survey"], "title_hint": "Agentic Retrieval-Augmented Generation Survey"},
    {"doi": "10.48550/arXiv.2507.09477", "tags": ["agentic", "reasoning", "survey"], "title_hint": "Towards Agentic RAG with Deep Reasoning"},
    {"doi": "10.48550/arXiv.2603.07379", "tags": ["agentic", "sok", "evaluation"], "title_hint": "SoK Agentic RAG"},
    {"doi": "10.48550/arXiv.2601.05264", "tags": ["engineering", "trust", "survey"], "title_hint": "Engineering the RAG Stack"},
    {"doi": "10.48550/arXiv.2602.03442", "tags": ["agentic", "interfaces"], "title_hint": "A-RAG"},
    {"doi": "10.48550/arXiv.2604.00865", "tags": ["agentic", "repair"], "title_hint": "Doctor-RAG"},
    {"doi": "10.48550/arXiv.2411.19443", "tags": ["agentic", "planning"], "title_hint": "Auto-RAG"},
    {"doi": "10.48550/arXiv.2310.03714", "tags": ["framework", "optimization"], "title_hint": "DSPy"},
    # Tier 4 — evaluation & embeddings
    {"doi": "10.48550/arXiv.2309.15217", "tags": ["evaluation", "metrics"], "title_hint": "RAGAS"},
    {"doi": "10.48550/arXiv.2309.01431", "tags": ["evaluation", "robustness"], "title_hint": "RGB Benchmark"},
    {"doi": "10.48550/arXiv.2406.04744", "tags": ["evaluation", "dynamic"], "title_hint": "CRAG Benchmark"},
    {"doi": "10.48550/arXiv.2409.12941", "tags": ["evaluation", "multi-hop"], "title_hint": "FRAMES"},
    {"doi": "10.48550/arXiv.2602.05975", "tags": ["evaluation", "bm25"], "title_hint": "SAGE Benchmark"},
    {"doi": "10.48550/arXiv.2601.21937", "tags": ["evaluation", "reasoning"], "title_hint": "DeR2"},
    {"doi": "10.48550/arXiv.2602.02053", "tags": ["evaluation", "graphrag"], "title_hint": "WildGraphBench"},
    {"doi": "10.48550/arXiv.2508.01959", "tags": ["embeddings", "contextual"], "title_hint": "SitEmb"},
    {"doi": "10.48550/arXiv.2202.06671", "tags": ["embeddings", "citation"], "title_hint": "SciNCL"},
    {"doi": "10.48550/arXiv.2501.01880", "tags": ["long-context", "comparison"], "title_hint": "Long Context vs RAG"},
]

TOPIC_METADATA_SEEDS: list[dict] = [
    {
        "id": "anthropic-contextual-retrieval-cookbook",
        "title": "Contextual Retrieval (Anthropic cookbook)",
        "authors": ["Anthropic"],
        "year": 2024,
        "url": "https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide",
        "source": "anthropic-cookbook",
        "tags": ["chunking", "contextual-retrieval", "implementer-guide"],
        "abstract": "Prepends LLM-generated context to chunks before embedding and BM25 indexing.",
    },
    {
        "id": "llamaindex-advanced-rag",
        "title": "LlamaIndex Advanced RAG Techniques",
        "authors": ["LlamaIndex"],
        "year": 2024,
        "url": "https://docs.llamaindex.ai/en/stable/optimizing/advanced_retrieval/advanced_retrieval/",
        "source": "implementer-guide",
        "tags": ["engineering", "implementer-guide"],
        "abstract": "Practitioner guide to query transforms, reranking, and hybrid retrieval in LlamaIndex.",
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
        tags=list(spec.get("tags", [])),
        doi=spec.get("doi"),
    )
    if dry_run:
        return item

    dest = PDF_DIR / f"{spec['id']}.pdf"
    for url in [spec["url"], *spec.get("fallback_urls", [])]:
        try:
            dl = download_to_file(dest, url)
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


def harvest_topic_seeds(
    *,
    dry_run: bool = False,
    workers: int | None = None,
    on_doi_batch: Callable[[list[ManifestItem]], None] | None = None,
    doi_batch_size: int = 10,
) -> list[ManifestItem]:
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
            include_archive=False,
            include_paywall_guesses=False,
        )

    for start in range(0, len(TOPIC_DOI_SEEDS), doi_batch_size):
        batch = TOPIC_DOI_SEEDS[start : start + doi_batch_size]
        batch_items = parallel_map(_resolve_doi_seed, batch, workers=workers)
        results.extend(batch_items)
        if on_doi_batch and batch_items:
            on_doi_batch(batch_items)

    for spec in TOPIC_METADATA_SEEDS:
        results.append(
            ManifestItem(
                id=spec["id"],
                title=spec["title"],
                authors=spec.get("authors", []),
                year=spec.get("year"),
                source=spec.get("source", "topic-seed"),
                url=spec["url"],
                localPath="",
                contentType="text/html",
                status="metadata_only",
                tags=list(spec.get("tags", [])),
                abstract=spec.get("abstract"),
            )
        )

    return results
