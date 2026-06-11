from __future__ import annotations

import hashlib
from pathlib import Path

from repo_rag.chunk.prefix import infer_package
from repo_rag.harvest.manifest import FileEntry, RepoManifest
from repo_rag.paths import REPO_ROOT

EXCLUDE_DIR_NAMES = {
    "node_modules",
    "dist",
    ".git",
    "__snapshots__",
    ".venv",
    "lancedb",
    "bm25",
    "raw",
    ".terraform",
}

EXCLUDE_FILE_SUFFIXES = {
    ".lock",
    ".db",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".map",
    ".snap",
}

HANDOFF_MARKDOWN = {
    "CLAUDE.md",
    "README.md",
    "REGION_SUBNET_VERTICAL_BANDS_PLAN.md",
}

# Scoped roots per plan — avoids indexing examples/, tooling, etc.
INCLUDE_ROOTS: tuple[str, ...] = (
    "docs",
    "packages/excalidraw",
    "packages/element",
    "packages/common",
    "packages/math",
    "packages/utils",
    "packages/backend",
    "excalidraw-app",
    "functions",
    "dev-docs",
)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _is_excluded(rel: str, name: str) -> bool:
    parts = rel.split("/")
    if any(part in EXCLUDE_DIR_NAMES for part in parts):
        return True
    if rel.startswith("tools/graph-layout-rag/data/"):
        return True
    if rel.startswith("tools/repo-rag/data/"):
        return True
    if rel.startswith("packages/backend/terraform/"):
        return True
    lower = name.lower()
    if any(lower.endswith(suffix) for suffix in EXCLUDE_FILE_SUFFIXES):
        return True
    return False


def _classify_source_type(rel: str, is_test: bool) -> str:
    if is_test:
        return "test"
    if rel in HANDOFF_MARKDOWN or rel.startswith("docs/") and rel.endswith(".md"):
        return "handoff"
    if rel == "packages/excalidraw/components/TERRAFORM_TEST_COVERAGE.md":
        return "doc"
    if rel.startswith("dev-docs/"):
        return "doc"
    if "/terraform" in rel and rel.startswith("packages/excalidraw/components/"):
        name = Path(rel).name
        if name.startswith("terraform"):
            return "terraform"
    if rel.startswith(("packages/excalidraw/", "packages/element/", "packages/common/", "packages/math/", "packages/utils/")):
        return "code"
    if rel.startswith(("excalidraw-app/", "functions/", "packages/backend/")):
        return "app"
    if rel.endswith(".md"):
        return "handoff"
    return "code"


def _infer_tags(rel: str, source_type: str) -> list[str]:
    tags: list[str] = []
    if source_type == "handoff":
        tags.append("handoff")
    if source_type == "terraform":
        tags.append("terraform")
    if "pipeline" in rel.lower():
        tags.append("pipeline")
    if "import" in rel.lower():
        tags.append("import")
    if "layout" in rel.lower():
        tags.append("layout")
    return tags


def _should_include(rel: str) -> bool:
    if rel in HANDOFF_MARKDOWN:
        return True
    if not rel.endswith((".ts", ".tsx", ".md", ".mdx")):
        return False
    return any(rel == root or rel.startswith(f"{root}/") for root in INCLUDE_ROOTS)


def _iter_candidate_files(repo_root: Path):
    for name in HANDOFF_MARKDOWN:
        path = repo_root / name
        if path.is_file():
            yield path
    for root_name in INCLUDE_ROOTS:
        root_path = repo_root / root_name
        if not root_path.exists():
            continue
        for path in sorted(root_path.rglob("*")):
            if path.is_file():
                yield path


def harvest_repo(root: Path | None = None) -> RepoManifest:
    repo_root = root or REPO_ROOT
    entries: list[FileEntry] = []

    for path in _iter_candidate_files(repo_root):
        try:
            rel = path.relative_to(repo_root).as_posix()
        except ValueError:
            continue
        if _is_excluded(rel, path.name):
            continue
        if not _should_include(rel):
            continue

        is_test = ".test." in path.name or path.name.endswith(".test.ts") or path.name.endswith(".test.tsx")
        source_type = _classify_source_type(rel, is_test)
        entries.append(
            FileEntry(
                path=rel,
                sha256=_sha256_file(path),
                source_type=source_type,
                package=infer_package(rel),
                is_test=is_test,
                tags=_infer_tags(rel, source_type),
            )
        )

    return RepoManifest(files=entries)
