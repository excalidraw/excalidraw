from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

import lancedb

from rag_common.gemini_embed import is_gemini_embedding_2

from rag_literature_rag.ingest import bm25
from rag_literature_rag.ingest.chunk import (
    TextChunk,
    embed_body_text,
    embed_input_text,
    enrich_texts_for_section,
    is_small2big_dual_profile,
    is_section_enriched_profile,
)
from rag_literature_rag.ingest.doc_summary import (
    DocumentSummary,
    cache_stats as docsummary_cache_stats,
    summary_row,
    summary_to_chunk,
)
from rag_literature_rag.ingest.log import get_logger
from rag_literature_rag.ingest.embed import (
    ENV_PREFIX,
    EmbedConfig,
    EmbedStats,
    embed_config_from_env,
    embed_texts,
)
from rag_literature_rag.ingest import embed_cache
from rag_common.config import embed_cost_per_million

from rag_literature_rag.paths import (
    CHUNKS_TABLE,
    PARENTS_TABLE,
    SUMMARIES_TABLE,
    ProfileIndexPaths,
    profile_index_paths,
)

METADATA_KEYS = frozenset(
    {
        "embed_backend",
        "embed_model",
        "embed_dims",
        "embed_profile",
        "embed_quant",
        "pdf_backend",
        "chunking_fingerprint",
        "total_tokens_embedded",
        "estimated_cost_usd",
        "last_indexed_at",
    }
)


@dataclass
class IndexPhaseStats:
    embedding_seconds: float = 0.0
    lancedb_seconds: float = 0.0
    bm25_seconds: float = 0.0
    embed_cache_hits: int = 0
    embed_cache_misses: int = 0


def _paths(profile: str | ProfileIndexPaths | None) -> ProfileIndexPaths:
    if isinstance(profile, ProfileIndexPaths):
        return profile
    return profile_index_paths(profile)


def load_ingest_state(profile: str | ProfileIndexPaths | None = None) -> dict[str, Any]:
    paths = _paths(profile)
    if not paths.ingest_state.is_file():
        return {}
    return json.loads(paths.ingest_state.read_text(encoding="utf-8"))


def save_ingest_state(
    state: dict[str, Any],
    profile: str | ProfileIndexPaths | None = None,
) -> None:
    paths = _paths(profile)
    paths.root.mkdir(parents=True, exist_ok=True)
    tmp = paths.ingest_state.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, paths.ingest_state)


def doc_sha256(state: dict[str, Any], doc_id: str) -> str | None:
    value = state.get(doc_id)
    return value if isinstance(value, str) else None


def clear_doc_entries(state: dict[str, Any]) -> None:
    """Remove per-doc checkpoint entries; preserve metadata keys."""
    for key in list(state.keys()):
        if key not in METADATA_KEYS:
            del state[key]


def pdf_backend_mismatch(state: dict[str, Any], pdf_backend: str) -> bool:
    stored = state.get("pdf_backend")
    if not stored:
        return False
    return stored != pdf_backend


def chunking_fingerprint_mismatch(state: dict[str, Any], fingerprint: dict[str, object]) -> bool:
    stored = state.get("chunking_fingerprint")
    return bool(stored and stored != fingerprint)


def _table_names(db: lancedb.DBConnection) -> list[str]:
    tables = db.list_tables()
    if isinstance(tables, list):
        return tables
    return list(getattr(tables, "tables", tables))


def _chunk_row(chunk: TextChunk, vector: list[float]) -> dict[str, Any]:
    return {
        "id": f"{chunk.doc_id}:{chunk.chunk_index}",
        "doc_id": chunk.doc_id,
        "title": chunk.title,
        "text": chunk.text,
        "page": chunk.page,
        "chunk_index": chunk.chunk_index,
        "source_url": chunk.source_url,
        "year": chunk.year,
        "page_end": chunk.page_end,
        "section_path": chunk.section_path,
        "alias_doc_ids": ",".join(chunk.alias_doc_ids),
        "alias_source_urls": ",".join(chunk.alias_source_urls),
        "alias_dois": ",".join(chunk.alias_dois),
        "canonical_sha256": chunk.canonical_sha256,
        "tags": ",".join(chunk.tags),
        "pipeline_categories": ",".join(chunk.pipeline_categories),
        "authors": ",".join(chunk.authors),
        "vector": vector,
        "parent_id": chunk.parent_id,
        "parent_chunk_index": chunk.parent_chunk_index,
        "parent_page": chunk.parent_page,
        "parent_page_end": chunk.parent_page_end,
        "parent_section_path": chunk.parent_section_path,
    }


def embed_config_from_state(state: dict[str, Any]) -> EmbedConfig | None:
    backend = state.get("embed_backend")
    if not backend:
        return None
    quant = state.get("embed_quant")
    return EmbedConfig(
        backend=backend,
        model=state.get("embed_model", ""),
        dimensions=int(state.get("embed_dims", 0)),
        profile=state.get("embed_profile"),
        quant=quant if quant else None,
    )


def embed_config_mismatch(state: dict[str, Any], config: EmbedConfig) -> bool:
    indexed = embed_config_from_state(state)
    if indexed is None:
        return False
    return (
        indexed.backend != config.backend
        or indexed.model != config.model
        or indexed.dimensions != config.dimensions
    )


def ensure_embed_config_matches(state: dict[str, Any], config: EmbedConfig) -> None:
    indexed = embed_config_from_state(state)
    if indexed is None:
        return
    if indexed.backend != config.backend:
        raise RuntimeError(
            f"Index was built with embed backend '{indexed.backend}' "
            f"but query uses '{config.backend}'. "
            "Re-run: rag-literature-rag ingest --force --rebuild"
        )
    if indexed.model != config.model:
        raise RuntimeError(
            f"Index was built with embed model '{indexed.model}' but query uses '{config.model}'. "
            "Re-run: rag-literature-rag ingest --force --rebuild"
        )
    if indexed.dimensions != config.dimensions:
        raise RuntimeError(
            f"Index was built with embed dims {indexed.dimensions} but query uses {config.dimensions}. "
            "Re-run: rag-literature-rag ingest --force --rebuild"
        )


def update_ingest_metadata(
    state: dict[str, Any],
    *,
    config: EmbedConfig,
    run_tokens: int,
    pdf_backend: str | None = None,
) -> None:
    prev_tokens = int(state.get("total_tokens_embedded", 0))
    prev_cost = float(state.get("estimated_cost_usd", 0.0))
    run_cost = (run_tokens / 1_000_000) * embed_cost_per_million(config.backend)
    state["embed_backend"] = config.backend
    state["embed_model"] = config.model
    state["embed_dims"] = config.dimensions
    if config.profile:
        state["embed_profile"] = config.profile
    if config.quant:
        state["embed_quant"] = config.quant
    if pdf_backend:
        state["pdf_backend"] = pdf_backend
    state["total_tokens_embedded"] = prev_tokens + run_tokens
    state["estimated_cost_usd"] = round(prev_cost + run_cost, 6)
    state["last_indexed_at"] = datetime.now(timezone.utc).isoformat()


def _index_texts(chunks: list[TextChunk], cfg: EmbedConfig) -> tuple[list[str], list[str] | None]:
    if is_gemini_embedding_2(cfg.model):
        texts = [embed_body_text(c) for c in chunks]
        titles: list[str] | None = [c.title for c in chunks]
    else:
        texts = [embed_input_text(c) for c in chunks]
        titles = None
    if is_section_enriched_profile(cfg.profile):
        texts = enrich_texts_for_section(chunks, texts)
    from rag_literature_rag.ingest.contextual import augment_texts_for_context, is_contextual_profile

    if is_contextual_profile(cfg.profile):
        texts = augment_texts_for_context(chunks, texts)
    return texts, titles


def _embed_index_texts(
    chunks: list[TextChunk],
    texts: list[str],
    titles: list[str] | None,
    *,
    cfg: EmbedConfig,
    stats: EmbedStats | None,
    workers: int | None,
    phase_stats: IndexPhaseStats | None,
) -> list[list[float]]:
    cached: list[list[float] | None] = []
    missing_indexes: list[int] = []
    for idx, text in enumerate(texts):
        title = titles[idx] if titles else None
        vector = embed_cache.get(cfg, title=title, text=text)
        if vector is None:
            missing_indexes.append(idx)
        cached.append(vector)

    misses = len(missing_indexes)
    hits = len(texts) - misses
    if phase_stats is not None:
        phase_stats.embed_cache_hits += hits
        phase_stats.embed_cache_misses += misses

    if not missing_indexes:
        if stats is not None:
            stats.set_effective_config(cfg)
        return [v for v in cached if v is not None]

    missing_texts = [texts[idx] for idx in missing_indexes]
    missing_titles = [titles[idx] for idx in missing_indexes] if titles else None
    vectors = embed_texts(
        missing_texts,
        config=cfg,
        stats=stats,
        workers=workers,
        prefix=ENV_PREFIX,
        allow_fallback=not is_gemini_embedding_2(cfg.model),
        probe=False,
        titles=missing_titles,
    )
    for idx, vector in zip(missing_indexes, vectors):
        title = titles[idx] if titles else None
        embed_cache.put(cfg, title=title, text=texts[idx], vector=vector)
        cached[idx] = vector
    return [v for v in cached if v is not None]


def _write_lancedb_rows(
    *,
    paths: ProfileIndexPaths,
    table_name: str,
    rows: list[dict[str, Any]],
    chunks: list[TextChunk],
    rebuild: bool,
    delete_scope: Literal["doc_id", "chunk_id"],
) -> None:
    paths.lance_dir.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(paths.lance_dir))
    tables = _table_names(db)
    if rebuild or table_name not in tables:
        if table_name in tables:
            db.drop_table(table_name)
        db.create_table(table_name, data=rows)
        return
    table = db.open_table(table_name)
    schema_names = set(getattr(getattr(table, "schema", None), "names", []) or [])
    if schema_names:
        rows = [
            {key: value for key, value in row.items() if key in schema_names}
            for row in rows
        ]
    if delete_scope == "chunk_id":
        for row in rows:
            escaped = str(row["id"]).replace("'", "''")
            table.delete(f"id = '{escaped}'")
    else:
        for doc_id in sorted({chunk.doc_id for chunk in chunks}):
            escaped = doc_id.replace("'", "''")
            table.delete(f"doc_id = '{escaped}'")
    table.add(rows)


def upsert_chunks(
    chunks: list[TextChunk],
    *,
    rebuild: bool = False,
    config: EmbedConfig | None = None,
    stats: EmbedStats | None = None,
    workers: int | None = None,
    profile: str | ProfileIndexPaths | None = None,
    phase_stats: IndexPhaseStats | None = None,
    skip_bm25: bool = False,
    delete_scope: Literal["doc_id", "chunk_id"] = "doc_id",
    parents: list[TextChunk] | None = None,
) -> int:
    if not chunks:
        return 0

    paths = _paths(profile)
    log = get_logger()
    cfg = config or embed_config_from_env()
    texts, titles = _index_texts(chunks, cfg)
    doc_ids = len({c.doc_id for c in chunks})
    profile_note = f" profile={cfg.profile}" if cfg.profile else ""
    log.info(
        "embedding %d chunk(s) from %d doc(s) backend=%s model=%s dims=%d%s index=%s",
        len(chunks),
        doc_ids,
        cfg.backend,
        cfg.model,
        cfg.dimensions,
        profile_note,
        paths.root,
    )
    t0 = time.monotonic()
    vectors = _embed_index_texts(
        chunks,
        texts,
        titles,
        cfg=cfg,
        stats=stats,
        workers=workers,
        phase_stats=phase_stats,
    )
    embed_s = time.monotonic() - t0
    if phase_stats is not None:
        phase_stats.embedding_seconds += embed_s
    log.info(
        "embed phase done chunks=%d elapsed_s=%.1f chunks_per_second=%.2f",
        len(chunks),
        embed_s,
        len(chunks) / embed_s if embed_s else 0.0,
    )

    rows = [_chunk_row(c, v) for c, v in zip(chunks, vectors)]

    lance_started = time.monotonic()
    _write_lancedb_rows(
        paths=paths,
        table_name=CHUNKS_TABLE,
        rows=rows,
        chunks=chunks,
        rebuild=rebuild,
        delete_scope=delete_scope,
    )
    parent_texts: list[str] = []
    parent_rows = 0
    if parents and is_small2big_dual_profile(cfg.profile):
        parent_texts, parent_titles = _index_texts(parents, cfg)
        parent_vectors = _embed_index_texts(
            parents,
            parent_texts,
            parent_titles,
            cfg=cfg,
            stats=stats,
            workers=workers,
            phase_stats=phase_stats,
        )
        parent_row_payloads = [_chunk_row(c, v) for c, v in zip(parents, parent_vectors)]
        _write_lancedb_rows(
            paths=paths,
            table_name=PARENTS_TABLE,
            rows=parent_row_payloads,
            chunks=parents,
            rebuild=rebuild,
            delete_scope=delete_scope,
        )
        parent_rows = len(parent_row_payloads)
    lance_s = time.monotonic() - lance_started
    if phase_stats is not None:
        phase_stats.lancedb_seconds += lance_s
    log.info("lancedb phase done rows=%d elapsed_s=%.1f", len(rows), lance_s)

    # Mirror the dense write into the BM25 lexical index (same enriched body text).
    if skip_bm25:
        bm25_s = 0.0
    else:
        bm25_started = time.monotonic()
        bm25.upsert_chunks(chunks, texts, index_dir=paths.bm25_dir, rebuild=rebuild)
        if parents and is_small2big_dual_profile(cfg.profile):
            parent_bm25_dir = paths.bm25_parent_dir or (paths.root / "bm25_parent")
            bm25.upsert_chunks(parents, parent_texts, index_dir=parent_bm25_dir, rebuild=rebuild)
        bm25_s = time.monotonic() - bm25_started
        if phase_stats is not None:
            phase_stats.bm25_seconds += bm25_s
        log.info("bm25 phase done rows=%d elapsed_s=%.1f", len(chunks), bm25_s)

    log.info(
        "index batch phases done chunks=%d parents=%d embed_s=%.1f lancedb_s=%.1f bm25_s=%.1f total_s=%.1f",
        len(chunks),
        parent_rows,
        embed_s,
        lance_s,
        bm25_s,
        time.monotonic() - t0,
    )
    return len(rows)


def _summary_index_texts(summaries: list[DocumentSummary], cfg: EmbedConfig) -> tuple[list[str], list[str] | None]:
    chunks = [summary_to_chunk(summary) for summary in summaries]
    return _index_texts(chunks, cfg)


def upsert_summaries(
    summaries: list[DocumentSummary],
    *,
    rebuild: bool = False,
    config: EmbedConfig | None = None,
    stats: EmbedStats | None = None,
    workers: int | None = None,
    profile: str | ProfileIndexPaths | None = None,
    phase_stats: IndexPhaseStats | None = None,
    delete_scope: Literal["doc_id", "chunk_id"] = "doc_id",
) -> int:
    if not summaries:
        return 0

    paths = _paths(profile)
    log = get_logger()
    cfg = config or embed_config_from_env()
    chunks = [summary_to_chunk(summary) for summary in summaries]
    texts, titles = _summary_index_texts(summaries, cfg)
    log.info(
        "embedding %d document summary chunk(s) backend=%s model=%s dims=%d index=%s",
        len(summaries),
        cfg.backend,
        cfg.model,
        cfg.dimensions,
        paths.root,
    )

    t0 = time.monotonic()
    vectors = _embed_index_texts(
        chunks,
        texts,
        titles,
        cfg=cfg,
        stats=stats,
        workers=workers,
        phase_stats=phase_stats,
    )
    embed_s = time.monotonic() - t0
    if phase_stats is not None:
        phase_stats.embedding_seconds += embed_s

    rows = [summary_row(summary, vector) for summary, vector in zip(summaries, vectors)]

    lance_started = time.monotonic()
    _write_lancedb_rows(
        paths=paths,
        table_name=SUMMARIES_TABLE,
        rows=rows,
        chunks=chunks,
        rebuild=rebuild,
        delete_scope=delete_scope,
    )
    lance_s = time.monotonic() - lance_started
    if phase_stats is not None:
        phase_stats.lancedb_seconds += lance_s

    bm25_started = time.monotonic()
    summary_bm25_dir = paths.bm25_summary_dir or (paths.root / "bm25_summary")
    bm25.upsert_chunks(chunks, texts, index_dir=summary_bm25_dir, rebuild=rebuild)
    bm25_s = time.monotonic() - bm25_started
    if phase_stats is not None:
        phase_stats.bm25_seconds += bm25_s
    log.info(
        "summary index batch done summaries=%d embed_s=%.1f lancedb_s=%.1f bm25_s=%.1f",
        len(rows),
        embed_s,
        lance_s,
        bm25_s,
    )
    return len(rows)


def describe_profile_index(profile: str | ProfileIndexPaths) -> dict[str, Any]:
    from rag_literature_rag.ingest.extract_cache import cache_stats as extract_cache_stats

    paths = _paths(profile)
    state = load_ingest_state(paths)
    return {
        "profile": paths.profile,
        "path": str(paths.root),
        "chunks": chunk_count(paths),
        "parents": parent_count(paths),
        "summaries": summary_count(paths),
        "embed_backend": state.get("embed_backend"),
        "embed_model": state.get("embed_model"),
        "embed_dims": state.get("embed_dims"),
        "embed_profile": state.get("embed_profile"),
        "pdf_backend": state.get("pdf_backend"),
        "last_indexed_at": state.get("last_indexed_at"),
        "total_tokens_embedded": state.get("total_tokens_embedded", 0),
        "estimated_cost_usd": state.get("estimated_cost_usd", 0.0),
        "extract_cache": extract_cache_stats(),
        "embed_cache": embed_cache.cache_stats(),
        "docsummary_cache": docsummary_cache_stats(),
    }


def chunk_count(profile: str | ProfileIndexPaths | None = None) -> int:
    paths = _paths(profile)
    if not paths.lance_dir.exists():
        return 0
    db = lancedb.connect(str(paths.lance_dir))
    if CHUNKS_TABLE not in _table_names(db):
        return 0
    return db.open_table(CHUNKS_TABLE).count_rows()


def parent_count(profile: str | ProfileIndexPaths | None = None) -> int:
    paths = _paths(profile)
    if not paths.lance_dir.exists():
        return 0
    db = lancedb.connect(str(paths.lance_dir))
    if PARENTS_TABLE not in _table_names(db):
        return 0
    return db.open_table(PARENTS_TABLE).count_rows()


def summary_count(profile: str | ProfileIndexPaths | None = None) -> int:
    paths = _paths(profile)
    if not paths.lance_dir.exists():
        return 0
    db = lancedb.connect(str(paths.lance_dir))
    if SUMMARIES_TABLE not in _table_names(db):
        return 0
    return db.open_table(SUMMARIES_TABLE).count_rows()
