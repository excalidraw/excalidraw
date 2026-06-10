import json
import subprocess

import pytest

from graph_layout_rag.ingest.index import chunk_count
from graph_layout_rag.paths import LANCE_DIR
from graph_layout_rag.query.search import search


@pytest.fixture
def index_available() -> bool:
    return LANCE_DIR.exists() and chunk_count() > 0


@pytest.mark.skipif(
    not (LANCE_DIR.exists() and chunk_count() > 0),
    reason="LanceDB index missing — run harvest + ingest first",
)
def test_query_rank_assignment():
    results = search(
        "dot algorithm rank assignment network simplex",
        top=5,
    )
    assert results
    titles = " ".join(r.get("title", "") for r in results).lower()
    assert "directed" in titles or "layered" in titles or "gansner" in titles or "tse" in titles


@pytest.mark.skipif(
    not (LANCE_DIR.exists() and chunk_count() > 0),
    reason="LanceDB index missing — run harvest + ingest first",
)
def test_query_stress_majorization():
    results = search("stress majorization neato", top=5, tag="neato")
    assert results
    joined = json.dumps(results).lower()
    assert "stress" in joined or "gansner" in joined or "majorization" in joined


def test_cli_json_help():
    proc = subprocess.run(
        ["uv", "run", "graph-layout-rag", "query", "--help"],
        capture_output=True,
        text=True,
        cwd=__import__("pathlib").Path(__file__).resolve().parents[1],
    )
    assert proc.returncode == 0
    assert "--json" in proc.stdout
