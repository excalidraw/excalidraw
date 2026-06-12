"""SQLite ledger for per-URL harvest download attempts."""

from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from graph_layout_rag.paths import HARVEST_DB_PATH

_lock = threading.Lock()
_run_id: str | None = None
_stage: str = "harvest"


def set_harvest_run(run_id: str | None) -> None:
    global _run_id
    _run_id = run_id or _now_iso()


def set_harvest_stage(stage: str) -> None:
    global _stage
    _stage = stage


def current_run_id() -> str:
    global _run_id
    if _run_id is None:
        _run_id = _now_iso()
    return _run_id


@contextmanager
def _conn():
    HARVEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(str(HARVEST_DB_PATH), timeout=30.0)
    try:
        yield db
        db.commit()
    finally:
        db.close()


def init_db() -> None:
    with _lock, _conn() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS download_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id TEXT,
                doi TEXT,
                url TEXT NOT NULL,
                host TEXT,
                attempt INTEGER DEFAULT 1,
                http_status INTEGER,
                outcome TEXT NOT NULL,
                transient INTEGER NOT NULL DEFAULT 0,
                bytes INTEGER,
                retry_after INTEGER,
                harvest_run TEXT,
                stage TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_attempts_doc ON download_attempts(doc_id);
            CREATE INDEX IF NOT EXISTS idx_attempts_outcome ON download_attempts(outcome);
            CREATE INDEX IF NOT EXISTS idx_attempts_transient ON download_attempts(transient);

            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY,
                final_status TEXT,
                winning_url TEXT,
                last_outcome TEXT,
                urls_tried INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            """
        )


def classify_outcome(
    *,
    status: int | None,
    ok: bool = False,
    reason: str | None = None,
    error: str | None = None,
) -> tuple[str, bool]:
    if ok:
        return "ok", False
    if reason == "non-PDF":
        return "not_pdf", False
    if reason and reason.startswith("too small"):
        return "too_small", False
    if error:
        return "network_error", True
    if status == 429 or status in (503, 502, 504, 202):
        return "rate_limited", True
    if status in (403, 401):
        return "forbidden", False
    if status == 404:
        return "not_found", False
    if status and status != 200:
        return "http_error", False
    return "unknown", False


def log_attempt(
    *,
    url: str,
    outcome: str,
    transient: bool,
    doc_id: str | None = None,
    doi: str | None = None,
    attempt: int = 1,
    http_status: int | None = None,
    bytes_count: int | None = None,
    retry_after: int | None = None,
    stage: str | None = None,
) -> None:
    host = urlparse(url).hostname or ""
    now = _now_iso()
    with _lock, _conn() as db:
        db.execute(
            """
            INSERT INTO download_attempts
            (doc_id, doi, url, host, attempt, http_status, outcome, transient,
             bytes, retry_after, harvest_run, stage, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                doi,
                url,
                host,
                attempt,
                http_status,
                outcome,
                1 if transient else 0,
                bytes_count,
                retry_after,
                current_run_id(),
                stage or _stage,
                now,
            ),
        )
        if doc_id:
            db.execute(
                """
                INSERT INTO documents (doc_id, final_status, winning_url, last_outcome, urls_tried, updated_at)
                VALUES (?, NULL, NULL, ?, 1, ?)
                ON CONFLICT(doc_id) DO UPDATE SET
                    last_outcome = excluded.last_outcome,
                    urls_tried = urls_tried + 1,
                    updated_at = excluded.updated_at
                """,
                (doc_id, outcome, now),
            )


def update_document(
    doc_id: str,
    *,
    final_status: str,
    winning_url: str | None = None,
    last_outcome: str | None = None,
) -> None:
    now = _now_iso()
    with _lock, _conn() as db:
        db.execute(
            """
            INSERT INTO documents (doc_id, final_status, winning_url, last_outcome, urls_tried, updated_at)
            VALUES (?, ?, ?, ?, 0, ?)
            ON CONFLICT(doc_id) DO UPDATE SET
                final_status = excluded.final_status,
                winning_url = COALESCE(excluded.winning_url, documents.winning_url),
                last_outcome = COALESCE(excluded.last_outcome, documents.last_outcome),
                updated_at = excluded.updated_at
            """,
            (doc_id, final_status, winning_url, last_outcome, now),
        )


def summary() -> dict[str, Any]:
    init_db()
    with _lock, _conn() as db:
        by_outcome = dict(
            db.execute(
                "SELECT outcome, COUNT(*) FROM download_attempts GROUP BY outcome"
            ).fetchall()
        )
        transient = db.execute(
            "SELECT COUNT(*) FROM download_attempts WHERE transient=1"
        ).fetchone()[0]
        total_attempts = db.execute("SELECT COUNT(*) FROM download_attempts").fetchone()[0]
        docs = db.execute(
            "SELECT final_status, COUNT(*) FROM documents WHERE final_status IS NOT NULL GROUP BY final_status"
        ).fetchall()
        top_hosts = db.execute(
            """
            SELECT host, COUNT(*) AS n FROM download_attempts
            WHERE outcome='rate_limited' AND host IS NOT NULL AND host != ''
            GROUP BY host ORDER BY n DESC LIMIT 8
            """
        ).fetchall()
    return {
        "run_id": current_run_id(),
        "total_attempts": total_attempts,
        "by_outcome": by_outcome,
        "transient_attempts": transient,
        "documents_by_status": dict(docs),
        "top_rate_limited_hosts": top_hosts,
    }


def query_attempts(
    *,
    transient: bool | None = None,
    outcome: str | None = None,
    doc_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    init_db()
    clauses: list[str] = []
    params: list[Any] = []
    if transient is not None:
        clauses.append("transient = ?")
        params.append(1 if transient else 0)
    if outcome:
        clauses.append("outcome = ?")
        params.append(outcome)
    if doc_id:
        clauses.append("doc_id = ?")
        params.append(doc_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"SELECT doc_id, doi, url, host, http_status, outcome, transient, stage, created_at FROM download_attempts {where} ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with _lock, _conn() as db:
        rows = db.execute(sql, params).fetchall()
    keys = [
        "doc_id",
        "doi",
        "url",
        "host",
        "http_status",
        "outcome",
        "transient",
        "stage",
        "created_at",
    ]
    return [dict(zip(keys, row, strict=True)) for row in rows]


def transient_doc_urls() -> list[tuple[str, str, str | None]]:
    """Return (doc_id, url, doi) for transient failures without ok document."""
    init_db()
    with _lock, _conn() as db:
        rows = db.execute(
            """
            SELECT DISTINCT a.doc_id, a.url, a.doi
            FROM download_attempts a
            LEFT JOIN documents d ON d.doc_id = a.doc_id AND d.final_status = 'ok'
            WHERE a.transient = 1 AND d.doc_id IS NULL AND a.doc_id IS NOT NULL
            ORDER BY a.id DESC
            LIMIT 500
            """
        ).fetchall()
    return [(r[0], r[1], r[2]) for r in rows]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
