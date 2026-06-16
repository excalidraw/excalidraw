import json
from pathlib import Path

import pytest

from rag_literature_rag.ingest.index import (
    chunk_count,
    chunking_fingerprint_mismatch,
    describe_profile_index,
    save_ingest_state,
)
from rag_literature_rag.paths import (
    list_profile_indexes,
    profile_index_paths,
    sanitize_profile_name,
)


def test_sanitize_profile_name_keeps_valid_chars():
    assert sanitize_profile_name("mlx-qwen0.6b") == "mlx-qwen0.6b"
    assert sanitize_profile_name("openai_large") == "openai_large"


def test_sanitize_profile_name_strips_unsafe():
    assert sanitize_profile_name("foo bar/baz") == "foo-bar-baz"


def test_sanitize_profile_name_rejects_empty():
    with pytest.raises(ValueError, match="Invalid embed profile"):
        sanitize_profile_name("  /  ")


def test_profile_index_paths_layout(tmp_path, monkeypatch):
    monkeypatch.setenv("RAG_LIT_INDEXES_DIR", str(tmp_path / "indexes"))
    paths = profile_index_paths("gemini-2")
    assert paths.profile == "gemini-2"
    assert paths.root == tmp_path / "indexes" / "gemini-2"
    assert paths.lance_dir == paths.root / "lancedb"
    assert paths.ingest_state == paths.root / "ingest_state.json"


def test_list_profile_indexes_scans_directories(tmp_path, monkeypatch):
    monkeypatch.setenv("RAG_LIT_INDEXES_DIR", str(tmp_path))
    (tmp_path / "gemini-2").mkdir()
    (tmp_path / "gemini-2" / "lancedb").mkdir()
    (tmp_path / "mlx-qwen4b").mkdir()
    (tmp_path / "mlx-qwen4b" / "ingest_state.json").write_text("{}")

    found = {p.profile for p in list_profile_indexes()}
    assert found == {"gemini-2", "mlx-qwen4b"}


def test_describe_profile_index_reads_state(tmp_path, monkeypatch):
    monkeypatch.setenv("RAG_LIT_INDEXES_DIR", str(tmp_path))
    paths = profile_index_paths("openai-large")
    paths.root.mkdir(parents=True)
    state = {
        "embed_backend": "openai",
        "embed_model": "text-embedding-3-large",
        "embed_dims": 1024,
        "embed_profile": "openai-large",
        "last_indexed_at": "2026-01-01T00:00:00Z",
    }
    save_ingest_state(state, paths)
    row = describe_profile_index(paths)
    assert row["profile"] == "openai-large"
    assert row["embed_model"] == "text-embedding-3-large"
    assert row["embed_dims"] == 1024
    assert row["chunks"] == chunk_count(paths)


def test_chunking_fingerprint_change_requires_rebuild():
    current = {"strategy": "markdown-structure-v1", "target_tokens": 800}
    assert not chunking_fingerprint_mismatch({}, current)
    assert not chunking_fingerprint_mismatch({"chunking_fingerprint": current}, current)
    assert chunking_fingerprint_mismatch(
        {"chunking_fingerprint": {"strategy": "fixed-window"}},
        current,
    )
