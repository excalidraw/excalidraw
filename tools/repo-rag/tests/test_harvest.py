from repo_rag.harvest.walk import harvest_repo
from repo_rag.paths import REPO_ROOT


def test_harvest_includes_handoff_and_terraform():
    manifest = harvest_repo(REPO_ROOT)
    paths = {f.path for f in manifest.files}
    assert "CLAUDE.md" in paths
    assert "README.md" in paths
    assert any("terraformPipelineLayout" in p for p in paths)
    assert "tools/repo-rag/pyproject.toml" in paths
    assert "package.json" in paths
    assert not any("node_modules" in p for p in paths)


def test_classify_terraform_source_type():
    manifest = harvest_repo(REPO_ROOT)
    terraform = [f for f in manifest.files if f.source_type == "terraform"]
    assert len(terraform) >= 50
    assert all(f.path.startswith("packages/excalidraw/components/terraform") for f in terraform)


def test_harvest_excludes_build_and_gitignored_artifacts():
    manifest = harvest_repo(REPO_ROOT)
    paths = {f.path for f in manifest.files}
    # git-ignored build output must never be indexed (minified bundle noise)
    assert not any(p.startswith("excalidraw-app/build/") for p in paths)
    assert not any("/build/assets/" in p for p in paths)
    # other git-ignored scratch content
    assert not any(p.startswith("docs/reddit/") for p in paths)


def test_harvest_keeps_only_english_locale():
    manifest = harvest_repo(REPO_ROOT)
    locales = {p for p in (f.path for f in manifest.files) if p.startswith("packages/excalidraw/locales/")}
    # en.json is source-of-truth UI strings; the ~57 translations are dropped as noise
    assert locales == {"packages/excalidraw/locales/en.json"}
