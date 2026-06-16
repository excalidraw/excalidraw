from __future__ import annotations

import hashlib
import json
import os
import platform
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import click

from rag_literature_rag.eval.hardware import assert_memory_start_safe, memory_snapshot
from rag_literature_rag.paths import CHUNKS_TABLE, RETRIEVAL_INDEXES_DIR, profile_index_paths

IndexKind = Literal["splade", "colbert"]
INDEX_KINDS: tuple[IndexKind, ...] = ("splade", "colbert")
DEFAULT_MODELS = {
    "splade": "prithivida/Splade_PP_en_v1",
    "colbert": "answerdotai/answerai-colbert-small-v1",
}


def _now_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _slug(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "._-" else "-" for ch in value).strip("-")


def _corpus_fingerprint(rows: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        digest.update(str(row.get("id") or "").encode())
        digest.update(str(row.get("canonical_sha256") or "").encode())
        digest.update((row.get("text") or "").encode())
    return digest.hexdigest()[:16]


def _load_rows(profile: str) -> list[dict[str, Any]]:
    import lancedb

    paths = profile_index_paths(profile)
    db = lancedb.connect(str(paths.lance_dir))
    return db.open_table(CHUNKS_TABLE).to_pandas().drop(columns=["vector"]).to_dict("records")


def _clean_payload(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in row.items():
        if hasattr(value, "item"):
            value = value.item()
        if isinstance(value, float) and value != value:
            value = None
        out[key] = value
    return out


def _qdrant():
    try:
        from qdrant_client import QdrantClient, models
        from fastembed import LateInteractionTextEmbedding, SparseTextEmbedding
    except ImportError as exc:
        raise click.ClickException(
            "Retrieval experiment dependencies are missing. "
            "Run: uv sync --extra retrieval-experiments"
        ) from exc
    return QdrantClient, models, SparseTextEmbedding, LateInteractionTextEmbedding


def _connect(QdrantClient, index_dir: Path, index_id: str, *, meta: dict | None = None):
    """Connect to Qdrant. Server (out-of-process, no OOM) when RAG_LIT_QDRANT_URL
    is set — uses a per-index collection so multiple indexes coexist; else local
    on-disk mode (one 'chunks' collection per index dir).

    Returns (client, collection_name).
    """
    # On search, honor the collection recorded at build time.
    if meta is not None:
        url = meta.get("qdrant_url") or os.getenv("RAG_LIT_QDRANT_URL")
        collection = meta.get("collection", "chunks")
    else:
        url = os.getenv("RAG_LIT_QDRANT_URL")
        collection = index_id if url else "chunks"
    if url:
        return QdrantClient(url=url, timeout=120), collection
    return QdrantClient(path=str(index_dir / "qdrant")), collection


def build_experimental_index(
    *,
    base_profile: str,
    kind: IndexKind,
    model_name: str | None = None,
    batch_size: int = 4,
    min_available_gb: float = 8.0,
) -> Path:
    if kind not in INDEX_KINDS:
        raise ValueError(f"Unknown index kind {kind!r}")
    start_memory = assert_memory_start_safe(min_available_gb)
    rows = _load_rows(base_profile)
    model_name = model_name or DEFAULT_MODELS[kind]
    fingerprint = _corpus_fingerprint(rows)
    index_id = f"{kind}-{_slug(model_name)}-{fingerprint}-{_now_id()}"
    index_dir = RETRIEVAL_INDEXES_DIR / _slug(base_profile) / index_id
    if index_dir.exists():
        raise FileExistsError(f"Refusing to overwrite experimental index: {index_dir}")
    index_dir.mkdir(parents=True)

    QdrantClient, models, SparseTextEmbedding, LateInteractionTextEmbedding = _qdrant()
    client, collection = _connect(QdrantClient, index_dir, index_id)
    started = time.monotonic()

    texts = [(row.get("text") or "")[:8000] for row in rows]
    if kind == "splade":
        model = SparseTextEmbedding(model_name=model_name)
        client.create_collection(
            collection_name=collection,
            vectors_config={},
            sparse_vectors_config={
                "splade": models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=True)
                )
            },
        )
        vectors = model.embed(texts, batch_size=batch_size)
        points = (
            models.PointStruct(
                id=idx,
                payload=_clean_payload(row),
                vector={
                    "splade": models.SparseVector(
                        indices=vector.indices.tolist(),
                        values=vector.values.tolist(),
                    )
                },
            )
            for idx, (row, vector) in enumerate(zip(rows, vectors))
        )
    else:
        model = LateInteractionTextEmbedding(model_name=model_name)
        probe = next(model.embed([texts[0]], batch_size=1))
        dims = len(probe[0])
        client.create_collection(
            collection_name=collection,
            vectors_config={
                "colbert": models.VectorParams(
                    size=dims,
                    distance=models.Distance.COSINE,
                    multivector_config=models.MultiVectorConfig(
                        comparator=models.MultiVectorComparator.MAX_SIM
                    ),
                )
            },
        )
        vectors = model.embed(texts, batch_size=batch_size)
        points = (
            models.PointStruct(id=idx, payload=_clean_payload(row), vector={"colbert": vector.tolist()})
            for idx, (row, vector) in enumerate(zip(rows, vectors))
        )

    client.upload_points(collection_name=collection, points=points, batch_size=batch_size, wait=True)
    meta = {
        "index_id": index_id,
        "kind": kind,
        "model": model_name,
        "collection": collection,
        "qdrant_url": os.getenv("RAG_LIT_QDRANT_URL") or None,
        "base_profile": base_profile,
        "corpus_fingerprint": fingerprint,
        "chunks": len(rows),
        "batch_size": batch_size,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "build_seconds": round(time.monotonic() - started, 2),
        "memory_start": start_memory.to_dict(),
        "memory_end": memory_snapshot().to_dict(),
        "platform": platform.platform(),
    }
    (index_dir / "index_meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return index_dir


def search_experimental(
    index_dir: Path,
    query: str,
    *,
    limit: int,
    expected_kind: str | None = None,
) -> list[dict[str, Any]]:
    QdrantClient, _models, SparseTextEmbedding, LateInteractionTextEmbedding = _qdrant()
    meta = json.loads((index_dir / "index_meta.json").read_text(encoding="utf-8"))
    if expected_kind and meta["kind"] != expected_kind:
        raise ValueError(
            f"Strategy requires {expected_kind!r} index, got {meta['kind']!r}: {index_dir}"
        )
    client, collection = _connect(QdrantClient, index_dir, meta["index_id"], meta=meta)
    if meta["kind"] == "splade":
        vector = next(SparseTextEmbedding(model_name=meta["model"]).query_embed(query))
        query_vector = (
            "splade",
            _models.SparseVector(
                indices=vector.indices.tolist(),
                values=vector.values.tolist(),
            ),
        )
    else:
        vector = next(LateInteractionTextEmbedding(model_name=meta["model"]).query_embed(query))
        query_vector = ("colbert", vector)
    name, value = query_vector
    response = client.query_points(
        collection_name=collection,
        query=value,
        using=name,
        limit=limit,
        with_payload=True,
    )
    return [
        {**(point.payload or {}), "score": float(point.score), "experimental_index": meta["index_id"]}
        for point in response.points
    ]


@click.command("build-retrieval-index")
@click.option("--base-profile", required=True)
@click.option("--kind", type=click.Choice(INDEX_KINDS), required=True)
@click.option("--model", "model_name", default=None)
@click.option("--batch-size", default=4, show_default=True, type=click.IntRange(min=1, max=32))
@click.option("--min-available-gb", default=8.0, show_default=True, type=click.FloatRange(min=1))
def build_retrieval_index_cmd(
    base_profile: str,
    kind: IndexKind,
    model_name: str | None,
    batch_size: int,
    min_available_gb: float,
) -> None:
    """Build an immutable learned-sparse or late-interaction index."""
    path = build_experimental_index(
        base_profile=base_profile,
        kind=kind,
        model_name=model_name,
        batch_size=batch_size,
        min_available_gb=min_available_gb,
    )
    click.echo(f"Wrote {path}")
