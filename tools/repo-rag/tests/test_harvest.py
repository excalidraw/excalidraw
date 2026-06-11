from repo_rag.harvest.walk import harvest_repo
from repo_rag.paths import REPO_ROOT


def test_harvest_includes_handoff_and_terraform():
    manifest = harvest_repo(REPO_ROOT)
    paths = {f.path for f in manifest.files}
    assert "CLAUDE.md" in paths
    assert "README.md" in paths
    assert any("terraformPipelineLayout" in p for p in paths)
    assert not any("node_modules" in p for p in paths)


def test_classify_terraform_source_type():
    manifest = harvest_repo(REPO_ROOT)
    terraform = [f for f in manifest.files if f.source_type == "terraform"]
    assert len(terraform) >= 50
    assert all(f.path.startswith("packages/excalidraw/components/terraform") for f in terraform)
