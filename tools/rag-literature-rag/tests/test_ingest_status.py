from rag_literature_rag.ingest.status import (
    format_duration,
    load_status,
    new_run_status,
    progress,
    refresh_progress_estimate,
    write_status,
)
from rag_literature_rag.paths import ProfileIndexPaths


def test_status_updates_are_atomic_and_count_progress(tmp_path):
    paths = ProfileIndexPaths("test", tmp_path, tmp_path / "lance", tmp_path / "state.json", tmp_path / "bm25")
    status = new_run_status(
        paths=paths,
        backend="gemini",
        model="gemini-embedding-2",
        dimensions=3072,
        fingerprint={"strategy": "markdown-structure-v1"},
        embed_workers=4,
        extract_workers=6,
    )
    progress(status, chunks_written=12, errors=1)
    write_status(status, paths)
    loaded = load_status(paths)
    assert loaded["status"] == "running"
    assert loaded["chunks_written"] == 12 and loaded["errors"] == 1
    assert not (tmp_path / "ingest_status.json.tmp").exists()


def test_progress_estimate_tracks_rate_remaining_and_eta():
    status = {}
    refresh_progress_estimate(
        status,
        completed=25,
        total=100,
        started_monotonic=10.0,
        now_monotonic=20.0,
        phase="extracting",
    )
    assert status["phase"] == "extracting"
    assert status["documents_completed"] == 25
    assert status["documents_remaining"] == 75
    assert status["progress_percent"] == 25.0
    assert status["documents_per_second"] == 2.5
    assert status["eta_seconds"] == 30.0
    assert status["eta_at"]


def test_progress_estimate_and_duration_handle_unknown_eta():
    status = {}
    refresh_progress_estimate(
        status,
        completed=0,
        total=10,
        started_monotonic=5.0,
        now_monotonic=10.0,
        phase="initializing",
    )
    assert status["eta_seconds"] is None
    assert status["eta_at"] is None
    assert format_duration(None) == "unknown"
    assert format_duration(3661) == "1h 01m 01s"
