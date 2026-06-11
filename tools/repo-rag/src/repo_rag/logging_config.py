from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from repo_rag.paths import DATA_DIR

DEFAULT_LOG_FILE = DATA_DIR / "repo-rag.log"

_CONFIGURED = False


def setup_logging(
    *,
    verbose: bool = False,
    log_file: Path | str | None = None,
) -> logging.Logger:
    """Configure repo-rag logging once per process."""
    global _CONFIGURED

    level_name = os.getenv("REPO_RAG_LOG_LEVEL", "DEBUG" if verbose else "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    log_path = Path(log_file) if log_file else None
    if log_path is None and os.getenv("REPO_RAG_LOG_FILE"):
        log_path = Path(os.environ["REPO_RAG_LOG_FILE"])
    if log_path is None and os.getenv("REPO_RAG_LOG", "").lower() in ("1", "true", "yes"):
        log_path = DEFAULT_LOG_FILE

    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger("repo_rag")
    if _CONFIGURED:
        root.setLevel(level)
        return root

    root.setLevel(level)
    root.propagate = False

    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        stream_handler = logging.StreamHandler(sys.stderr)
        stream_handler.setFormatter(formatter)
        root.addHandler(stream_handler)

    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
        root.info("logging to %s", log_path)

    _CONFIGURED = True
    return root


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"repo_rag.{name}")
