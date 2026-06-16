import json
import subprocess
from pathlib import Path

import pytest

from rag_literature_rag.env import load_env_file
from rag_literature_rag.ingest.index import chunk_count
from rag_literature_rag.paths import list_profile_indexes, profile_index_paths
from rag_literature_rag.query.search import search

load_env_file()


def _active_index_profile() -> str | None:
    for paths in list_profile_indexes():
        if paths.lance_dir.is_dir() and chunk_count(paths) > 0:
            return paths.profile
    default = profile_index_paths()
    if default.lance_dir.is_dir() and chunk_count(default) > 0:
        return default.profile
    return None


_ACTIVE_PROFILE = _active_index_profile()
_INDEX_AVAILABLE = _ACTIVE_PROFILE is not None


@pytest.mark.skipif(
    not _INDEX_AVAILABLE,
    reason="No profile index with chunks — run harvest + ingest first",
)
def test_query_self_rag():
    results = search(
        "Self-RAG reflection tokens retrieve critique",
        top=5,
        embed_profile=_ACTIVE_PROFILE,
    )
    assert results
    joined = " ".join(r.get("title", "") for r in results).lower()
    assert "self-rag" in joined or "reflection" in joined or "retrieve" in joined


def test_query_hybrid_rrf():
    results = search(
        "reciprocal rank fusion dense BM25 hybrid retrieval",
        top=5,
        embed_profile=_ACTIVE_PROFILE,
    )
    assert results


def test_cli_json_help():
    proc = subprocess.run(
        ["uv", "run", "rag-literature-rag", "query", "--help"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    assert proc.returncode == 0
    assert "--json" in proc.stdout
