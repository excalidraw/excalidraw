import pickle
import logging
import threading
from concurrent.futures import Future
from pathlib import Path

import pytest

from rag_literature_rag.ingest import run
from rag_literature_rag.ingest.extract import PageText
from rag_literature_rag.ingest.status import load_status
from rag_literature_rag.manifest import Manifest, ManifestItem
from rag_literature_rag.paths import ProfileIndexPaths
from rag_common.config import EmbedConfig


def _item(
    doc_id: str,
    *,
    status: str = "ok",
    path: Path | None = None,
    sha256: str | None = None,
) -> ManifestItem:
    return ManifestItem(
        id=doc_id,
        title=f"Title {doc_id}",
        authors=["A"],
        year=2020,
        source="test",
        url=f"https://example.org/{doc_id}",
        status=status,
        localPath=str(path) if path else None,
        sha256=sha256,
        abstract=f"Abstract {doc_id}",
    )


def test_classify_skip_pdf_and_metadata(tmp_path):
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF")
    state = {"same": "abc", "meta-old": "meta:meta-old"}

    assert run._classify_ingest_item(
        _item("missing", path=tmp_path / "missing.pdf"), force=False, state=state
    ).reason == "missing_pdf"
    assert run._classify_ingest_item(
        _item("same", path=pdf, sha256="abc"), force=False, state=state
    ).reason == "unchanged"
    assert run._classify_ingest_item(
        _item("pdf", path=pdf), force=False, state=state
    ).kind == "pdf"
    assert run._classify_ingest_item(
        _item("meta", status="metadata_only"), force=False, state=state
    ).kind == "metadata"
    assert run._classify_ingest_item(
        _item("meta-old", status="metadata_only"), force=False, state=state
    ).reason == "unchanged_metadata"


def test_extract_pdf_task_chunks_and_falls_back(tmp_path, monkeypatch):
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF")
    task = run.ExtractionTask(_item("pdf", path=pdf), "pymupdf", ["layering"])

    monkeypatch.setattr(
        run,
        "extract_pdf_pages",
        lambda item, backend: [PageText(page=1, text="page text")],
    )
    outcome = run._extract_pdf_task(task)
    assert outcome.chunks[0].text.startswith("page text")
    assert outcome.chunks[0].pipeline_categories == ["layering"]
    assert outcome.elapsed_seconds is not None

    monkeypatch.setattr(run, "extract_pdf_pages", lambda item, backend: [])
    fallback = run._extract_pdf_task(task)
    assert fallback.reason == "empty_pdf_metadata_fallback"
    assert fallback.chunks[0].text.startswith("Title pdf")
    assert fallback.elapsed_seconds is not None


def test_worker_function_and_task_are_picklable(tmp_path):
    task = run.ExtractionTask(_item("pdf", path=tmp_path / "doc.pdf"), "docling", [])
    assert pickle.loads(pickle.dumps(task)).item.id == "pdf"
    assert pickle.loads(pickle.dumps(run._extract_pdf_task)) is run._extract_pdf_task


def test_future_exception_falls_back_to_metadata(tmp_path):
    task = run.ExtractionTask(_item("pdf", path=tmp_path / "doc.pdf"), "pymupdf", [])
    future = Future()
    future.set_exception(RuntimeError("worker broke"))
    outcome = run._future_outcome(future, task)
    assert outcome.reason == "worker_error_metadata_fallback"
    assert outcome.error == "worker broke"
    assert outcome.chunks


def test_serial_mode_and_gemini_do_not_use_process_pool(tmp_path, monkeypatch):
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF")
    items = [_item("pdf", path=pdf), _item("meta", status="metadata_only")]
    calls = []

    monkeypatch.setattr(
        run,
        "_extract_pdf_task",
        lambda task: calls.append(task.pdf_backend)
        or run._metadata_outcome(task.item, task.pipeline_categories),
    )

    class ForbiddenPool:
        def __init__(self, *args, **kwargs):
            raise AssertionError("process pool should not be constructed")

    monkeypatch.setattr(run, "ProcessPoolExecutor", ForbiddenPool)
    serial = list(
        run._iter_extraction_outcomes(
            items, force=True, state={}, pdf_backend="pymupdf", extract_workers=1
        )
    )
    gemini = list(
        run._iter_extraction_outcomes(
            items, force=True, state={}, pdf_backend="gemini", extract_workers=3
        )
    )
    assert len(serial) == len(gemini) == 2
    assert calls == ["pymupdf", "gemini"]


def test_pool_is_bounded_and_completes_out_of_order(tmp_path, monkeypatch):
    items = []
    for n in range(7):
        pdf = tmp_path / f"{n}.pdf"
        pdf.write_bytes(b"%PDF")
        items.append(_item(str(n), path=pdf))

    tracker = {"active": 0, "max_active": 0}

    class FakeExecutor:
        def __init__(self, max_workers):
            self.max_workers = max_workers

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def shutdown(self, wait=True, cancel_futures=False):
            return None

        def submit(self, fn, task):
            future = Future()
            future.set_result(run._metadata_outcome(task.item, task.pipeline_categories))
            tracker["active"] += 1
            tracker["max_active"] = max(tracker["max_active"], tracker["active"])
            return future

    def fake_wait(pending, return_when):
        future = list(pending)[-1]
        tracker["active"] -= 1
        return {future}, set(pending) - {future}

    monkeypatch.setattr(run, "ProcessPoolExecutor", FakeExecutor)
    monkeypatch.setattr(run, "wait", fake_wait)
    outcomes = list(
        run._iter_extraction_outcomes(
            items, force=True, state={}, pdf_backend="docling", extract_workers=2
        )
    )
    assert tracker["max_active"] == 4
    assert [outcome.item.id for outcome in outcomes[:2]] == ["3", "4"]


def test_extract_workers_invalid_falls_back(monkeypatch, caplog):
    logger = logging.getLogger("rag_literature_rag.ingest")
    old_propagate = logger.propagate
    logger.propagate = True
    monkeypatch.setenv("RAG_LIT_EXTRACT_WORKERS", "many")
    try:
        assert run._extract_workers() == 4
        assert "invalid RAG_LIT_EXTRACT_WORKERS" in caplog.text
    finally:
        logger.propagate = old_propagate


def test_queued_extraction_continues_while_consumer_is_blocked(monkeypatch):
    produced = threading.Event()
    items = [_item(str(n), status="metadata_only") for n in range(3)]

    def outcomes(*args, **kwargs):
        for item in items:
            yield run._metadata_outcome(item, [])
        produced.set()

    monkeypatch.setattr(run, "_iter_extraction_outcomes", outcomes)
    telemetry = run.ExtractionPipelineTelemetry(queue_capacity=3)
    iterator = run._iter_queued_extraction_outcomes(
        items,
        force=True,
        state={},
        pdf_backend="pymupdf",
        extract_workers=1,
        queue_capacity=3,
        telemetry=telemetry,
        log=logging.getLogger("test"),
    )
    first = next(iterator)
    assert first.item.id == "0"
    assert produced.wait(timeout=1)
    assert telemetry.documents_extracted == 3
    iterator.close()


def test_extraction_queue_never_exceeds_capacity(monkeypatch):
    items = [_item(str(n), status="metadata_only") for n in range(8)]
    monkeypatch.setattr(
        run,
        "_iter_extraction_outcomes",
        lambda *args, **kwargs: (
            run._metadata_outcome(item, []) for item in items
        ),
    )
    telemetry = run.ExtractionPipelineTelemetry(queue_capacity=2)
    outcomes = list(
        run._iter_queued_extraction_outcomes(
            items,
            force=True,
            state={},
            pdf_backend="pymupdf",
            extract_workers=1,
            queue_capacity=2,
            telemetry=telemetry,
            log=logging.getLogger("test"),
        )
    )
    assert len(outcomes) == 8
    assert telemetry.max_queue_depth <= 2


def test_queued_extraction_propagates_producer_exception(monkeypatch):
    def broken(*args, **kwargs):
        yield run._metadata_outcome(_item("ok", status="metadata_only"), [])
        raise RuntimeError("producer broke")

    monkeypatch.setattr(run, "_iter_extraction_outcomes", broken)
    telemetry = run.ExtractionPipelineTelemetry(queue_capacity=2)
    iterator = run._iter_queued_extraction_outcomes(
        [],
        force=True,
        state={},
        pdf_backend="pymupdf",
        extract_workers=1,
        queue_capacity=2,
        telemetry=telemetry,
        log=logging.getLogger("test"),
    )
    assert next(iterator).item.id == "ok"
    with pytest.raises(RuntimeError, match="producer broke"):
        next(iterator)


def test_queued_extraction_propagates_keyboard_interrupt(monkeypatch):
    def interrupted(*args, **kwargs):
        yield from ()
        raise KeyboardInterrupt

    monkeypatch.setattr(run, "_iter_extraction_outcomes", interrupted)
    telemetry = run.ExtractionPipelineTelemetry(queue_capacity=1)
    iterator = run._iter_queued_extraction_outcomes(
        [],
        force=True,
        state={},
        pdf_backend="pymupdf",
        extract_workers=1,
        queue_capacity=1,
        telemetry=telemetry,
        log=logging.getLogger("test"),
    )
    with pytest.raises(KeyboardInterrupt):
        next(iterator)
    assert not any(t.name == "graph-rag-extract" for t in threading.enumerate())


def test_closing_queued_extraction_stops_blocked_producer(monkeypatch):
    items = [_item(str(n), status="metadata_only") for n in range(20)]
    monkeypatch.setattr(
        run,
        "_iter_extraction_outcomes",
        lambda *args, **kwargs: (
            run._metadata_outcome(item, []) for item in items
        ),
    )
    telemetry = run.ExtractionPipelineTelemetry(queue_capacity=1)
    iterator = run._iter_queued_extraction_outcomes(
        items,
        force=True,
        state={},
        pdf_backend="pymupdf",
        extract_workers=1,
        queue_capacity=1,
        telemetry=telemetry,
        log=logging.getLogger("test"),
    )
    next(iterator)
    iterator.close()
    assert not any(t.name == "graph-rag-extract" for t in threading.enumerate())


def test_execute_ingest_flushes_batches_and_checkpoints(tmp_path, monkeypatch):
    items = [_item(str(n), status="metadata_only") for n in range(3)]
    outcomes = [run._metadata_outcome(item, []) for item in items]
    root = tmp_path / "index"
    paths = ProfileIndexPaths(
        profile="test",
        root=root,
        lance_dir=root / "lancedb",
        ingest_state=root / "ingest_state.json",
        bm25_dir=root / "bm25",
    )
    upserts = []
    checkpoints = []

    monkeypatch.setenv("RAG_LIT_INGEST_DOC_BATCH", "2")
    monkeypatch.setattr(run, "setup_ingest_logging", lambda **kwargs: logging.getLogger("test"))
    monkeypatch.setattr(run, "load_manifest", lambda: Manifest(items=items))
    monkeypatch.setattr(
        run,
        "prepare_embed_config",
        lambda profile: EmbedConfig("local", "all-MiniLM-L6-v2", 384, profile="test"),
    )
    monkeypatch.setattr(run, "profile_index_paths", lambda profile=None: paths)
    monkeypatch.setattr(run, "load_ingest_state", lambda profile: {})
    monkeypatch.setattr(
        run,
        "_iter_extraction_outcomes",
        lambda *args, **kwargs: iter(outcomes),
    )
    monkeypatch.setattr(
        run,
        "upsert_chunks",
        lambda chunks, **kwargs: upserts.append((len(chunks), kwargs["rebuild"]))
        or len(chunks),
    )
    monkeypatch.setattr(
        run,
        "save_ingest_state",
        lambda state, profile: checkpoints.append(dict(state)),
    )
    monkeypatch.setattr(run, "chunk_count", lambda profile: 3)
    monkeypatch.setattr(run, "resolve_workers", lambda workers, prefix: 1)

    run._execute_ingest(
        force=False,
        rebuild=True,
        verbose=False,
        log_file=None,
        embed_profile="test",
        pdf_backend="pymupdf",
    )

    assert upserts == [(2, True), (1, False)]
    assert set(checkpoints[0]) >= {"0", "1", "pdf_backend"}
    assert set(checkpoints[1]) >= {"0", "1", "2", "pdf_backend"}
    status = load_status(paths)
    assert status["status"] == "completed"
    assert status["phase"] == "completed"
    assert status["documents_processed"] == 3
    assert status["documents_completed"] == 3
    assert status["documents_indexed"] == 3
    assert status["progress_percent"] == 100.0


def test_checkpoint_does_not_advance_when_index_write_fails(tmp_path, monkeypatch):
    item = _item("0", status="metadata_only")
    root = tmp_path / "index"
    paths = ProfileIndexPaths(
        profile="test",
        root=root,
        lance_dir=root / "lancedb",
        ingest_state=root / "ingest_state.json",
        bm25_dir=root / "bm25",
    )
    checkpoints = []

    monkeypatch.setattr(run, "setup_ingest_logging", lambda **kwargs: logging.getLogger("test"))
    monkeypatch.setattr(run, "load_manifest", lambda: Manifest(items=[item]))
    monkeypatch.setattr(
        run,
        "prepare_embed_config",
        lambda profile: EmbedConfig("local", "all-MiniLM-L6-v2", 384, profile="test"),
    )
    monkeypatch.setattr(run, "profile_index_paths", lambda profile=None: paths)
    monkeypatch.setattr(run, "load_ingest_state", lambda profile: {})
    monkeypatch.setattr(
        run,
        "_iter_extraction_outcomes",
        lambda *args, **kwargs: iter([run._metadata_outcome(item, [])]),
    )
    monkeypatch.setattr(
        run,
        "upsert_chunks",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("BM25 failed")),
    )
    monkeypatch.setattr(
        run,
        "save_ingest_state",
        lambda state, profile: checkpoints.append(dict(state)),
    )
    monkeypatch.setattr(run, "resolve_workers", lambda workers, prefix: 1)

    with pytest.raises(RuntimeError, match="BM25 failed"):
        run._execute_ingest(
            force=False,
            rebuild=True,
            verbose=False,
            log_file=None,
            embed_profile="test",
            pdf_backend="pymupdf",
        )
    assert all("0" not in checkpoint for checkpoint in checkpoints)
