from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from repo_rag.chunk.ast_ts import chunk_file
from repo_rag.harvest.manifest import FileEntry, RepoManifest
from repo_rag.paths import GRAPH_DB_PATH, REPO_ROOT

IMPORT_RE = re.compile(r"""(?:from\s+|import\s*\()\s*["']([^"']+)["']""")
NAMED_IMPORT_RE = re.compile(r"""import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']""")
CALL_RE = re.compile(r"\b([A-Za-z_$][\w$]*)\s*\(")
DECL_RE = re.compile(r"\b(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)")
CALL_IGNORES = {"if", "for", "while", "switch", "catch", "function", "constructor"}


def connect(path: Path = GRAPH_DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    return db


def _resolve_import(source: str, specifier: str, paths: set[str]) -> str | None:
    if not specifier.startswith("."):
        return None
    base = (Path(source).parent / specifier).as_posix()
    candidates = [base, *(base + ext for ext in (".ts", ".tsx", ".js", ".jsx", ".json")), *(f"{base}/index{ext}" for ext in (".ts", ".tsx", ".js", ".jsx"))]
    return next((candidate for candidate in candidates if candidate in paths), None)


def build_graph(manifest: RepoManifest, path: Path = GRAPH_DB_PATH) -> dict[str, int]:
    tmp = path.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    db = connect(tmp)
    db.executescript(
        """
        CREATE TABLE nodes(id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
          file_path TEXT NOT NULL, start_line INTEGER NOT NULL DEFAULT 1, source_type TEXT NOT NULL);
        CREATE TABLE edges(source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL,
          evidence TEXT NOT NULL, PRIMARY KEY(source, target, type, evidence));
        CREATE INDEX nodes_name ON nodes(name);
        CREATE INDEX edges_source ON edges(source, type);
        CREATE INDEX edges_target ON edges(target, type);
        """
    )
    paths = {entry.path for entry in manifest.files}
    symbols: dict[str, list[str]] = {}
    contents: dict[str, str] = {}
    for entry in manifest.files:
        content = (REPO_ROOT / entry.path).read_text(encoding="utf-8", errors="replace")
        contents[entry.path] = content
        file_id = f"file:{entry.path}"
        db.execute("INSERT INTO nodes VALUES(?,?,?,?,?,?)", (file_id, "file", Path(entry.path).name, entry.path, 1, entry.source_type))
        for chunk in chunk_file(entry, content):
            if chunk.kind == "file":
                continue
            node_id = f"symbol:{entry.path}:{chunk.start_line}:{chunk.symbol}"
            db.execute("INSERT OR IGNORE INTO nodes VALUES(?,?,?,?,?,?)", (node_id, "symbol", chunk.symbol, entry.path, chunk.start_line, entry.source_type))
            db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?,?)", (file_id, node_id, "contains", f"{entry.path}:{chunk.start_line}"))
            symbols.setdefault(chunk.symbol, []).append(node_id)

    for entry in manifest.files:
        content = contents[entry.path]
        source_id = f"file:{entry.path}"
        for specifier in IMPORT_RE.findall(content):
            target = _resolve_import(entry.path, specifier, paths)
            if target:
                db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?,?)", (source_id, f"file:{target}", "imports", f"{entry.path}: import {specifier}"))
        for names, specifier in NAMED_IMPORT_RE.findall(content):
            target_file = _resolve_import(entry.path, specifier, paths)
            if not target_file:
                continue
            for imported in names.split(","):
                imported_name = imported.strip().split(" as ", 1)[0].strip()
                for target_id in symbols.get(imported_name, []):
                    if target_id.startswith(f"symbol:{target_file}:"):
                        db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?,?)", (source_id, target_id, "imports", f"{entry.path}: import {imported_name} from {specifier}"))
        declared = set(DECL_RE.findall(content))
        for line_no, line in enumerate(content.splitlines(), 1):
            for called in CALL_RE.findall(line):
                if called in CALL_IGNORES or called in declared:
                    continue
                for target_id in symbols.get(called, []):
                    if not target_id.startswith(f"symbol:{entry.path}:"):
                        db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?,?)", (source_id, target_id, "calls", f"{entry.path}:{line_no}: {line.strip()[:180]}"))
        if entry.is_test:
            stem = re.sub(r"\.(test|spec)$", "", Path(entry.path).stem)
            for candidate in paths:
                if not candidate == entry.path and Path(candidate).stem == stem:
                    db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?,?)", (source_id, f"file:{candidate}", "tests", entry.path))
    db.commit()
    counts = {
        "nodes": db.execute("SELECT count(*) FROM nodes").fetchone()[0],
        "edges": db.execute("SELECT count(*) FROM edges").fetchone()[0],
    }
    db.close()
    tmp.replace(path)
    return counts


def find_entities(name: str, path: Path = GRAPH_DB_PATH) -> list[dict]:
    with connect(path) as db:
        rows = db.execute("SELECT * FROM nodes WHERE name = ? OR file_path = ? ORDER BY kind DESC, file_path", (name, name)).fetchall()
    return [dict(row) for row in rows]


def neighbors(entity: str, edge_type: str | None = None, depth: int = 1, path: Path = GRAPH_DB_PATH) -> list[dict]:
    seeds = find_entities(entity, path)
    if not seeds:
        return []
    with connect(path) as db:
        frontier = {row["id"] for row in seeds}
        seen = set(frontier)
        output: list[dict] = []
        for level in range(1, depth + 1):
            next_frontier: set[str] = set()
            for node_id in frontier:
                params: list[object] = [node_id, node_id]
                clause = ""
                if edge_type:
                    clause = " AND e.type = ?"
                    params.append(edge_type)
                rows = db.execute(
                    f"""SELECT e.*, n.id, n.kind, n.name, n.file_path, n.start_line, ? AS depth
                    FROM edges e JOIN nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
                    WHERE (e.source = ? OR e.target = ?){clause}""",
                    [level, node_id, *params],
                ).fetchall()
                for row in rows:
                    item = dict(row)
                    output.append(item)
                    if item["id"] not in seen:
                        seen.add(item["id"])
                        next_frontier.add(item["id"])
            frontier = next_frontier
            if not frontier:
                break
    return output


def graph_counts(path: Path = GRAPH_DB_PATH) -> dict[str, int]:
    if not path.exists():
        return {"nodes": 0, "edges": 0}
    with connect(path) as db:
        return {"nodes": db.execute("SELECT count(*) FROM nodes").fetchone()[0], "edges": db.execute("SELECT count(*) FROM edges").fetchone()[0]}
