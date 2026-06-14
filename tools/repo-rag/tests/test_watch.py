from click.testing import CliRunner

import repo_rag.ingest.run as run_mod
from repo_rag.harvest.manifest import RepoManifest
from repo_rag.ingest.embed import EmbedConfig
from repo_rag.ingest.run import run_index
from repo_rag.paths import REPO_ROOT
from repo_rag.watch import _relevant_change, watch_cmd


def _abs(rel: str) -> str:
    return str(REPO_ROOT / rel)


def test_relevant_change_accepts_source_and_rejects_noise():
    # A real indexable source file passes the cheap gate.
    assert _relevant_change(
        None, _abs("packages/excalidraw/components/terraformPipelineLayoutShared.ts")
    )
    # Structural noise is rejected before we ever wake the indexer.
    assert not _relevant_change(None, _abs("node_modules/foo/index.js"))
    assert not _relevant_change(None, _abs("excalidraw-app/build/assets/app.js"))
    assert not _relevant_change(None, _abs("packages/excalidraw/logo.png"))
    # Outside the include roots (e.g. examples/) is not indexed.
    assert not _relevant_change(None, _abs("examples/with-script/index.ts"))
    # Paths outside the repo are ignored.
    assert not _relevant_change(None, "/etc/hosts")


def _stub_run_index_io(monkeypatch, calls):
    """Neutralize all of run_index's I/O so only the graph branch is exercised."""
    monkeypatch.setattr(run_mod, "harvest_repo", lambda: RepoManifest(files=[]))
    monkeypatch.setattr(run_mod, "save_manifest", lambda manifest: None)
    monkeypatch.setattr(run_mod, "load_ingest_state", lambda: {})
    monkeypatch.setattr(run_mod, "save_ingest_state", lambda state: None)
    monkeypatch.setattr(run_mod, "embed_config_mismatch", lambda state, cfg: False)
    monkeypatch.setattr(run_mod, "update_ingest_metadata", lambda *a, **k: None)
    monkeypatch.setattr(run_mod, "lance_chunk_count", lambda: 0)
    monkeypatch.setattr(
        run_mod,
        "prepare_embed_config",
        lambda profile=None: EmbedConfig(backend="local", model="stub", dimensions=8),
    )
    monkeypatch.setattr(
        run_mod, "build_graph", lambda manifest: calls.__setitem__("build_graph", True) or {"nodes": 1, "edges": 2}
    )
    monkeypatch.setattr(
        run_mod, "graph_counts", lambda: calls.__setitem__("graph_counts", True) or {"nodes": 7, "edges": 11}
    )


def test_run_index_skips_graph_rebuild(monkeypatch):
    calls: dict[str, bool] = {}
    _stub_run_index_io(monkeypatch, calls)

    result = run_index(build_graph_index=False)

    assert "build_graph" not in calls  # the ~6-8s full scan is skipped
    assert calls.get("graph_counts") is True  # counts are read so the summary stays truthful
    assert result["graph"] == {"nodes": 7, "edges": 11}


def test_run_index_builds_graph_by_default(monkeypatch):
    calls: dict[str, bool] = {}
    _stub_run_index_io(monkeypatch, calls)

    result = run_index(build_graph_index=True)

    assert calls.get("build_graph") is True
    assert result["graph"] == {"nodes": 1, "edges": 2}


def test_watch_requires_pinned_profile(monkeypatch):
    # No prior index / no pinned profile -> refuse to start (never silently re-resolve).
    monkeypatch.setattr("repo_rag.watch.load_ingest_state", lambda: {})
    result = CliRunner().invoke(watch_cmd, [])
    assert result.exit_code != 0
    assert "index --force --rebuild --embed-profile" in result.output
