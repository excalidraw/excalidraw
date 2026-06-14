from pathlib import Path

from repo_rag.graph import build_graph, find_entities, neighbors
from repo_rag.harvest.manifest import FileEntry, RepoManifest


def _entry(path: str, is_test: bool = False) -> FileEntry:
    return FileEntry(path=path, sha256="x", source_type="test" if is_test else "code", package="pkg", is_test=is_test)


def test_graph_finds_importers_and_callers(tmp_path, monkeypatch):
    (tmp_path / "lib.ts").write_text("export function target() { return 1; }\n", encoding="utf-8")
    (tmp_path / "use.ts").write_text('import { target } from "./lib";\nexport function use() { return target(); }\n', encoding="utf-8")
    manifest = RepoManifest(files=[_entry("lib.ts"), _entry("use.ts")])
    db_path = tmp_path / "graph.sqlite"
    monkeypatch.setattr("repo_rag.graph.REPO_ROOT", tmp_path)
    build_graph(manifest, db_path)

    assert find_entities("target", db_path)
    rows = neighbors("target", "calls", path=db_path)
    assert any(row["file_path"] == "use.ts" and row["type"] == "calls" for row in rows)
    symbol_imports = neighbors("target", "imports", path=db_path)
    assert any(row["file_path"] == "use.ts" for row in symbol_imports)
    imports = neighbors("lib.ts", "imports", path=db_path)
    assert any(row["file_path"] == "use.ts" for row in imports)
