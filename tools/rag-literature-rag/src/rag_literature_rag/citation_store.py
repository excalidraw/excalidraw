"""Persisted citation graph for the corpus.

The harvest pipeline already *touches* citation data (OpenAlex `cited_by_count` +
`authorships`, the forward/backward citation crawls) but never stores the edges. This
module is the missing data layer: a small SQLite graph of papers, citation edges, and
authorship, populated by `harvest/cite_enrich.py` and read by `query/citation_rank.py`.

Node identity = **OpenAlex work id** (short form, e.g. ``W2034567``). OpenAlex
`referenced_works` are themselves OpenAlex ids, so keying on them makes the citation
edges free (no DOI-resolution pass) and keeps DOI-less older works in the graph. Each
paper also stores its normalized DOI as an attribute, which is how we (a) map manifest
items in, and (b) merge Semantic Scholar's `isInfluential` flag, which is DOI-keyed.

Edges may point to works outside the corpus (a paper we indexed can cite one we never
harvested) — those are valid graph nodes for coupling/co-citation/PPR even though they
carry no ``doc_id``.
"""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path
from typing import Iterable

from rag_literature_rag.paths import CITATIONS_DB_PATH

_DOI_PREFIXES = ("https://doi.org/", "http://doi.org/", "https://dx.doi.org/", "doi:")


def normalize_doi(raw: str | None) -> str | None:
    """Lowercase, strip URL/`doi:` prefixes, drop trailing junk. None if not a DOI."""
    if not raw:
        return None
    s = str(raw).strip()
    low = s.lower()
    for prefix in _DOI_PREFIXES:
        if low.startswith(prefix):
            s = s[len(prefix):]
            break
    s = s.strip().lower().rstrip(").,;")
    if not s.startswith("10."):
        return None
    return s


def normalize_oa_id(raw: str | None) -> str | None:
    """OpenAlex id to short form: 'https://openalex.org/W123' -> 'W123'. None if absent."""
    if not raw:
        return None
    s = str(raw).strip().rstrip("/")
    tail = s.rsplit("/", 1)[-1]
    return tail if tail and tail[0] in "Ww" else None


def connect(path: Path = CITATIONS_DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=NORMAL")
    init_schema(db)
    return db


def init_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS papers(
          oa_id TEXT PRIMARY KEY,
          doi TEXT,
          doc_id TEXT,
          title TEXT,
          year INTEGER,
          cited_by_count INTEGER DEFAULT 0,
          influential_citation_count INTEGER DEFAULT 0,
          in_corpus INTEGER NOT NULL DEFAULT 0,
          enriched_at TEXT,
          incoming_at TEXT
        );
        CREATE TABLE IF NOT EXISTS cites(
          src_oa TEXT NOT NULL,
          dst_oa TEXT NOT NULL,
          is_influential INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(src_oa, dst_oa)
        );
        CREATE TABLE IF NOT EXISTS paper_aliases(
          provider TEXT NOT NULL,
          external_id TEXT NOT NULL,
          oa_id TEXT NOT NULL,
          PRIMARY KEY(provider, external_id)
        );
        CREATE TABLE IF NOT EXISTS cite_provenance(
          src_oa TEXT NOT NULL,
          dst_oa TEXT NOT NULL,
          provider TEXT NOT NULL,
          PRIMARY KEY(src_oa, dst_oa, provider)
        );
        CREATE TABLE IF NOT EXISTS authorship(
          author_key TEXT NOT NULL,
          doc_id TEXT NOT NULL,
          PRIMARY KEY(author_key, doc_id)
        );
        CREATE INDEX IF NOT EXISTS cites_src ON cites(src_oa);
        CREATE INDEX IF NOT EXISTS cites_dst ON cites(dst_oa);
        CREATE INDEX IF NOT EXISTS paper_aliases_oa ON paper_aliases(oa_id);
        CREATE INDEX IF NOT EXISTS cite_provenance_edge ON cite_provenance(src_oa, dst_oa);
        CREATE INDEX IF NOT EXISTS papers_doc ON papers(doc_id);
        CREATE INDEX IF NOT EXISTS papers_doi ON papers(doi);
        CREATE INDEX IF NOT EXISTS authorship_author ON authorship(author_key);
        CREATE INDEX IF NOT EXISTS authorship_doc ON authorship(doc_id);
        """
    )
    # Migration: `incoming_at` was added after the first stores were built.
    cols = {row[1] for row in db.execute("PRAGMA table_info(papers)")}
    if "incoming_at" not in cols:
        db.execute("ALTER TABLE papers ADD COLUMN incoming_at TEXT")
    db.commit()


def upsert_paper(
    db: sqlite3.Connection,
    *,
    oa_id: str,
    doi: str | None = None,
    doc_id: str | None = None,
    title: str | None = None,
    year: int | None = None,
    cited_by_count: int | None = None,
    in_corpus: bool = False,
    enriched_at: str | None = None,
) -> None:
    """Upsert a paper node. Existing non-null fields are preserved when the new value is
    null (so a cheap 'external neighbor' upsert never clobbers a full corpus row)."""
    db.execute(
        """
        INSERT INTO papers(oa_id, doi, doc_id, title, year, cited_by_count,
                           in_corpus, enriched_at)
        VALUES(:oa, :doi, :doc, :title, :year, :cbc, :corpus, :ts)
        ON CONFLICT(oa_id) DO UPDATE SET
          doi=COALESCE(excluded.doi, papers.doi),
          doc_id=COALESCE(excluded.doc_id, papers.doc_id),
          title=COALESCE(excluded.title, papers.title),
          year=COALESCE(excluded.year, papers.year),
          cited_by_count=MAX(COALESCE(excluded.cited_by_count, 0), papers.cited_by_count),
          in_corpus=MAX(excluded.in_corpus, papers.in_corpus),
          enriched_at=COALESCE(excluded.enriched_at, papers.enriched_at)
        """,
        {
            "oa": oa_id, "doi": doi, "doc": doc_id, "title": title, "year": year,
            "cbc": int(cited_by_count) if cited_by_count is not None else None,
            "corpus": 1 if in_corpus else 0, "ts": enriched_at,
        },
    )


def add_cites(
    db: sqlite3.Connection,
    edges: Iterable[tuple[str, str, int]],
    *,
    provider: str | None = None,
) -> int:
    """Bulk upsert (src_oa, dst_oa, is_influential). is_influential is OR-ed in once set."""
    rows = [(s, d, int(infl)) for s, d, infl in edges if s and d and s != d]
    if not rows:
        return 0
    db.executemany(
        """
        INSERT INTO cites(src_oa, dst_oa, is_influential) VALUES(?,?,?)
        ON CONFLICT(src_oa, dst_oa) DO UPDATE SET
          is_influential=MAX(cites.is_influential, excluded.is_influential)
        """,
        rows,
    )
    if provider:
        db.executemany(
            """
            INSERT OR IGNORE INTO cite_provenance(src_oa, dst_oa, provider)
            VALUES(?,?,?)
            """,
            ((src, dst, provider) for src, dst, _ in rows),
        )
    return len(rows)


def upsert_alias(
    db: sqlite3.Connection, *, provider: str, external_id: str | None, oa_id: str
) -> None:
    if not provider or not external_id or not oa_id:
        return
    db.execute(
        """
        INSERT INTO paper_aliases(provider, external_id, oa_id) VALUES(?,?,?)
        ON CONFLICT(provider, external_id) DO UPDATE SET oa_id=excluded.oa_id
        """,
        (provider.lower(), external_id, oa_id),
    )


def oa_id_for_alias(
    db: sqlite3.Connection, *, provider: str, external_id: str
) -> str | None:
    row = db.execute(
        "SELECT oa_id FROM paper_aliases WHERE provider=? AND external_id=?",
        (provider.lower(), external_id),
    ).fetchone()
    return row[0] if row else None


def set_influential_by_doi(db: sqlite3.Connection, src_doi: str, dst_doi: str) -> int:
    """Mark the edge between two DOIs as influential (Semantic Scholar merge). Returns rows hit."""
    cur = db.execute(
        """
        UPDATE cites SET is_influential=1
        WHERE src_oa IN (SELECT oa_id FROM papers WHERE doi=?)
          AND dst_oa IN (SELECT oa_id FROM papers WHERE doi=?)
        """,
        (src_doi, dst_doi),
    )
    return cur.rowcount


def add_authorships(db: sqlite3.Connection, pairs: Iterable[tuple[str, str]]) -> int:
    rows = [(a, d) for a, d in pairs if a and d]
    if not rows:
        return 0
    db.executemany("INSERT OR IGNORE INTO authorship(author_key, doc_id) VALUES(?,?)", rows)
    return len(rows)


def author_key(name: str) -> str:
    """Loose author identity: lowercase alphanumerics. Good enough for co-author edges."""
    return re.sub(r"[^a-z0-9]+", "", str(name).lower())


# --- read accessors -------------------------------------------------------------

def oa_id_for_doi(db: sqlite3.Connection, doi: str) -> str | None:
    row = db.execute("SELECT oa_id FROM papers WHERE doi=? AND oa_id IS NOT NULL", (doi,)).fetchone()
    return row[0] if row else None


def corpus_oa_by_doi(db: sqlite3.Connection) -> dict[str, str]:
    """{normalized_doi: oa_id} for every enriched corpus paper that has a DOI."""
    rows = db.execute(
        "SELECT doi, oa_id FROM papers WHERE in_corpus=1 AND doi IS NOT NULL AND oa_id IS NOT NULL"
    )
    return {r[0]: r[1] for r in rows}


def mark_incoming_done(db: sqlite3.Connection, oa_id: str, ts: str) -> None:
    db.execute("UPDATE papers SET incoming_at=? WHERE oa_id=?", (ts, oa_id))


def incoming_done_dois(db: sqlite3.Connection) -> set[str]:
    """DOIs of corpus papers whose incoming-citation pass already completed."""
    return {
        r[0]
        for r in db.execute(
            "SELECT doi FROM papers WHERE in_corpus=1 AND incoming_at IS NOT NULL AND doi IS NOT NULL"
        )
    }


def oa_id_for_doc(db: sqlite3.Connection, doc_id: str) -> str | None:
    row = db.execute("SELECT oa_id FROM papers WHERE doc_id=?", (doc_id,)).fetchone()
    return row[0] if row else None


def references_of(db: sqlite3.Connection, oa_id: str) -> set[str]:
    return {r[0] for r in db.execute("SELECT dst_oa FROM cites WHERE src_oa=?", (oa_id,))}


def cited_by_of(db: sqlite3.Connection, oa_id: str) -> set[str]:
    return {r[0] for r in db.execute("SELECT src_oa FROM cites WHERE dst_oa=?", (oa_id,))}


def coauthored_doc_ids(db: sqlite3.Connection, doc_id: str) -> set[str]:
    rows = db.execute(
        """
        SELECT DISTINCT a2.doc_id FROM authorship a1
        JOIN authorship a2 ON a1.author_key = a2.author_key
        WHERE a1.doc_id = ? AND a2.doc_id != ?
        """,
        (doc_id, doc_id),
    )
    return {r[0] for r in rows}


def paper_row(db: sqlite3.Connection, oa_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM papers WHERE oa_id=?", (oa_id,)).fetchone()


def counts(db: sqlite3.Connection) -> dict[str, int]:
    return {
        "papers": db.execute("SELECT count(*) FROM papers").fetchone()[0],
        "corpus_papers": db.execute("SELECT count(*) FROM papers WHERE in_corpus=1").fetchone()[0],
        "cite_edges": db.execute("SELECT count(*) FROM cites").fetchone()[0],
        "citation_provenance": db.execute("SELECT count(*) FROM cite_provenance").fetchone()[0],
        "paper_aliases": db.execute("SELECT count(*) FROM paper_aliases").fetchone()[0],
        "influential_edges": db.execute("SELECT count(*) FROM cites WHERE is_influential=1").fetchone()[0],
        "papers_with_incoming": db.execute(
            "SELECT count(*) FROM papers WHERE in_corpus=1 AND incoming_at IS NOT NULL"
        ).fetchone()[0],
        "authorship_edges": db.execute("SELECT count(*) FROM authorship").fetchone()[0],
        "distinct_authors": db.execute("SELECT count(DISTINCT author_key) FROM authorship").fetchone()[0],
    }
