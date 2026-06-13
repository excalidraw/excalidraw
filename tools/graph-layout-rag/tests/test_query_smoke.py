import json
import subprocess
from pathlib import Path

import pytest

from graph_layout_rag.env import load_env_file
from graph_layout_rag.ingest.index import chunk_count
from graph_layout_rag.paths import list_profile_indexes, profile_index_paths
from graph_layout_rag.query.search import search

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
def test_query_rank_assignment():
    results = search(
        "dot algorithm rank assignment network simplex",
        top=5,
        embed_profile=_ACTIVE_PROFILE,
    )
    assert results
    titles = " ".join(r.get("title", "") for r in results).lower()
    assert "directed" in titles or "layered" in titles or "gansner" in titles or "tse" in titles


@pytest.mark.skipif(
    not _INDEX_AVAILABLE,
    reason="No profile index with chunks — run harvest + ingest first",
)
def test_query_stress_majorization():
    results = search(
        "stress majorization neato",
        top=5,
        tag="neato",
        embed_profile=_ACTIVE_PROFILE,
    )
    assert results
    joined = json.dumps(results).lower()
    assert "stress" in joined or "gansner" in joined or "majorization" in joined


def test_cli_json_help():
    proc = subprocess.run(
        ["uv", "run", "graph-layout-rag", "query", "--help"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    assert proc.returncode == 0
    assert "--json" in proc.stdout
