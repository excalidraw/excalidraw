import logging

import repo_rag.logging_config as logging_config
from repo_rag.logging_config import setup_logging


def _reset_logging() -> None:
    logging_config._CONFIGURED = False
    root = logging.getLogger("repo_rag")
    root.handlers.clear()
    root.setLevel(logging.WARNING)
    common = logging.getLogger("rag_common")
    common.handlers.clear()
    common.setLevel(logging.WARNING)


def test_setup_logging_verbose(tmp_path):
    _reset_logging()
    log_file = tmp_path / "test.log"
    setup_logging(verbose=True, log_file=log_file)
    log = logging.getLogger("repo_rag.test")
    log.info("hello")
    assert log_file.read_text(encoding="utf-8").count("hello") == 1


def test_setup_logging_respects_level(tmp_path):
    _reset_logging()
    log_file = tmp_path / "test.log"
    setup_logging(verbose=False, log_file=log_file)
    log = logging.getLogger("repo_rag.test2")
    log.debug("hidden")
    log.info("visible")
    text = log_file.read_text(encoding="utf-8")
    assert "hidden" not in text
    assert "visible" in text


def test_setup_logging_captures_rag_common(tmp_path):
    _reset_logging()
    log_file = tmp_path / "test.log"
    setup_logging(verbose=True, log_file=log_file)
    logging.getLogger("rag_common.openai").info("throughput")
    assert "throughput" in log_file.read_text(encoding="utf-8")
