from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

from repo_rag.chunk.prefix import infer_package
from repo_rag.harvest.manifest import FileEntry, RepoManifest
from repo_rag.paths import REPO_ROOT

EXCLUDE_DIR_NAMES = {
    "node_modules",
    "dist",
    "build",
    ".git",
    "__snapshots__",
    ".venv",
    "lancedb",
    "bm25",
    "raw",
    ".terraform",
}

# Longest-line threshold above which a JS file is treated as minified/vendored
# and skipped. Hand-written source virtually never exceeds this; bundled output
# (single-line dagre/d3 chunks etc.) blows past it.
MINIFIED_MAX_LINE = 5000

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
    "scripts",
    "tools",
    ".github/workflows",
)

SOURCE_SUFFIXES = (
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
    ".md", ".mdx", ".json", ".jsonc", ".toml", ".yaml", ".yml",
)
CONFIG_FILES = {"package.json", "tsconfig.json", "wrangler.jsonc"}
ROOT_CONFIG_FILES = CONFIG_FILES | {"dependency-cruiser.js", "eslint.config.mjs"}


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


def _is_noise_content(rel: str, path: Path) -> bool:
    """Tracked-but-useless-for-retrieval content. Distinct from `_is_excluded`
    (structural) — this looks at what the file actually is."""
    name = Path(rel).name
    # Locale translations: keep en.json (source-of-truth UI strings), drop the
    # ~57 translated copies — pure noise for code/semantic retrieval.
    if rel.startswith("packages/excalidraw/locales/") and name != "en.json":
        return True
    # Minified / vendored JS that slipped past dir excludes: detect by line length.
    if name.endswith((".js", ".cjs", ".mjs")):
        try:
            with path.open("r", encoding="utf-8", errors="ignore") as f:
                if any(len(line) > MINIFIED_MAX_LINE for line in f):
                    return True
        except OSError:
            return False
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
    if rel in ROOT_CONFIG_FILES:
        return True
    if Path(rel).name not in CONFIG_FILES and not rel.endswith(SOURCE_SUFFIXES):
        return False
    return any(rel == root or rel.startswith(f"{root}/") for root in INCLUDE_ROOTS)


def _git_tracked_files(repo_root: Path) -> list[str] | None:
    """Relative paths of git-tracked files under the include roots + root configs.

    Using ``git ls-files`` makes the harvester honor ``.gitignore`` for free, so
    build output, scratch notes, and other ignored artifacts under an include
    root never get indexed. Returns None if git is unavailable so the caller can
    fall back to a filesystem walk.
    """
    targets = [*INCLUDE_ROOTS, *sorted(HANDOFF_MARKDOWN | ROOT_CONFIG_FILES)]
    try:
        proc = subprocess.run(
            ["git", "ls-files", "-z", "--", *targets],
            cwd=repo_root,
            capture_output=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return [rel for rel in proc.stdout.decode("utf-8", "ignore").split("\0") if rel]


def _iter_candidate_files(repo_root: Path):
    tracked = _git_tracked_files(repo_root)
    if tracked is not None:
        for rel in tracked:
            path = repo_root / rel
            if path.is_file():
                yield path
        return

    # Fallback (no git): filesystem walk, relying on the static exclude lists.
    for name in HANDOFF_MARKDOWN | ROOT_CONFIG_FILES:
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
        if _is_noise_content(rel, path):
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
