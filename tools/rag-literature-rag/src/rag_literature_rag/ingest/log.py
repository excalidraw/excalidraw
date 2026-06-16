"""Structured logging for ingest (console + file)."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from rag_literature_rag.paths import INGEST_LOG_PATH

_LOGGER: logging.Logger | None = None


def setup_ingest_logging(
    *,
    log_file: Path | None = None,
    verbose: bool = False,
) -> logging.Logger:
    global _LOGGER
    path = log_file or INGEST_LOG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("rag_literature_rag.ingest")
    logger.handlers.clear()
    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stderr)
    console.setLevel(logging.DEBUG if verbose else logging.INFO)
    console.setFormatter(fmt)
    logger.addHandler(console)

    file_handler = logging.FileHandler(path, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    # Surface backend progress and retries in the ingest log.
    for logger_name in (
        "rag_common.embed",
        "rag_common.local",
        "rag_common.openai",
        "rag_common.gemini",
    ):
        embed_logger = logging.getLogger(logger_name)
        embed_logger.handlers.clear()
        embed_logger.setLevel(logging.INFO)
        embed_logger.propagate = False
        embed_logger.addHandler(console)
        embed_logger.addHandler(file_handler)

    _LOGGER = logger
    logger.info("logging to %s (verbose=%s)", path, verbose)
    return logger


def get_logger() -> logging.Logger:
    if _LOGGER is None:
        return setup_ingest_logging()
    return _LOGGER
